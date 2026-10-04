// 何かを送ったあとに、相手のスマホへ通知を出す処理です。POST /api/notify  { kind, id }
//   kind = "post"     … ご報告を書いた → そのコミュニティのみんなへ
//          "card"     … カードを送った → 受け取った人へ
//          "reaction" … お祝いを描いた → ご報告を書いた人へ
//
// 書いた画面（PostForm など）が、書き終わったあとに呼びます（lib/notify.ts）。
// ▼ いたずらで通知を送らせないために
//   ・呼んだ人が、本当にそれを書いた本人か（RLS を通して読んだ行で確かめます）
//   ・書いてから10分以内か
//   ・同じものについて、まだ送っていないか（push_log）
//   を全部確かめてから送ります。

import { NextResponse } from "next/server";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { claimPush, sendPush, type PushMessage } from "@/lib/push";
import { isUuid } from "@/lib/isUuid";

const FRESH_MS = 10 * 60 * 1000;
const isFresh = (at: string) => Date.now() - new Date(at).getTime() < FRESH_MS;

export async function POST(request: Request) {
  const supabase = await createClient();
  const me = await getCurrentUserId(supabase);
  const body = await request.json().catch(() => null);
  const kind = body?.kind;
  const id = body?.id;
  if (me === null || !isUuid(id) || !["post", "card", "reaction"].includes(kind)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: sender } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", me)
    .maybeSingle();
  const name = sender?.display_name ?? "メンバー";

  let recipients: string[] = [];
  let message: PushMessage | null = null;

  if (kind === "post") {
    const { data: post } = await supabase
      .from("posts")
      .select("id, author_id, community_id, title, created_at")
      .eq("id", id)
      .maybeSingle();
    if (post && post.author_id === me && isFresh(post.created_at)) {
      const { data: members } = await admin
        .from("memberships")
        .select("user_id")
        .eq("community_id", post.community_id)
        .neq("user_id", me);
      recipients = members?.map((member) => member.user_id) ?? [];
      message = {
        title: `${name}さんからご報告`,
        body: post.title,
        url: `/members/${me}?post=${post.id}`,
      };
    }
  }

  if (kind === "card") {
    const { data: card } = await supabase
      .from("card_sends")
      .select("id, from_user, to_user, sent_at")
      .eq("id", id)
      .maybeSingle();
    if (card && card.from_user === me && isFresh(card.sent_at)) {
      recipients = [card.to_user];
      message = {
        title: `${name}さんからカードが届きました`,
        body: "ふみばこで見られます",
        url: "/cards/inbox",
      };
    }
  }

  if (kind === "reaction") {
    const { data: reaction } = await supabase
      .from("post_reactions")
      .select("id, from_user, post_id, created_at, posts(author_id, title)")
      .eq("id", id)
      .maybeSingle();
    // posts(...) は、つながっているご報告1件です（型の上では配列に見えるので、形を決めて受け取ります）
    const post = reaction?.posts as unknown as { author_id: string; title: string } | null;
    if (
      reaction &&
      post &&
      reaction.from_user === me &&
      isFresh(reaction.created_at) &&
      post.author_id !== me
    ) {
      recipients = [post.author_id];
      message = {
        title: `${name}さんからお祝いが届きました`,
        body: post.title,
        url: `/members/${post.author_id}?post=${reaction.post_id}`,
      };
    }
  }

  if (message === null || recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  // 送る相手のうち、自分をブロックしている人には送りません
  const { data: blockers } = await admin
    .from("blocks")
    .select("blocker")
    .eq("blocked", me)
    .in("blocker", recipients);
  const blocked = new Set(blockers?.map((row) => row.blocker) ?? []);
  recipients = recipients.filter((userId) => !blocked.has(userId));

  if (!(await claimPush(kind, id))) {
    return NextResponse.json({ ok: true, sent: 0 });
  }
  await sendPush(recipients, message);
  return NextResponse.json({ ok: true, sent: recipients.length });
}
