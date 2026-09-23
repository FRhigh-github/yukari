// アイコンの右下に重ねる、カメラの印です。
//
// 丸い画像があるだけだと「押せる」と気づかれません。
// スマホのプロフィール設定では、この印がほぼ共通の合図になっています。

export default function CameraBadge() {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-kin">
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 本体と、上の出っぱりと、レンズ */}
        <path d="M3 8h3l1.5-2h9L18 8h3v12H3z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </svg>
    </span>
  );
}
