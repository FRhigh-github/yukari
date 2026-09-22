// プロフィールの編集画面です。
//
// 今の内容をDBから取ってきて、書き換える部分（ProfileForm）に渡します。
// 取得はここ（サーバー側）でやります。画面が出てから取りに行くと、
// 一瞬だけ空の入力欄が見えてしまうためです。

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfileEditPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    return (
      <main className="p-6">
        <p className="text-sm text-stone-500">ログインしてください。</p>
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, birthday, mood")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <main>
      <div className="px-5 pt-3">
        <Link href="/profile" className="text-sm text-stone-500">
          ← 戻る
        </Link>
      </div>

      <ProfileForm
        displayName={profile?.display_name ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
        // 日付の入力欄は "2006-06-18" の形しか受け取らないので、そろえて渡します
        birthday={profile?.birthday ?? ""}
        mood={profile?.mood ?? null}
      />
    </main>
  );
}
