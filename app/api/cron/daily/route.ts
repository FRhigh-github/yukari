// 1日1回、Vercel が自動で呼ぶ処理です（vercel.json の crons。毎朝9時）。GET /api/cron/daily
//
// ▼ やること
//   ・DB に軽く問い合わせて、Supabase の無料プランが「使われていない」と止まらないようにする
//   ・開封日が来た未来への手紙を、届いた人のスマホに知らせる
//   ・DB と保管庫の使用量を測り、無料プランの上限の8割を超えたら記録する（エラーのまとめで届く）
//   ・この1日に記録されたエラー（error_reports）を、運営者にメールでまとめて知らせる
//
// ▼ 呼べるのは Vercel だけ
//   Vercel は、環境変数 CRON_SECRET の値を「Authorization: Bearer ...」に付けて呼んでくれます。
//   それが合わなければ断ります（よそから何度も呼ばれて、通知を送らされないように）。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimPush, sendPush } from "@/lib/push";
import { sendMail } from "@/lib/mail";
import { reportError } from "@/lib/reportError";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "呼べません" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ▼ Supabase の無料プランは、しばらく誰も使わないとプロジェクトが止まります。
  //   止まると、アプリを開いても何も出なくなります。
  //   毎日1回 DB に問い合わせて「使われている」状態を保ちます（1件数えるだけの、軽い問い合わせ）
  const { count: profiles, error: keepAliveError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true });
  if (keepAliveError) console.error("DB に問い合わせできませんでした", keepAliveError);

  const letters = await notifyOpenedLetters(admin).catch(async (error) => {
    await reportError({ source: "cron", message: `手紙の通知: ${String(error)}` });
    return 0;
  });

  const usage = await checkUsage(admin);

  // 最後に、エラーのまとめを送ります（上の処理で起きたエラーも入るように、いちばん最後にします）
  const errors = await sendErrorDigest(admin);

  return NextResponse.json({ ok: true, profiles, letters, usage, errors });
}

// ▼ この1日のあいだに開封日が来た手紙を、届いた人に知らせます。
//   1日1回しか動かないので、25時間ぶんを見ます（少し重ねて、取りこぼさないように）。
//   同じ手紙に二度送らないよう、push_log で印を付けます
async function notifyOpenedLetters(admin: ReturnType<typeof createAdminClient>) {
  const now = new Date();
  const since = new Date(now.getTime() - 25 * 60 * 60 * 1000);
  const { data: letters } = await admin
    .from("time_capsules")
    .select("id, community_id, author_id, to_user")
    .gt("open_at", since.toISOString())
    .lte("open_at", now.toISOString());

  let sent = 0;
  for (const letter of letters ?? []) {
    if (!(await claimPush("letter", letter.id))) continue;

    // 宛先が決まっていればその人、「全員へ」ならコミュニティの書いた人以外
    let recipients: string[] = [];
    if (letter.to_user) {
      recipients = [letter.to_user];
    } else {
      const { data: members } = await admin
        .from("memberships")
        .select("user_id")
        .eq("community_id", letter.community_id)
        .neq("user_id", letter.author_id);
      recipients = members?.map((member) => member.user_id) ?? [];
    }

    // 書いた人をブロックしている人には送りません
    const { data: blockers } = await admin
      .from("blocks")
      .select("blocker")
      .eq("blocked", letter.author_id);
    const blocked = new Set(blockers?.map((row) => row.blocker) ?? []);
    recipients = recipients.filter((userId) => !blocked.has(userId));

    const { data: author } = await admin
      .from("profiles")
      .select("display_name")
      .eq("id", letter.author_id)
      .maybeSingle();

    await sendPush(recipients, {
      title: "未来への手紙が届きました",
      body: `${author?.display_name ?? "メンバー"}さんから`,
      url: `/letters/${letter.id}`,
    });
    sent += 1;
  }
  return sent;
}

// ▼ この1日に記録されたエラーを、運営者にメールでまとめて知らせます。
//   宛先は環境変数 OPS_EMAIL。無ければ送りません（記録は DB に残っています）。
//   30日より前の記録は、ついでに消します（表が大きくなり続けないように）
async function sendErrorDigest(admin: ReturnType<typeof createAdminClient>) {
  await admin
    .from("error_reports")
    .delete()
    .lt("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recent, count } = await admin
    .from("error_reports")
    .select("source, message, path, created_at", { count: "exact" })
    .gt("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20);

  const to = process.env.OPS_EMAIL;
  if (!to || !count) return count ?? 0;

  await sendMail({
    to,
    subject: `【ゆかり】この1日のエラー ${count}件`,
    text: [
      `この1日に ${count} 件のエラーが記録されました（新しいものから20件まで）。`,
      "くわしくは Supabase の Table Editor で error_reports を見てください。",
      "",
      ...(recent ?? []).map(
        (row) => `・[${row.source}] ${row.path ?? ""} ${row.message.slice(0, 200)}（${row.created_at}）`,
      ),
    ].join("\n"),
  });
  return count;
}

// ▼ 容量の見張り。Supabase の無料プランの上限（DB 500MB・保管庫 1GB）の8割を超えたら、
//   error_reports に「usage」として残します（その日のエラーのまとめのメールで届きます）。
//   上限を超えると、書き込めなくなったりプロジェクトが止まったりするので、その前に気づけるようにします。
//   有料プランにしたら、環境変数 DB_LIMIT_MB / STORAGE_LIMIT_MB で上限を変えられます
async function checkUsage(admin: ReturnType<typeof createAdminClient>) {
  const { data, error } = await admin.rpc("app_usage").single<{
    db_bytes: number;
    storage_bytes: number;
  }>();
  if (error || !data) {
    await reportError({ source: "cron", message: `使用量を測れませんでした: ${error?.message ?? ""}` });
    return null;
  }
  const MB = 1024 * 1024;
  const dbLimit = Number(process.env.DB_LIMIT_MB ?? 500) * MB;
  const storageLimit = Number(process.env.STORAGE_LIMIT_MB ?? 1024) * MB;
  const dbRate = data.db_bytes / dbLimit;
  const storageRate = data.storage_bytes / storageLimit;

  if (dbRate > 0.8 || storageRate > 0.8) {
    await reportError({
      source: "usage",
      message: `容量が上限に近づいています（DB ${Math.round(dbRate * 100)}%・保管庫 ${Math.round(storageRate * 100)}%）`,
      detail: { db_bytes: data.db_bytes, storage_bytes: data.storage_bytes },
    });
  }
  return { db: Math.round(dbRate * 100), storage: Math.round(storageRate * 100) };
}
