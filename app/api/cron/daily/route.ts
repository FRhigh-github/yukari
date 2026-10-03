// 1日1回、Vercel が自動で呼ぶ処理です（vercel.json の crons。毎朝9時）。GET /api/cron/daily
//
// ▼ やること
//   ・DB に軽く問い合わせて、Supabase の無料プランが「使われていない」と止まらないようにする
//   ・開封日が来た未来への手紙を、届いた人のスマホに知らせる
//
// ▼ 呼べるのは Vercel だけ
//   Vercel は、環境変数 CRON_SECRET の値を「Authorization: Bearer ...」に付けて呼んでくれます。
//   それが合わなければ断ります（よそから何度も呼ばれて、通知を送らされないように）。

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimPush, sendPush } from "@/lib/push";

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

  const letters = await notifyOpenedLetters(admin);

  return NextResponse.json({ ok: true, profiles, letters });
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
