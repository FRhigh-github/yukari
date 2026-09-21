import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CommunityCreateForm from "@/components/CommunityCreateForm";
import CommunityJoinForm from "@/components/CommunityJoinForm";

export default async function CommunitiesPage() {
  const supabase = await createClient();

  // RLS のおかげで、自分が入っているコミュニティだけが返ります
  const { data: communities } = await supabase
    .from("communities")
    .select("id, name");

  return (
    <main className="space-y-8 p-6">
      <section>
        <h1 className="mb-3 text-xl font-bold text-stone-800">コミュニティ</h1>

        {communities?.length === 0 ? (
          <p className="text-sm text-stone-500">まだどこにも入っていません。</p>
        ) : (
          <ul className="space-y-2">
            {communities?.map((community) => (
              <li key={community.id}>
                <Link
                  href={`/communities/${community.id}`}
                  className="flex items-center justify-between rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700"
                >
                  {community.name}
                  <span className="text-stone-300">›</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-stone-600">新しく作る</h2>
        <CommunityCreateForm />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-bold text-stone-600">
          招待コードで参加する
        </h2>
        <CommunityJoinForm />
      </section>
    </main>
  );
}
