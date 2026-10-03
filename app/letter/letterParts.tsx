// 未来への手紙（app/letter/page.tsx）で使う、決まりごと・型・アイコン・画像を作る道具です。
//
// 画面の部品（LetterPage）の外にあるものを、ここにまとめています。
// 手紙の画面のファイルが長くなりすぎて（約1,850行）読みにくかったので、
// 動きを変えずに、場所だけを移しました。

import type { ReactNode } from "react";
// 選べるフォントのうち、Google Fonts から読み込むもの
import { WEB_FONTS } from "./fonts";

// =====================================================
// 保存に使う設定
// =====================================================

// 画像を保存する Storage のバケット名(手書き機能と同じ場所)
export const BUCKET = "drawings";

// 開封日の年を、今年から何年先まで選べるようにするか
export const MAX_YEARS_AHEAD = 30;

// 開封日の select の見た目(年・月・日の3つで共通)
export const DATE_SELECT = "h-12 rounded-lg bg-[#fdfbf5] px-3 text-[17px] shadow-sm ring-1 ring-kin/40";

// 封筒を上に何px以上スワイプしたら「送る」とみなすか
export const SWIPE_SEND_DISTANCE = 120;

// =====================================================
// 見た目の設定(画面と PNG 画像で同じ値を使います)
// =====================================================

export const PAPER_COLOR = "#fdfbf5"; // 紙の色
export const TEXT_COLOR = "#292524"; // 文字の色(Tailwind の stone-800)
export const LINK_COLOR = "#44403c"; // URL の文字の色(Tailwind の stone-700)
export const ITEM_WIDTH = 208; // 置いたものの最初の横幅(Tailwind の w-52 = 208px)
export const ITEM_PADDING = 8; // 置いたものの内側の余白(Tailwind の p-2 = 8px)

// ===== 文字の見た目の選択肢 =====

// 文字の大きさ(px)。四つ角を引っぱって、この間で変えられます。
// 最初は 14px(これまでの大きさ)。10px より小さいと読めないので、そこを下限にしています
export const FONT_SIZE_MIN = 10;
export const FONT_SIZE_MAX = 72;

// フォント。
// 最初の3つは、iPhone に最初から入っているもの(無い端末では、後ろに書いたものが代わりに使われます)。
// そのあとは Google Fonts から読み込むもので、どの端末でも同じ見た目になります(fonts.ts)
export const FONTS = [
  { key: "gothic", label: "ゴシック", family: `"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif` },
  { key: "mincho", label: "明朝", family: `"Hiragino Mincho ProN", "Yu Mincho", serif` },
  { key: "maru", label: "丸文字", family: `"Hiragino Maru Gothic ProN", "Zen Maru Gothic", sans-serif` },
  ...WEB_FONTS,
];

// 文字の色。日本の伝統色の名前をつけて、色の並び(黒→赤→黄→緑→青→紫→茶)にしています。
// 紅と金は、アプリの水引の色(globals.css)と同じです
export const COLORS = [
  { label: "墨", value: TEXT_COLOR },
  { label: "鼠", value: "#78716c" },
  { label: "白", value: "#ffffff" },
  { label: "紅", value: "#b7282e" },
  { label: "朱", value: "#d9482b" },
  { label: "桜", value: "#e89aae" },
  { label: "橙", value: "#ea8a2e" },
  { label: "山吹", value: "#f0b323" },
  { label: "金", value: "#c2a14d" },
  { label: "若草", value: "#8fb04a" },
  { label: "緑", value: "#3f6212" },
  { label: "浅葱", value: "#2a9fb0" },
  { label: "空", value: "#6fa8dc" },
  { label: "藍", value: "#1e3a8a" },
  { label: "藤", value: "#9b86c2" },
  { label: "紫", value: "#6b3fa0" },
  { label: "茶", value: "#7b4a2a" },
];

// 写真の横幅(px)の、いちばん小さい / 大きい値
export const PHOTO_MIN_WIDTH = 80;
export const PHOTO_MAX_WIDTH = 360;

// 写真の高さ(px)の、いちばん小さい / 大きい値(上下の〇で変えるとき)
export const PHOTO_MIN_HEIGHT = 40;
export const PHOTO_MAX_HEIGHT = 600;

// テキスト・URL の横幅(px)の、いちばん小さい / 大きい値。
// 横幅を広げると、そのぶん1行に入る文字が増えて、改行の位置が変わります
export const TEXT_MIN_WIDTH = 60;
export const TEXT_MAX_WIDTH = 360;

// 1行の高さ。文字の大きさに合わせて伸ばします(14px のとき、これまでと同じ 24px)
export function lineHeightOf(fontSize: number) {
  return Math.round((fontSize * 12) / 7);
}

// フォントの名前(key)から、実際に使う書体の指定を取り出します
export function fontFamilyOf(key: string) {
  return FONTS.find((f) => f.key === key)?.family ?? FONTS[0].family;
}

// =====================================================
// 型(データの形)の決まりごと
// =====================================================

// 紙の上に置けるものの種類。3種類のどれかしか入りません。
export type ItemType = "text" | "photo" | "url";

// 紙の上に置く「1つ分」のデータの形です。
// C言語の struct(構造体)とほぼ同じ考え方です。
export type Item = {
  id: number; // 見分けるための番号
  type: ItemType; // 種類
  x: number; // 紙の左端からの距離(px)
  y: number; // 紙の上端からの距離(px)
  text: string; // テキストの文字
  imageSrc: string; // 写真の画像
  url: string; // URL
  width: number; // 横幅(px)
  // 写真の高さ(px)。null のときは、元の写真の比率のままの高さです。
  // 左右や上下の〇で形を変えると、ここに数が入ります
  photoHeight: number | null;
  // テキスト・URL の枠の高さ(px)。null のときは、中身の行数ぴったりの高さです。
  // 上下の〇で広げると、ここに数が入ります(中身より低くはなりません)
  boxHeight: number | null;
  rotation: number; // 回した角度(度)。時計回りがプラス
  fontSize: number; // 文字の大きさ(px)。テキストと URL で使います
  fontKey: string; // フォントの名前(FONTS の key)
  color: string; // 文字の色
};

// イベント(日程調整)のデータの形です。紙の上のものとは別に覚えておきます。
export type EventPlan = {
  name: string; // イベント名(events.name に入れる)
  dates: string[]; // 候補日の一覧(event_date_options.event_date に入れる)
};

// 入力中の候補日1行ぶん。
//   end が "" … その日1日だけ
//   end が入っている … start から end までの「期間」。保存するときに1日ずつに分けます
//   (DB の候補日は1日ずつの形なので、期間のまま入れる場所がないためです)
export type DateRow = { start: string; end: string; isRange: boolean };

// 入力中のイベント。候補日だけ、期間を入れられる形で持ちます
export type EventDraft = { name: string; rows: DateRow[] };

// 期間を1日ずつの一覧にします。長すぎる期間で候補日が何百個もできないよう、62日で止めます
export const MAX_RANGE_DAYS = 62;
export function expandRow(row: DateRow): string[] {
  if (row.start === "") return [];
  if (!row.isRange || row.end === "" || row.end <= row.start) return [row.start];
  const days: string[] = [];
  const day = new Date(`${row.start}T00:00:00`);
  const last = new Date(`${row.end}T00:00:00`);
  while (day <= last && days.length < MAX_RANGE_DAYS) {
    // "sv-SE" = "2030-04-01" の形の文字にする書き方です
    days.push(day.toLocaleDateString("sv-SE"));
    day.setDate(day.getDate() + 1);
  }
  return days;
}

// 枠についている〇(引っぱる所)の場所。
//   四つ角 … "tl" = 左上、"tr" = 右上、"bl" = 左下、"br" = 右下
//   辺の中点 … "t" = 上、"b" = 下、"l" = 左、"r" = 右
export type Handle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

// 〇の一覧です。
//   position … 置く位置。44px の当たり判定の真ん中が、枠の角や辺の中点に来るようにずらしています
//   cursor   … PC で〇の上にのせたときのマウスの形(↔ や ↕ のやじるしになります)
// 辺の中点を後ろに書いているのは、小さい文字で〇どうしが重なったとき、
// 中点のほうを上にして、つかめるようにするためです
export const HANDLES: { handle: Handle; position: string; cursor: string }[] = [
  { handle: "tl", position: "-left-[22px] -top-[22px]", cursor: "cursor-nwse-resize" },
  { handle: "tr", position: "-right-[22px] -top-[22px]", cursor: "cursor-nesw-resize" },
  { handle: "bl", position: "-bottom-[22px] -left-[22px]", cursor: "cursor-nesw-resize" },
  { handle: "br", position: "-bottom-[22px] -right-[22px]", cursor: "cursor-nwse-resize" },
  { handle: "t", position: "-top-[22px] left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { handle: "b", position: "-bottom-[22px] left-1/2 -translate-x-1/2", cursor: "cursor-ns-resize" },
  { handle: "l", position: "-left-[22px] top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
  { handle: "r", position: "-right-[22px] top-1/2 -translate-y-1/2", cursor: "cursor-ew-resize" },
];

// 新しく1つ作る関数です。
export function createItem(id: number, type: ItemType, x: number, y: number): Item {
  return {
    id,
    type,
    x,
    y,
    text: "",
    imageSrc: "",
    url: "",
    width: ITEM_WIDTH,
    photoHeight: null,
    boxHeight: null,
    rotation: 0,
    fontSize: 14,
    fontKey: "gothic",
    // URL は、これまでどおり少しだけ薄い色から始めます
    color: type === "url" ? LINK_COLOR : TEXT_COLOR,
  };
}

// ===== アイコン =====
// ※ コピーで行が消えないように、1つのアイコンを1行で書いています

// 写真のアイコン
export const ImageIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>;

// リンクのアイコン
export const LinkIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>;

// カレンダーのアイコン(イベント用)
export const CalendarIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>;

// 紙飛行機のアイコン(「未来へ送る」ボタン用)
export const SendIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-5 w-5"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>;

// 紙の右上に並べる、黒い丸ボタンの一覧(上から順番に表示されます)
export const TOOLS: { type: ItemType | "event"; label: string; icon: ReactNode }[] = [
  { type: "text", label: "テキスト", icon: <span className="font-serif text-xl font-bold">T</span> },
  { type: "photo", label: "写真", icon: ImageIcon },
  { type: "url", label: "URL", icon: LinkIcon },
  { type: "event", label: "イベント", icon: CalendarIcon },
];

// テキスト入力欄の高さを、中身の行数に合わせて伸び縮みさせる関数です
export function autoResize(el: HTMLTextAreaElement) {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

// =====================================================
// PNG 画像を作るための道具
// =====================================================

// 文字を、決めた横幅で折り返して「行の配列」にする関数です
// ctx.measureText(...).width は「その文字を描いたときの横幅(px)」を返します
// 日本語は単語の区切り(スペース)がないので、1文字ずつ足していき、
// はみ出したところで次の行に送ります
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const lines: string[] = [];

  // まず改行(\n)で段落に分けます
  for (const paragraph of text.split("\n")) {
    // for (const ch of 文字列) は、文字列を1文字ずつ取り出すくり返しです
    // (C言語の for (i = 0; s[i] != '\0'; i++) に近いものです)
    let line = "";
    for (const ch of paragraph) {
      if (line !== "" && ctx.measureText(line + ch).width > maxWidth) {
        lines.push(line); // はみ出すので、ここまでを1行にする
        line = ch; // 次の行は、この文字から始める
      } else {
        line += ch;
      }
    }
    lines.push(line); // 段落の最後の行
  }
  return lines;
}

// 文字が横幅に入りきらないとき、後ろを「…」にして縮める関数です
export function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let t = text;
  // .slice(0, -1) は「最後の1文字を取った文字列」です
  while (t.length > 0 && ctx.measureText(t + "…").width > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + "…";
}
