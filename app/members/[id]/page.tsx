import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import MemberPosts from "@/components/MemberPosts";
import { getSignedUrls } from "@/lib/signedUrls";
import type { Reaction } from "@/components/ReactionBoard";

// [id] という名前のフォルダにすると、URL の一部を受け取れます。
// 例: /members/abc123 → id は "abc123"
export default async function MemberPage({
  params,
  searchParams,
}: PageProps<"/members/[id]">) {
  const { id } = await params;
  // ?post=<ご報告の id> = プロフィールの一覧で押したご報告。そこからストーリーで開きます
  // ?back=<URL> = 「戻る」を押したときの行き先（コミュニティの設定から来たときなど）。無ければホーム
  // ?view=story = ホームから来たとき。一覧を挟まず、最新のご報告からストーリーで開きます
  const { post: openPostId, back, view } = await searchParams;
  const supabase = await createClient();

  // ▼ 待ち時間の話
  //
  // DB や保管庫への問い合わせは、1回ごとに通信が発生します。
  // await を縦に並べると「1つ終わってから次」になるので、回数ぶん待たされます。
  // お互いを必要としないものは Promise.all でまとめて出し、
  // 「次に進むのに必要なもの」が揃った時点で先へ進みます。

  // 1回目：この4つは、どれも id だけで取れます
  // single() = 1件だけ取ってくる（配列ではなく、そのものが返ります）
  // getCurrentUserId = 自分か確かめるため（自分のご報告だけ、長押しで消せるようにします）。通信なしで済みます
  const [{ data: profile }, { data: posts }, { data: reactions }, myId] =
    await Promise.all([
      supabase.from("profiles").select("display_name, avatar_url").eq("id", id).single(),
      // 列は使うものだけ並べます。
      // select("*") だと、誰かが列を足した瞬間に、
      // 知らないうちに取ってくる量が増えます。
      // limit は、報告が増えたときに一気に読み込まないための上限です。
      supabase
        .from("posts")
        .select("id, title, body, image_url, created_at, community_id")
        .eq("author_id", id)
        .order("created_at", { ascending: false })
        .limit(30),

      // ▼ 反応も、ここで一緒に取ります。
      //   前は「報告を取る → その id で反応を取る」と2段階でしたが、
      //   posts!inner(author_id) と書くと
      //   「その報告を書いた人」でDB側が絞ってくれるので、待たずに済みます。
      //   !inner = 結びつく報告が無い反応は返さない、という意味です。
      supabase
        .from("post_reactions")
        .select("id, post_id, from_user, drawing_url, posts!inner(author_id)")
        .eq("posts.author_id", id)
        .order("created_at", { ascending: false }),
      getCurrentUserId(supabase),
    ]);

  // posts に入っているのは「保管庫のどこに置いたか」という場所だけです。
  // 保管庫は非公開なので、見るには期限付きの URL を発行してもらいます（3600秒＝1時間）。
  // http で始まるものはデバッグ用データの外部URLなので、発行の対象から外します。
  const imagePaths =
    posts
      ?.filter((post) => post.image_url && !post.image_url.startsWith("http"))
      .map((post) => post.image_url) ?? [];

  // 描いた人の名前を引くために、profiles をまとめて取ります
  const reactionUserIds = Array.from(
    new Set(reactions?.map((reaction) => reaction.from_user) ?? []),
  );

  // 手書きは drawings という別の保管庫に入っているので、こちらも URL を発行します
  const drawingPaths = reactions?.map((reaction) => reaction.drawing_url) ?? [];

  // 2回目：この3つは、1回目の結果がそろえば同時に出せます
  //   写真のURLは lib/signedUrls.ts で作ります。同じ写真には6日間同じURLを返すので、
  //   2回目からはブラウザが前にダウンロードした写真をそのまま使えます。
  //   渡している場所は、どれも RLS を通して取ってきたものです（そこの約束を参照）
  const [findSignedImage, { data: reactionUsers }, findDrawingUrl] =
    await Promise.all([
      getSignedUrls("posts", imagePaths),
      supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", reactionUserIds),
      getSignedUrls("drawings", drawingPaths),
    ]);

  // 置き場所から URL を探す。find() = 条件に合う最初の1件を返す
  const findImageUrl = (path: string | null) => {
    if (!path) return null;
    // デバッグ用データは最初から URL なので、そのまま使います
    if (path.startsWith("http")) return path;
    return findSignedImage(path);
  };

  // 報告1件ぶんの反応を、表示に使う形にして返します
  const getReactions = (postId: string): Reaction[] =>
    reactions
      ?.filter((reaction) => reaction.post_id === postId)
      .map((reaction) => ({
        id: reaction.id,
        imageUrl: findDrawingUrl(reaction.drawing_url),
        authorName:
          reactionUsers?.find((user) => user.id === reaction.from_user)
            ?.display_name ?? null,
      })) ?? [];

  // ▼ インスタのリールの一覧のように、縦長の写真を3列に並べます（MemberPosts）。
  //   押すと、そこからストーリー（StoryViewer）で大きく見られます。
  return (
    <MemberPosts
      authorId={id}
      isMine={myId === id}
      openPostId={typeof openPostId === "string" ? openPostId : null}
      startInStory={view === "story"}
      // アプリの中の画面（"/" で始まり、"//" ではない）だけを受け付けます。
      // よそのサイトの URL を入れられて、戻るで飛ばされるのを防ぐためです
      backHref={typeof back === "string" && back.startsWith("/") && !back.startsWith("//") ? back : "/"}
      authorName={profile?.display_name ?? "名無し"}
      avatarUrl={profile?.avatar_url ?? null}
      posts={
        posts?.map((post) => ({
          id: post.id,
          title: post.title,
          body: post.body,
          createdAt: post.created_at,
          imageUrl: findImageUrl(post.image_url),
          communityId: post.community_id,
          reactions: getReactions(post.id),
        })) ?? []
      }
    />
  );
}
