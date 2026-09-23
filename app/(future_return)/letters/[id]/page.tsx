// 届いた「未来への手紙」を読む画面です。/letters/<手紙の id>
//
// ▼ 前は画面が出てから、手紙 → 画像 と2回に分けて取りに行っていたので、
//   「手紙を開いています...」のあとに、画像が遅れて出ていました。
//   今はサーバーで全部そろえてから出すので、開いた時点で手紙が全部見えます。
//
// ▼ 何を見せるか
//   time_capsules は RLS で「開封日を過ぎていて、宛先が自分か全員」の手紙と、
//   自分が書いた手紙（まだ開かないものも）だけが返ってきます。
//   それを開封日の新しい順に並べて、左右に送って読めるようにします（LetterViewer）。

import { createClient } from "@/lib/supabase/server";
import { getSignedUrls } from "@/lib/signedUrls";
import LetterViewer from "@/components/LetterViewer";

export default async function LetterDetailPage({
  params,
}: PageProps<"/letters/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // 1回目：読める手紙の一覧
  const { data: letters } = await supabase
    .from("time_capsules")
    .select("id, body, image_url, open_at, author_id")
    .order("open_at", { ascending: false });

  const list = letters ?? [];

  // 2回目：この3つは、手紙の一覧がそろえば同時に出せます
  //   ・紙の画像のURL（lib/signedUrls.ts。同じ手紙には同じURLを返すので、2回目からすぐ出ます）
  //   ・その手紙にイベント（日程調整）が付いているか。付いていないのにボタンを出すと、
  //     押しても「イベントが見つかりません」になってしまうため、先に確かめます
  //   ・書いた人の名前
  const imagePaths = list
    .map((letter) => letter.image_url)
    .filter((path): path is string => path !== null && !path.startsWith("http"));

  const [findImageUrl, { data: events }, { data: authors }] = await Promise.all([
    getSignedUrls("drawings", imagePaths),
    supabase
      .from("events")
      .select("id, capsule_id")
      .in("capsule_id", list.map((letter) => letter.id)),
    supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(new Set(list.map((letter) => letter.author_id)))),
  ]);

  return (
    <LetterViewer
      initialId={id}
      letters={list.map((letter) => ({
        id: letter.id,
        body: letter.body,
        openAt: letter.open_at,
        imageUrl: letter.image_url?.startsWith("http")
          ? letter.image_url
          : findImageUrl(letter.image_url),
        eventId: events?.find((event) => event.capsule_id === letter.id)?.id ?? null,
        authorName:
          authors?.find((author) => author.id === letter.author_id)?.display_name ?? null,
      }))}
    />
  );
}
