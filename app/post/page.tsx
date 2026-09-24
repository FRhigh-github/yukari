import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/PostForm";

// コミュニティ一覧はサーバー側で取って、フォームに渡します。
// ブラウザ側で取りに行くと、画面が出たあとに選択肢が増えることになり、
// React からも「表示してすぐ中身を変えている」と警告されます。
//
// ?c=<コミュニティの id> = ホームで見ていたコミュニティ。最初からそれを選んでおきます
export default async function PostPage({ searchParams }: PageProps<"/post">) {
  const { c } = await searchParams;
  const supabase = await createClient();

  // RLS のおかげで、自分が入っているコミュニティだけが返ります。
  // 並び順を決めておかないと、開くたびに順番が変わることがあるので、作った順にします
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name")
    .order("created_at", { ascending: true });

  const list = communities ?? [];
  // 指定された id が自分のものでなければ、一番上を選びます
  const initialId =
    list.find((community) => community.id === c)?.id ?? list[0]?.id ?? "";

  return <PostForm communities={list} initialCommunityId={initialId} />;
}
