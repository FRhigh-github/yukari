import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CardComposer, {
  type Background,
  type Recipient,
} from "@/components/CardComposer";
import type { CardKind } from "@/components/CardTemplate";

export default async function NewCardPage({
  searchParams,
}: PageProps<"/cards/new">) {
  const { template } = await searchParams;
  const selectedId = typeof template === "string" ? template : null;

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 背景は、作る画面の中でも切り替えられるので全部渡します
  const [{ data: templates }, { data: communities }] = await Promise.all([
    supabase.from("card_templates").select("id, kind, name"),
    supabase.from("communities").select("id, name"),
  ]);

  const backgrounds: Background[] =
    templates?.map((item) => ({
      id: item.id,
      kind: item.kind as CardKind,
      name: item.name,
    })) ?? [];

  if (user === null || backgrounds.length === 0) {
    return (
      <main className="p-6">
        <Link href="/cards" className="text-sm text-stone-500">
          ← 戻る
        </Link>
        <p className="mt-4 text-sm text-stone-500">背景が見つかりませんでした。</p>
      </main>
    );
  }

  // 送れる相手＝自分と同じコミュニティにいる人（自分は除く）
  const communityIds = communities?.map((community) => community.id) ?? [];

  const { data: memberships } = await supabase
    .from("memberships")
    .select("user_id, community_id")
    .in("community_id", communityIds)
    .neq("user_id", user.id);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", memberships?.map((membership) => membership.user_id) ?? []);

  const recipients: Recipient[] =
    memberships?.map((membership) => ({
      userId: membership.user_id,
      communityId: membership.community_id,
      displayName:
        profiles?.find((profile) => profile.id === membership.user_id)
          ?.display_name ?? null,
      communityName:
        communities?.find(
          (community) => community.id === membership.community_id,
        )?.name ?? "",
    })) ?? [];

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 px-5 pt-3">
        <Link href="/cards" className="text-sm text-stone-500">
          ← 戻る
        </Link>
      </div>

      <div className="min-h-0 flex-1">
        <CardComposer
          backgrounds={backgrounds}
          initialBackgroundId={selectedId ?? backgrounds[0].id}
          recipients={recipients}
        />
      </div>
    </div>
  );
}
