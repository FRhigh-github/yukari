// DB の許可（RLS）と関数のテストです。
// 「誰に何を見せるか・させるか」は DB が決めているので、ここが壊れると穴になります。
// 新しく作った DB と、本番の形の DB（migrations を流したもの）の両方で、同じことを確かめます。
import { beforeAll, describe, expect, it } from "vitest";
import { DB_KINDS, addCommunity, addUsers, as, communityId, fileOf, read, user, type Db } from "./harness";

describe.each(DB_KINDS)("%s", (_label, makeDb) => {
  let db: Db;
  beforeAll(async () => {
    db = await makeDb();
  });

  it("写真の場所は、自分のフォルダのものしか入れられない", async () => {
    const [a, b] = [user(101), user(102)];
    const c = communityId(101);
    await addUsers(db, a, b);
    await addCommunity(db, c, [[a, "owner"], [b, "member"]]);
    const post = (image: string) =>
      as(db, a, `insert into posts (author_id, community_id, title, image_url) values ($1,$2,'t',$3) returning id`, [a.id, c, image]);
    expect((await post(fileOf(a))).error).toBeNull();
    expect((await post(fileOf(b))).error).not.toBeNull();
    expect((await post("https://evil.example/x.jpg")).error).not.toBeNull();
    expect((await post(`${a.id}/../${b.id}/x.jpg`)).error).not.toBeNull();
  });

  it("招待コードは DB が10文字で作り、外れを20回試すと入れない", async () => {
    const [a, b] = [user(201), user(202)];
    await addUsers(db, a, b);
    const made = await as(db, a, `select create_community('家族') as id`);
    const id = made.rows[0].id as string;
    const code = (await db.query<{ invite_code: string }>(`select invite_code from communities where id = $1`, [id])).rows[0].invite_code;
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/);
    for (let i = 0; i < 20; i += 1) await as(db, b, `select join_community($1)`, [`WRONG${i}`]);
    expect((await as(db, b, `select join_community($1) as id`, [code])).rows[0].id).toBeNull();
  });

  it("プロフィールのアイコンには、決まった置き場所の URL しか入れられない", async () => {
    const [a, b] = [user(301), user(302)];
    await addUsers(db, a, b);
    const set = (url: string | null) => as(db, a, `update profiles set avatar_url = $1 where id = $2 returning id`, [url, a.id]);
    const base = "https://abcdefgh.supabase.co/storage/v1/object/public/avatars/";
    expect((await set(`${base}${a.id}/${crypto.randomUUID()}.jpg`)).rows).toHaveLength(1);
    expect((await set("https://lh3.googleusercontent.com/a/xyz=s96-c")).rows).toHaveLength(1);
    expect((await set(`${base}${b.id}/${crypto.randomUUID()}.jpg`)).error).not.toBeNull();
    expect((await set("https://evil.example/pixel.gif")).error).not.toBeNull();
  });

  it("思い出ログインの申請は、本人と、同じコミュニティにいる人に見える", async () => {
    const [t, m1, m2, x] = [user(401), user(402), user(403), user(404)];
    const [c1, c2] = [communityId(401), communityId(402)];
    await addUsers(db, t, m1, m2, x);
    await addCommunity(db, c1, [[t, "member"], [m1, "owner"]]);
    await addCommunity(db, c2, [[t, "member"], [m2, "owner"]]);
    const req = crypto.randomUUID();
    await db.query(`insert into recovery_requests (id, target_user, community_id) values ($1,$2,$3)`, [req, t.id, c1]);
    for (const u of [t, m1, m2]) {
      expect((await as(db, u, `select id from recovery_requests where id = $1`, [req])).rows).toHaveLength(1);
    }
    expect((await as(db, x, `select id from recovery_requests where id = $1`, [req])).rows).toHaveLength(0);
    expect((await as(db, m2, `insert into recovery_vetoes (request_id, user_id) values ($1,$2)`, [req, m2.id])).error).toBeNull();
  });

  it("ご報告は1時間に20件まで", async () => {
    const a = user(501);
    const c = communityId(501);
    await addUsers(db, a);
    await addCommunity(db, c, [[a, "owner"]]);
    let ok = 0;
    for (let i = 0; i < 21; i += 1) {
      const r = await as(db, a, `insert into posts (author_id, community_id, title, image_url) values ($1,$2,'t',$3)`, [a.id, c, fileOf(a)]);
      if (r.error === null) ok += 1;
    }
    expect(ok).toBe(20);
  });

  it("宛先が特定の人の手紙の日程調整は、ほかの人に見えない", async () => {
    const [w, to, o] = [user(601), user(602), user(603)];
    const c = communityId(601);
    await addUsers(db, w, to, o);
    await addCommunity(db, c, [[w, "owner"], [to, "member"], [o, "member"]]);
    const cap = crypto.randomUUID();
    await db.query(
      `insert into time_capsules (id, community_id, author_id, to_user, sealed_at, open_at) values ($1,$2,$3,$4, now() - interval '2 days', now() - interval '1 day')`,
      [cap, c, w.id, to.id],
    );
    await db.query(`insert into events (capsule_id, community_id, created_by, name) values ($1,$2,$3,'e')`, [cap, c, w.id]);
    expect((await as(db, to, `select id from events where capsule_id = $1`, [cap])).rows).toHaveLength(1);
    expect((await as(db, o, `select id from events where capsule_id = $1`, [cap])).rows).toHaveLength(0);
  });

  it("文字数・誕生日の年・手紙のリンクの決まり", async () => {
    const a = user(701);
    const c = communityId(701);
    await addUsers(db, a);
    await addCommunity(db, c, [[a, "owner"]]);
    const post = (body: string) =>
      as(db, a, `insert into posts (author_id, community_id, title, body, image_url) values ($1,$2,'t',$3,$4)`, [a.id, c, body, fileOf(a)]);
    expect((await post("あ".repeat(2000))).error).toBeNull();
    expect((await post("あ".repeat(2001))).error).not.toBeNull();
    expect((await as(db, a, `update profiles set birthday = '1995-06-18' where id = $1`, [a.id])).error).not.toBeNull();
    const letter = (links: string[]) =>
      as(db, a, `insert into time_capsules (community_id, author_id, open_at, links) values ($1,$2, now() + interval '1 day', $3)`, [c, a.id, links]);
    expect((await letter(["https://example.com"])).error).toBeNull();
    expect((await letter(["javascript:alert(1)"])).error).not.toBeNull();
  });

  it("報告・ブロック・作成者がメンバーを外す", async () => {
    const [own, a, b] = [user(801), user(802), user(803)];
    const c = communityId(801);
    await addUsers(db, own, a, b);
    await addCommunity(db, c, [[own, "owner"], [a, "member"], [b, "member"]]);
    const post = (await as(db, b, `insert into posts (author_id, community_id, title, image_url) values ($1,$2,'b',$3) returning id`, [b.id, c, fileOf(b)])).rows[0].id;
    expect((await as(db, a, `select report_user($1, 'こまります') n`, [b.id])).rows[0].n).toBe(1);
    expect((await as(db, own, `select id from reports where reported_user = $1`, [b.id])).rows).toHaveLength(1);
    expect((await as(db, b, `select id from reports`)).rows).toHaveLength(0);
    await as(db, a, `insert into blocks (blocker, blocked) values ($1,$2)`, [a.id, b.id]);
    expect((await as(db, a, `select id from posts where id = $1`, [post])).rows).toHaveLength(0);
    expect((await as(db, a, `select remove_member($1,$2) r`, [c, b.id])).rows[0].r).toBe(false);
    expect((await as(db, own, `select remove_member($1,$2) r`, [c, b.id])).rows[0].r).toBe(true);
  });

  it("作成者が抜けたら引き継ぎ、最後の1人が抜けたらコミュニティが消える", async () => {
    const [o, a] = [user(901), user(902)];
    const c = communityId(901);
    await addUsers(db, o, a);
    await addCommunity(db, c, [[o, "owner"], [a, "member"]]);
    await as(db, o, `delete from memberships where user_id = $1 and community_id = $2`, [o.id, c]);
    expect((await db.query<{ role: string }>(`select role from memberships where user_id = $1`, [a.id])).rows[0].role).toBe("owner");
    await as(db, a, `delete from memberships where user_id = $1 and community_id = $2`, [a.id, c]);
    expect((await db.query(`select id from communities where id = $1`, [c])).rows).toHaveLength(0);
  });

  it("サーバー専用の表は、画面からは読めない", async () => {
    const a = user(1001);
    await addUsers(db, a);
    for (const table of ["push_log", "error_reports", "join_attempts", "recovery_attempts"]) {
      expect((await as(db, a, `select * from ${table}`)).rows).toHaveLength(0);
    }
    expect((await as(db, a, `select * from app_usage()`)).error).not.toBeNull();
  });
});

describe("SQL ファイル", () => {
  it("02_seed.sql と 04_remove_dummy_data.sql が流せて、本物の人は残る", async () => {
    const { makeFreshDb } = await import("./harness");
    const db = await makeFreshDb();
    await db.exec(read("supabase/02_seed.sql"));
    const real = user(1101);
    await addUsers(db, real);
    await db.query(`insert into memberships (user_id, community_id) values ($1, '22222222-2222-4222-8222-000000000001')`, [real.id]);
    await db.exec(read("supabase/04_remove_dummy_data.sql"));
    expect((await db.query(`select id from auth.users where id::text like '11111111-1111-4111-8111-%'`)).rows).toHaveLength(0);
    expect((await db.query(`select id from auth.users where id = $1`, [real.id])).rows).toHaveLength(1);
  });
});
