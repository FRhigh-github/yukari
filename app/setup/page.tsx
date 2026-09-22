// アカウント情報を入力する画面です。
//
// メールで登録した人も、Googleで入った人も、必ずここを通ります。
// Googleの場合は名前とアイコンをGoogleがくれるので、
// それを最初から入れておいて、確認するだけで進めるようにします。

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SetupForm from "@/components/SetupForm";

export default async function SetupPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, birthday")
    .eq("id", user.id)
    .maybeSingle();

  // もう入力が済んでいる人が開いたら、ホームへ戻します。
  // 誕生日は Google がくれないので、ここが「済んだかどうか」の目印になります。
  if (profile?.birthday) redirect("/");

  return (
    <main className="flex h-full flex-col justify-center gap-5 p-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-800">
          アカウント情報を入力
        </h1>
        <p className="mt-1 text-xs text-stone-500">あとから変えられます</p>
      </div>

      <SetupForm
        // Googleで入った場合、名前とアイコンは既に入っています
        initialName={profile?.display_name ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? null}
      />
    </main>
  );
}
