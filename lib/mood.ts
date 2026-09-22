// 「今の気持ち」の選択肢です。
//
// DBに入れる値（value）と、画面に出す文字（label）を分けて持っています。
// DBの値は profiles.mood の決まり（want_to_meet / busy / 空）に合わせてあり、
// ここを直すだけで表示も編集画面も同時に変わります。

export const MOODS = [
  { value: "want_to_meet", label: "会いたい！", emoji: "❤️" },
  { value: "busy", label: "多忙です", emoji: "💼" },
];
