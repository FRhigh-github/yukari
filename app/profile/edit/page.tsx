// プロフィールの編集画面です。
//
// 今の内容をDBから取ってきて、書き換える部分（ProfileForm）に渡します。
// 取得はここ（サーバー側）でやります。画面が出てから取りに行くと、
// 一瞬だけ空の入力欄が見えてしまうためです。

import Link from "next/link";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import ProfileForm from "@/components/ProfileForm";

export default async function ProfileEditPage() {
  const supabase = await createClient();

  // 本人確認。通信なしで済みます（lib/supabase/server.ts の getCurrentUserId）
  const userId = await getCurrentUserId(supabase);
  const user = userId === null ? null : { id: userId };

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

      {/* ▼ ログインの鍵（メールアドレス・パスワード）を変える入口。
          プロフィールの中身とは別の画面です。変えるときに確認のメールが要るなど、手順が違うためです */}
      <nav className="space-y-2 px-4 pb-24">
        <Link
          href="/account/email"
          className="flex h-12 items-center justify-between rounded-xl bg-white px-4 text-sm text-stone-700 ring-1 ring-kin/30"
        >
          メールアドレスを変える
          <span aria-hidden="true" className="text-kin">›</span>
        </Link>
        <Link
          href="/reset-password"
          className="flex h-12 items-center justify-between rounded-xl bg-white px-4 text-sm text-stone-700 ring-1 ring-kin/30"
        >
          パスワードを変える
          <span aria-hidden="true" className="text-kin">›</span>
        </Link>
      </nav>
    </main>
  );
}
