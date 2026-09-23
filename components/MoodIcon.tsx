// ステータス（気持ち）の印です。前は絵文字（❤️ 💼）でしたが、
// 端末によって絵が変わり、アプリのほかの線の絵とも合わなかったので、線の絵にしました。
// 色は紅（会いたい）と金（多忙）。大きさは外から className で決めます。

type MoodIconProps = {
  // lib/mood.ts の value（want_to_meet / busy）
  value: string;
  className?: string;
};

export default function MoodIcon({ value, className = "h-4 w-4" }: MoodIconProps) {
  if (value === "want_to_meet") {
    // ハート
    return (
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={`text-beni ${className}`}>
        <path d="M12 21s-7.5-4.6-9.5-9.2C1 8.4 3.2 5 6.6 5c2 0 3.5 1.1 4.4 2.6h2C13.9 6.1 15.4 5 17.4 5 20.8 5 23 8.4 21.5 11.8 19.5 16.4 12 21 12 21z" />
      </svg>
    );
  }
  // かばん（多忙）
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`text-kin ${className}`}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
      <path d="M3 13h18" />
    </svg>
  );
}
