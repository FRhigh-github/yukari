import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InviteCode from "@/components/InviteCode";
import CommunitySettings from "@/components/CommunitySettings";
import CommunityIcon from "@/components/CommunityIcon";

export default async function CommunityPage({
  params,
}: PageProps<"/communities/[id]">) {
  const { id } = await params;
  const supabase = await createClient();

  // 自分が作成者かどうかの判定に使います
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // メンバーでなければ、RLS が止めるので null が返ります。
  // maybeSingle() は「0件でもエラーにしない single()」です。
  const { data: community } = await supabase
    .from("communities")
    .select("id, name, invite_code, created_by, icon_url")
    .eq("id", id)
    .maybeSingle();

  if (community === null) {
    return (
      <main className="p-6 pb-24">
        <Link href="/" className="text-sm text-stone-500">
          ← ホーム
        </Link>
        <p className="mt-4 text-sm text-stone-500">
          このコミュニティは見つかりませんでした。
        </p>
      </main>
    );
  }

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("community_id", id);

  const memberIds = memberships?.map((membership) => membership.user_id) ?? [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", memberIds);

  // 「この人は owner か」を探すための小さな関数
  const isOwner = (userId: string) =>
    memberships?.find((membership) => membership.user_id === userId)?.role ===
    "owner";

  return (
    <main className="space-y-8 p-6 pb-24">
      <div>
        {/* この画面には、ホームの ⚙ から来ます。
            なので戻り先も、そのコミュニティを開いたホームにします。
            ?c= を付けておくと、見ていた班のまま戻れます。 */}
        <Link href={`/?c=${community.id}`} className="text-sm text-stone-500">
          ← ホーム
        </Link>
      </div>

      {/* アイコンと名前。招待コードより先に置いています。
          「今どのコミュニティの設定を開いているか」を最初に示すためです。 */}
      <CommunityIcon
        communityId={community.id}
        name={community.name}
        iconUrl={community.icon_url}
      />

      <section>
        <h2 className="mb-2 text-sm font-bold text-stone-600">招待コード</h2>
        <InviteCode code={community.invite_code} communityName={community.name} />
        <p className="mt-2 text-xs text-stone-400">
          このコードを渡すと、相手はこのコミュニティに参加できます。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-stone-600">
          メンバー（{memberIds.length}人）
        </h2>

        <ul className="space-y-3">
          {profiles?.map((profile) => (
            <li key={profile.id} className="flex items-center gap-3">
              {/* アイコンは背景画像で置きます（読み込み失敗時に印が出ないため） */}
              <div
                className="h-9 w-9 shrink-0 rounded-full bg-stone-200 bg-cover bg-center"
                style={
                  profile.avatar_url
                    ? { backgroundImage: `url("${encodeURI(profile.avatar_url)}")` }
                    : undefined
                }
              />
              <Link
                href={`/members/${profile.id}`}
                className="text-sm text-stone-700"
              >
                {profile.display_name ?? "名無し"}
              </Link>
              {isOwner(profile.id) ? (
                <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500">
                  作成者
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <CommunitySettings
        communityId={community.id}
        currentName={community.name}
        isOwner={community.created_by === user?.id}
      />
    </main>
  );
}
