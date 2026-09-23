// 「今の気持ち」の選択肢です。
//
// DBに入れる値（value）と、画面に出す文字（label）を分けて持っています。
// DBの値は profiles.mood の決まり（want_to_meet / busy / 空）に合わせてあり、
// ここを直すだけで表示も編集画面も同時に変わります。

// ▼ ホームのアイコンに、ステータス（気持ち）の小さな印を乗せるかどうか。
//   いったん非表示にしています（プロフィールと編集画面には、これまでどおり出ます）。
//   true に戻すと、ホームのアイコンの印も戻ります
export const SHOW_MOOD_ON_HOME = false;

export const MOODS = [
  // 印の絵は components/MoodIcon.tsx が value を見て描きます（前は絵文字でした）
  { value: "want_to_meet", label: "会いたい！" },
  { value: "busy", label: "多忙です" },
];
