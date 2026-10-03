// DB のテストのための道具です。
//
// 本物の Supabase は使わず、手元で動く Postgres（PGlite）に、
// Supabase が最初から持っている部分（auth / storage など）の最小限のまねを作ってから、
// supabase/01_schema.sql を流します。
//
// 2つの作り方で、同じテストを通します。
//   fresh    … 01_schema.sql で新しく作った DB（新しく作り直すときの形）
//   migrated … 前の 01_schema.sql（tests/fixtures）に migrations/ を順に流した DB（本番の形）
// どちらでも同じ結果になることで、01_schema.sql と migrations/ がずれていないことも確かめられます。
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
export const read = (path: string) => readFileSync(`${ROOT}${path}`, "utf8");

// Supabase のまね。auth.uid() は「いまログインしている人」を、テストで決めた値から返します
const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create schema storage;
grant usage on schema public, auth, storage to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key, instance_id uuid, aud text, role text, email text,
  raw_user_meta_data jsonb, raw_app_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz, email_confirmed_at timestamptz,
  encrypted_password text, confirmation_token text, recovery_token text,
  email_change text, email_change_token_new text, email_change_token_current text,
  phone_change text, phone_change_token text, reauthentication_token text
);
create table auth.identities (id uuid);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_user::text $$;
grant execute on all functions in schema auth to anon, authenticated, service_role;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid default gen_random_uuid(), bucket_id text, name text,
  owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.filename(name text) returns text language sql immutable as $$
  select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;
grant execute on all functions in schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to anon, authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to anon, authenticated, service_role;
create publication supabase_realtime;
`;

export type Db = PGlite;
export type User = { id: string; email?: string };

async function base(schemaSql: string) {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(schemaSql);
  return db;
}

// 新しく作った DB
export async function makeFreshDb() {
  return base(read("supabase/01_schema.sql"));
}

// 本番の形：前の 01_schema.sql に、migrations/ を名前の順に流したもの
export async function makeMigratedDb() {
  const db = await base(read("tests/fixtures/schema_before_migrations.sql"));
  const files = readdirSync(`${ROOT}supabase/migrations`)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    await db.exec(read(`supabase/migrations/${file}`));
  }
  return db;
}

export const DB_KINDS = [
  ["fresh", makeFreshDb],
  ["migrated", makeMigratedDb],
] as const;

// user としてログインしている状態で SQL を流します。失敗したら error にエラー文が入ります
export async function as(db: Db, user: User | null, sql: string, params: unknown[] = []) {
  const claims = JSON.stringify(
    user ? { sub: user.id, email: user.email ?? "x@example.com", role: "authenticated" } : {},
  );
  await db.exec(`set role ${user ? "authenticated" : "anon"}`);
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [claims]);
  try {
    const result = await db.query<Record<string, unknown>>(sql, params);
    return { rows: result.rows, error: null as string | null };
  } catch (error) {
    return { rows: [] as Record<string, unknown>[], error: (error as Error).message };
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claims', '', false)`);
  }
}

// テストで使う人とコミュニティを入れます（管理者として。RLS を通りません）
export async function addUsers(db: Db, ...users: User[]) {
  for (const user of users) {
    await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, '{}')`, [
      user.id,
      user.email ?? `${user.id.slice(0, 8)}@example.com`,
    ]);
  }
}

export async function addCommunity(db: Db, id: string, members: [User, "owner" | "member"][]) {
  await db.query(`insert into communities (id, name, invite_code) values ($1, 'c', $2)`, [
    id,
    `T${id.slice(-8)}`,
  ]);
  let order = members.length;
  for (const [user, role] of members) {
    // 入った順が分かるよう、前の人ほど古い日時にします
    await db.query(
      `insert into memberships (user_id, community_id, role, joined_at) values ($1, $2, $3, now() - ($4 || ' days')::interval)`,
      [user.id, id, role, String(order)],
    );
    order -= 1;
  }
}

// アプリが作る形の、保管庫の場所（<id>/<ランダムな id>.jpg）
export const fileOf = (user: User, ext = "jpg") => `${user.id}/${crypto.randomUUID()}.${ext}`;

export const user = (n: number): User => ({
  id: `${String(n).padStart(8, "0")}-0000-4000-8000-000000000000`,
});
export const communityId = (n: number) => `cccccccc-0000-4000-8000-${String(n).padStart(12, "0")}`;
