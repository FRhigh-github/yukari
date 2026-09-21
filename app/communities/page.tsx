import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CommunityActions from "@/components/CommunityActions";

export default async function CommunitiesPage({
  searchParams,
}: PageProps<"/communities">) {
  // /communities?open=create のように来たら、そのフォームを最初から開きます
  const { open } = await searchParams;
  const initialOpen =
    open === "create" || open === "join" ? open : null;

  const supabase = await createClient();

  // RLS のおかげで、自分が入っているコミュニティだけが返ります
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name");

  return (
    <main className="space-y-6 p-6">
      <h1 className="text-xl font-bold text-stone-800">コミュニティ</h1>

      {communities?.length === 0 ? (
        <p className="text-sm text-stone-500">まだどこにも入っていません。</p>
      ) : (
        <ul className="space-y-2">
          {communities?.map((community) => (
            <li key={community.id}>
              <Link
                href={`/communities/${community.id}`}
                className="flex h-12 items-center justify-between rounded-xl border border-stone-200 px-4 text-sm text-stone-700"
              >
                {community.name}
                <span className="text-stone-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CommunityActions initialOpen={initialOpen} />
    </main>
  );
}
