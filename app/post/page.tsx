import { createClient } from "@/lib/supabase/server";
import PostForm from "@/components/PostForm";

// コミュニティ一覧はサーバー側で取って、フォームに渡します。
// ブラウザ側で取りに行くと、画面が出たあとに選択肢が増えることになり、
// React からも「表示してすぐ中身を変えている」と警告されます。
export default async function PostPage() {
  const supabase = await createClient();

  // RLS のおかげで、自分が入っているコミュニティだけが返ります
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name");

  return <PostForm communities={communities ?? []} />;
}