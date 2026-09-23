// アカウント情報を入力する画面です。
//
// メールで登録した人も、Googleで入った人も、必ずここを通ります。
// Googleの場合は名前とアイコンをGoogleがくれるので、
// それを最初から入れておいて、確認するだけで進めるようにします。

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient, getCurrentUserId } from "@/lib/supabase/server";
import SetupForm from "@/components/SetupForm";
import KnotMark from "@/components/KnotMark";

export default async function SetupPage({
  searchParams,
}: PageProps<"/setup">) {
  // ?new=1 で来たら「Googleで新しく作られた人」です
  const { new: isNew } = await searchParams;

  const supabase = await createClient();

  // 本人確認。通信なしで済みます（lib/supabase/server.ts の getCurrentUserId）
  const userId = await getCurrentUserId(supabase);
  const user = userId === null ? null : { id: userId };

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
      <KnotMark />

      {/* ▼ Googleで初めて入った人への知らせ。
          「ログインしたつもりが、新しく作られていた」に気づいてもらうためです。
          前に使っていたアカウントがある人は、ここで引き返せます。 */}
      {isNew === "1" ? (
        <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-stone-700">
          このGoogleアカウントは、ゆかりでは初めてです。
          <br />
          <span className="font-bold">新しくアカウントを作りました。</span>
          <br />
          別のアカウントをお持ちなら、
          <Link href="/login" className="underline">
            ログイン画面
          </Link>
          から入り直してください。
        </div>
      ) : null}

      <div>
        <h1 className="text-xl font-bold text-stone-800">
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
