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
        .select("id, title, image_url, author_id, community_id")
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

  // 保管庫に入れた画像は、見るのに期限付きの URL が要ります。
  // ただしデバッグ用データは最初から URL なので、その場合はそのまま使います。
  const imagePath = post?.image_url ?? null;
  const isExternal = imagePath?.startsWith("http") ?? false;

  const { data: signed } =
    imagePath !== null && !isExternal
      ? await supabase.storage.from("posts").createSignedUrl(imagePath, 3600)
      : { data: null };

  const postImageUrl = isExternal ? imagePath : (signed?.signedUrl ?? null);

  return (
    <DrawingPad
      // 反応の相手＝報告を書いた人の画面が、元いた場所です
      backHref={post ? `/members/${post.author_id}` : "/"}
      postId={post?.id ?? null}
      communityId={post?.community_id ?? null}
      authorName={author?.display_name ?? null}
      postImageUrl={postImageUrl}
    />
  );
}
