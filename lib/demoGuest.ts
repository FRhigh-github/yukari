// 「デモで入る」で作られたゲストかどうかを見分けます。
//
// ゲストのメールアドレスは、最後が @demo.yukari.invalid です（app/api/demo-login で作っています）。
// ゲストはデモ用コミュニティにしかいられないので、
// 「作る」「参加する」の入口を出さない・開かせないために使います。
// （本当に止めているのは DB の関数です。supabase/06_demo_guest_limits.sql）

export const DEMO_EMAIL_DOMAIN = "demo.yukari.invalid";

export function isDemoGuest(email: string | null | undefined) {
  return typeof email === "string" && email.endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
