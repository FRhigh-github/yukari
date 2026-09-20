// お祝いの手書きを描く画面。/draw?post=xxx の形で来ます。

import { createClient } from "@/lib/supabase/server";
import DrawingPad from "@/components/DrawingPad";

// searchParams = URL の ? より後ろ。await で中身が届くのを待ちます。
export default async function DrawPage({ searchParams }: PageProps<"/draw">) {
  const { post: postId } = await searchParams;

  const supabase = await createClient();

  // ?post=a&post=b と2回書かれると配列になるので、文字列のときだけ使います
  const hasPostId = typeof postId === "string";

  const { data: post } = hasPostId
    ? await supabase
        .from("posts")
        .select("id, title, image_url, author_id")
        .eq("id", postId)
        .single()
    : { data: null };

  // 名前は別に取ります。まとめて取ると「1件」か「配列」か分かりにくいためです。
  const { data: author } = post
    ? await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", post.author_id)
        .single()
    : { data: null };

  // 画像の URL を作る（1時間だけ見られる URL）
  const { data: signed } = post?.image_url
    ? await supabase.storage.from("posts").createSignedUrl(post.image_url, 3600)
    : { data: null };

  return (
    <DrawingPad
      authorName={author?.display_name ?? null}
      postImageUrl={signed?.signedUrl ?? null}
    />
  );
}
