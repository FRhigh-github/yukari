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
      <main className="min-h-full bg-[#faf9f6] p-4 pb-[calc(env(safe-area-inset-bottom)+8rem)]">
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
    // 色はホームにそろえています（生成りの背景・金の見出しと線）。
    // pb = 下タブ（約110px）に、いちばん下のボタンが隠れないための余白
    <main className="min-h-full space-y-8 bg-[#faf9f6] p-4 pb-[calc(env(safe-area-inset-bottom)+8rem)]">
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
        <h2 className="mb-2 text-sm font-bold text-kin">招待コード</h2>
        <InviteCode code={community.invite_code} communityName={community.name} />
        <p className="mt-2 text-xs text-stone-400">
          このコードを渡すと、相手はこのコミュニティに参加できます。
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-kin">
          メンバー（{memberIds.length}人）
        </h2>

        <ul className="divide-y divide-kin/20 rounded-2xl border border-kin/30 bg-white px-4">
          {profiles?.map((profile) => (
            <li key={profile.id} className="flex min-h-14 items-center gap-3">
              {/* アイコンは背景画像で置きます（読み込み失敗時に印が出ないため） */}
              <div
                className="h-9 w-9 shrink-0 rounded-full bg-stone-200 bg-cover bg-center ring-1 ring-kin/50"
                style={
                  profile.avatar_url
                    ? { backgroundImage: `url("${encodeURI(profile.avatar_url)}")` }
                    : undefined
                }
              />
              <Link
                href={`/members/${profile.id}`}
                // flex-1 と py-3 で、名前の行全体を押せるようにしています（44px 以上）
                className="flex-1 py-3 text-[17px] text-stone-800"
              >
                {profile.display_name ?? "名無し"}
              </Link>
              {isOwner(profile.id) ? (
                <span className="rounded-full border border-kin/60 px-2 py-0.5 text-[10px] text-kin">
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
