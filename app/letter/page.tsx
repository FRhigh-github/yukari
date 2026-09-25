// app/letter/page.tsx
//
// 「未来の私たちへ手紙を送る」機能のページです。
// スマホ版のデザイン案に合わせて、PCでも真ん中にスマホの幅で表示します。
// 紙の上に、テキスト・写真・URL を自由に置けます。
// イベント(日程調整)は紙とは別に作り、紙の右下に「予定調整へ」ボタンだけを出します。
//
// 「未来へ送る」を押すと、
//   1. 紙を PNG 画像にして Storage(drawings)に保存
//   2. time_capsules に手紙を1行追加
//   3. イベントがあれば events と event_date_options にも追加
// します。
//
// 開封日は、紙の上の「○年○月○日の私たちへ」で選びます(その月の1日に開封されます)。
// 「未来へ送る」を押すと封筒が出ます。
// 封筒の画面で「○年○月○日の私たちへ」を入れると、上にスワイプして送れます。

// この画面はブラウザで動かします(ボタンや指の操作があるため)
"use client";

import { useEffect, useRef, useState } from "react";
// 指の動き(ドラッグ・2本指のピンチ)を見分けてくれるライブラリ
import { useDrag, usePinch } from "@use-gesture/react";
// PointerEvent … 指やマウスで押した・動かしたときの情報の型
// ReactNode … 「画面に表示できるもの(文字やアイコンなど)」の型
import type { PointerEvent, ReactNode } from "react";
// Supabase(データベース)とつながる窓口を作る関数(手書き機能と同じもの)
import { createClient } from "@/lib/supabase/client";
import HorizontalScroller from "@/components/HorizontalScroller";
import { shrinkImage } from "@/lib/image";
// 回した角度を、まっすぐの近くでぴたっと止める計算(カード作りと共通)
import { snapRotation } from "@/lib/rotation";
// 選べるフォントのうち、Google Fonts から読み込むもの
import { WEB_FONTS } from "./fonts";

// =====================================================
// 保存に使う設定
// =====================================================

// 画像を保存する Storage のバケット名(手書き機能と同じ場所)
const BUCKET = "drawings";

// 開封日の年を、今年から何年先まで選べるようにするか
const MAX_YEARS_AHEAD = 30;

// 開封日の select の見た目(年・月・日の3つで共通)
const DATE_SELECT = "h-12 rounded-lg bg-[#fdfbf5] px-3 text-[17px] shadow-sm ring-1 ring-kin/40";

// 封筒を上に何px以上スワイプしたら「送る」とみなすか
const SWIPE_SEND_DISTANCE = 120;

// =====================================================
// 見た目の設定(画面と PNG 画像で同じ値を使います)
// =====================================================

const PAPER_COLOR = "#fdfbf5"; // 紙の色
const TEXT_COLOR = "#292524"; // 文字の色(Tailwind の stone-800)
const LINK_COLOR = "#44403c"; // URL の文字の色(Tailwind の stone-700)
const ITEM_WIDTH = 208; // 置いたものの最初の横幅(Tailwind の w-52 = 208px)
const ITEM_PADDING = 8; // 置いたものの内側の余白(Tailwind の p-2 = 8px)

// ===== 文字の見た目の選択肢 =====

// 文字の大きさ(px)。四つ角を引っぱって、この間で変えられます。
// 最初は 14px(これまでの大きさ)。10px より小さいと読めないので、そこを下限にしています
const FONT_SIZE_MIN = 10;
const FONT_SIZE_MAX = 72;

// フォント。
// 最初の3つは、iPhone に最初から入っているもの(無い端末では、後ろに書いたものが代わりに使われます)。
// そのあとは Google Fonts から読み込むもので、どの端末でも同じ見た目になります(fonts.ts)
const FONTS = [
  { key: "gothic", label: "ゴシック", family: `"Hiragino Sans", "Hiragino Kaku Gothic ProN", sans-serif` },
  { key: "mincho", label: "明朝", family: `"Hiragino Mincho ProN", "Yu Mincho", serif` },
  { key: "maru", label: "丸文字", family: `"Hiragino Maru Gothic ProN", "Zen Maru Gothic", sans-serif` },
  ...WEB_FONTS,
];

// 文字の色。日本の伝統色の名前をつけて、色の並び(黒→赤→黄→緑→青→紫→茶)にしています。
// 紅と金は、アプリの水引の色(globals.css)と同じです
const COLORS = [
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
const PHOTO_MIN_WIDTH = 80;
const PHOTO_MAX_WIDTH = 360;

// 写真の高さ(px)の、いちばん小さい / 大きい値(上下の〇で変えるとき)
const PHOTO_MIN_HEIGHT = 40;
const PHOTO_MAX_HEIGHT = 600;

// テキスト・URL の横幅(px)の、いちばん小さい / 大きい値。
// 横幅を広げると、そのぶん1行に入る文字が増えて、改行の位置が変わります
const TEXT_MIN_WIDTH = 60;
const TEXT_MAX_WIDTH = 360;

// 1行の高さ。文字の大きさに合わせて伸ばします(14px のとき、これまでと同じ 24px)
function lineHeightOf(fontSize: number) {
  return Math.round((fontSize * 12) / 7);
}

// フォントの名前(key)から、実際に使う書体の指定を取り出します
function fontFamilyOf(key: string) {
  return FONTS.find((f) => f.key === key)?.family ?? FONTS[0].family;
}

// =====================================================
// 型(データの形)の決まりごと
// =====================================================

// 紙の上に置けるものの種類。3種類のどれかしか入りません。
type ItemType = "text" | "photo" | "url";

// 紙の上に置く「1つ分」のデータの形です。
// C言語の struct(構造体)とほぼ同じ考え方です。
type Item = {
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
type EventPlan = {
  name: string; // イベント名(events.name に入れる)
  dates: string[]; // 候補日の一覧(event_date_options.event_date に入れる)
};

// 入力中の候補日1行ぶん。
//   end が "" … その日1日だけ
//   end が入っている … start から end までの「期間」。保存するときに1日ずつに分けます
//   (DB の候補日は1日ずつの形なので、期間のまま入れる場所がないためです)
type DateRow = { start: string; end: string; isRange: boolean };

// 入力中のイベント。候補日だけ、期間を入れられる形で持ちます
type EventDraft = { name: string; rows: DateRow[] };

// 期間を1日ずつの一覧にします。長すぎる期間で候補日が何百個もできないよう、62日で止めます
const MAX_RANGE_DAYS = 62;
function expandRow(row: DateRow): string[] {
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
type Handle = "tl" | "tr" | "bl" | "br" | "t" | "b" | "l" | "r";

// 〇の一覧です。
//   position … 置く位置。44px の当たり判定の真ん中が、枠の角や辺の中点に来るようにずらしています
//   cursor   … PC で〇の上にのせたときのマウスの形(↔ や ↕ のやじるしになります)
// 辺の中点を後ろに書いているのは、小さい文字で〇どうしが重なったとき、
// 中点のほうを上にして、つかめるようにするためです
const HANDLES: { handle: Handle; position: string; cursor: string }[] = [
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
function createItem(id: number, type: ItemType, x: number, y: number): Item {
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
const ImageIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>;

// リンクのアイコン
const LinkIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>;

// カレンダーのアイコン(イベント用)
const CalendarIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>;

// 紙飛行機のアイコン(「未来へ送る」ボタン用)
const SendIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-5 w-5"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>;

// 紙の右上に並べる、黒い丸ボタンの一覧(上から順番に表示されます)
const TOOLS: { type: ItemType | "event"; label: string; icon: ReactNode }[] = [
  { type: "text", label: "テキスト", icon: <span className="font-serif text-xl font-bold">T</span> },
  { type: "photo", label: "写真", icon: ImageIcon },
  { type: "url", label: "URL", icon: LinkIcon },
  { type: "event", label: "イベント", icon: CalendarIcon },
];

// テキスト入力欄の高さを、中身の行数に合わせて伸び縮みさせる関数です
function autoResize(el: HTMLTextAreaElement) {
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
function wrapText(
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
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
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

// =====================================================
// ページ本体
// =====================================================
export default function LetterPage() {
  // 紙の上に置いてあるものの一覧(最初は空っぽ = 白紙)
  const [items, setItems] = useState<Item[]>([]);

  // いま選ばれているものの番号(何も選んでいないときは null)
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // 決定済みのイベント(まだ作っていないときは null)
  const [eventPlan, setEventPlan] = useState<EventPlan | null>(null);

  // パネルで入力中のイベント(パネルを閉じているときは null)
  const [draft, setDraft] = useState<EventDraft | null>(null);

  // ===== 開封日(何年何月何日の私たちへ) =====
  // 封筒の画面で、年・月・日を1つずつ選びます。最初は空(""＝未入力)。
  // (カレンダー1つで選ぶ形も試しましたが、何年も先の日を選ぶのに使いにくかったので戻しました)
  // select の値は文字で届くので、文字のまま持ち、使うときに Number() で数にします
  const [openYear, setOpenYear] = useState("");
  const [openMonth, setOpenMonth] = useState("");
  const [openDay, setOpenDay] = useState("");

  // 選べる年の一覧(今年〜30年先)
  const thisYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: MAX_YEARS_AHEAD + 1 }, (_, i) => thisYear + i);

  // 開封日。月は 0 始まりなので -1 します
  const openDate = new Date(Number(openYear), Number(openMonth) - 1, Number(openDay));

  // 3つ入力済みで、2月30日のような存在しない日でないか
  // (存在しない日だと Date が翌月にずらすので、月が変わっていないかで見分けます)
  const isDateValid =
    openYear !== "" &&
    openMonth !== "" &&
    openDay !== "" &&
    openDate.getMonth() === Number(openMonth) - 1;

  // スワイプして送れるのは、未来の日付が入っているときだけ
  const canSwipe = isDateValid && openDate > new Date();

  // ===== 送り先のコミュニティ =====
  // 前は「入っているコミュニティの先頭」に決め打ちで送っていたので、
  // 2つ以上入っていると、どこに届くか選べませんでした。
  // 封筒を開いたときに一覧を取り、2つ以上あれば選べるようにします
  const [communities, setCommunities] = useState<{ id: string; name: string }[]>([]);
  const [communityId, setCommunityId] = useState("");

  // ===== 封筒のスワイプのための状態 =====
  const [showEnvelope, setShowEnvelope] = useState(false); // 封筒を出しているか
  const [swipeY, setSwipeY] = useState(0); // 上に何px動かしたか
  // 指で動かしている最中か。封筒をなめらかに戻す動きを付けるかどうかに使います。
  // (前は useRef の中身を画面を作る途中で読んでいて、React に「正しく描き直されない」と注意されていました)
  const [isSwiping, setIsSwiping] = useState(false);
  // 指を置いた高さ(画面に出さないので useRef)。触っていないときは null
  const swipeStartRef = useRef<number | null>(null);

  // ===== 送信のための状態 =====
  const [isSending, setIsSending] = useState(false); // 送信中かどうか
  const [isSent, setIsSent] = useState(false); // 送信が終わったかどうか
  const [errorText, setErrorText] = useState<string | null>(null); // エラーの文

  // 次に作るものの番号(画面に出さないので useRef)
  const nextIdRef = useRef(1);

  // 紙そのものを指す箱(紙の位置や大きさを測るのに使います)
  const paperRef = useRef<HTMLDivElement>(null);

  // 2本指で大きさ・向きを変えている最中か(画面に出さないので useRef)。
  // その間は、1本指で動かすほうを止めます
  const pinchingRef = useRef(false);
  // 今回の指の操作で、2本指の操作をしたか。紙を軽く押したときに選ぶのをやめる処理を、
  // ピンチのあとには動かさないために使います
  const pinchedRef = useRef(false);

  // いま〇を引っぱって、大きさを変えている最中の情報(していないときは null)。
  // 押した瞬間の大きさを覚えておき、そこから指がどれだけ動いたかで計算します
  const resizeRef = useRef<{
    id: number;
    handle: Handle;
    isPhoto: boolean;
    startX: number;
    startY: number;
    startWidth: number;
    startItemX: number;
    startItemY: number;
    startFontSize: number;
    startBoxHeight: number; // 枠ぜんたいの高さ
    startPhotoHeight: number; // 写真の高さ(テキストのときは使いません)
    startContentHeight: number; // テキストの中身だけの高さ(枠をこれより低くしないため)
    hasBoxHeight: boolean; // テキストの枠の高さを、上下の〇で決めてあるか
    rotation: number; // 置いたものが回っている角度(度)
  } | null>(null);

  // 2本指で回している最中に、まっすぐ(0度・90度・180度)になったら出す点線の位置。
  // 出していないときは null です(画面に出すので useState)
  const [rotateGuide, setRotateGuide] = useState<{ x: number; y: number } | null>(null);

  // 紙の下の帯で、いま開いているタブ("font" = 書体、"color" = 色)
  const [styleTab, setStyleTab] = useState<"font" | "color">("font");

  // ----- 1つ追加する -----
  function addItem(type: ItemType) {
    const id = nextIdRef.current;
    nextIdRef.current += 1;

    // 同じ場所に重ならないように、置くたびに少しずつ下にずらします
    const n = items.length % 6;

    setItems([...items, createItem(id, type, 24 + n * 12, 48 + n * 56)]);

    // 追加したものを、すぐ選ばれた状態にします
    setSelectedId(id);
  }

  // ----- 中身を一部だけ書き換える -----
  function updateItem(id: number, changes: Partial<Item>) {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, ...changes } : it))
    );
  }

  // ----- 削除する -----
  function deleteItem(id: number) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    setSelectedId(null);
  }

  // =====================================================
  // イベントのパネル
  // =====================================================

  // ----- パネルを開く -----
  function openEventPanel() {
    setSelectedId(null);
    if (eventPlan === null) {
      setDraft({ name: "", rows: [{ start: "", end: "", isRange: false }] });
    } else {
      // 決めたあとの候補日は1日ずつになっているので、1日ずつの行に戻して開きます
      setDraft({
        name: eventPlan.name,
        rows: eventPlan.dates.map((d) => ({ start: d, end: "", isRange: false })),
      });
    }
  }

  // ----- 候補日の行を1つだけ書き換える -----
  function updateRow(index: number, changes: Partial<DateRow>) {
    if (draft === null) return;
    setDraft({
      ...draft,
      rows: draft.rows.map((row, i) => (i === index ? { ...row, ...changes } : row)),
    });
  }

  // ----- パネルを閉じる(キャンセル) -----
  function closeEventPanel() {
    setDraft(null);
  }

  // 入力済みの候補日だけを取り出します(空の入力欄は除く)
  // (期間の行は、1日ずつに分けてから数えます)
  const filledDates = draft === null ? [] : draft.rows.flatMap(expandRow);

  // 同じ日が2回入っていないかを調べます
  const hasDuplicate = new Set(filledDates).size !== filledDates.length;

  // 「決定」を押してよいかどうか
  const canSaveEvent =
    draft !== null &&
    draft.name.trim() !== "" &&
    filledDates.length > 0 &&
    !hasDuplicate;

  // ----- 決定する -----
  function saveEvent() {
    if (draft === null || !canSaveEvent) {
      return;
    }
    setEventPlan({
      name: draft.name.trim(),
      dates: [...filledDates].sort(),
    });
    setDraft(null);
  }

  // ----- イベントを削除する -----
  function removeEvent() {
    setEventPlan(null);
    setDraft(null);
  }

  // =====================================================
  // ドラッグ
  // =====================================================

  // 指の動きの計算は @use-gesture/react にまかせています。
  // 前は自分で書いていて、少し触れただけで動いたり、文字の欄の上ではつかめなかったりしました。
  // このライブラリは「軽く押した(タップ)」と「押したまま動かした(ドラッグ)」を見分けてくれるので、
  //   軽く押す         … 選ぶ(文字の欄なら、そのまま文字を打てる)
  //   押したまま動かす … 動かす(文字の欄の上からでもつかめる)
  // になります。
  //
  // bindDrag(item.id) を置いたものの枠に付けると、そのものを動かせます。
  // memo = ドラッグの最初に返した値を、指を離すまで覚えておいてくれる入れ物です。
  // ここでは「動かし始めたときの位置」を入れておき、そこから指が動いたぶん(movement)だけずらします
  const bindDrag = useDrag(
    ({ args, tap, first, movement: [moveX, moveY], memo, cancel }) => {
      const id = args[0] as number;
      if (tap || first) {
        setSelectedId(id);
      }
      if (tap) {
        return memo;
      }
      // 2本指の操作が始まったら、1本指の移動はやめます
      if (pinchingRef.current) {
        cancel();
        return memo;
      }
      const paper = paperRef.current;
      const item = items.find((it) => it.id === id);
      if (paper === null || item === undefined) {
        return memo;
      }
      const start: { x: number; y: number } = memo ?? { x: item.x, y: item.y };
      // 紙の外へ出てしまわないように、少しは紙の中に残します
      updateItem(id, {
        x: Math.max(0, Math.min(start.x + moveX, paper.clientWidth - 60)),
        y: Math.max(0, Math.min(start.y + moveY, paper.clientHeight - 40)),
      });
      return start;
    },
    // filterTaps = 3px 以内の動きは「タップ」とみなし、ものを動かしません
    { filterTaps: true }
  );

  // ▼ 2本指で、選んでいるものの大きさと向きを変えます(写真アプリと同じ操作)。
  //   小さい文字でも2本指で挟めるよう、紙のどこで挟んでもよいことにしています。
  //   movement = [何倍に広げたか, 何度回したか]
  usePinch(
    ({ first, last, movement: [scale, angle], memo }) => {
      pinchingRef.current = !last;
      pinchedRef.current = true;
      if (last) {
        setRotateGuide(null);
      }
      const item = items.find((it) => it.id === selectedId);
      if (item === undefined) {
        return memo;
      }

      // 挟み始めたときの大きさを覚えておき、そこから何倍にしたかで計算します
      type PinchStart = Item & { height: number };
      let start: PinchStart | undefined = memo;
      if (first || start === undefined) {
        const box = paperRef.current?.querySelector(`[data-item-id="${item.id}"]`);
        start = { ...item, height: box instanceof HTMLElement ? box.offsetHeight : 0 };
      }

      let changes: Partial<Item>;
      let k: number;
      if (start.type === "photo") {
        // 写真:写真そのもの(余白を除いた幅)を、縦横同じ倍率で変えます
        const inner = start.width - ITEM_PADDING * 2;
        k = Math.max(PHOTO_MIN_WIDTH / start.width, Math.min(PHOTO_MAX_WIDTH / start.width, scale));
        changes = {
          width: inner * k + ITEM_PADDING * 2,
          photoHeight: start.photoHeight === null ? null : start.photoHeight * k,
        };
      } else {
        // テキスト・URL:文字の大きさと枠の幅を、同じ倍率で変えます
        k = Math.max(FONT_SIZE_MIN / start.fontSize, Math.min(FONT_SIZE_MAX / start.fontSize, scale));
        changes = {
          fontSize: Math.round(start.fontSize * k * 10) / 10,
          width: Math.max(TEXT_MIN_WIDTH, Math.min(TEXT_MAX_WIDTH, start.width * k)),
          boxHeight: start.boxHeight === null ? null : start.boxHeight * k,
        };
      }

      const snapped = snapRotation(start.rotation + angle);
      // 真ん中の位置が動かないように、左上の位置を直します
      const width = changes.width ?? start.width;
      const centerX = start.x + start.width / 2;
      const centerY = start.y + start.height / 2;
      updateItem(item.id, {
        ...changes,
        rotation: snapped.rotation,
        x: centerX - width / 2,
        y: centerY - (start.height * k) / 2,
      });
      // まっすぐになったら、回転のボタンと同じく点線を出して知らせます
      setRotateGuide(snapped.isStraight && !last ? { x: centerX, y: centerY } : null);
      return start;
    },
    // target = 紙そのものに付けます(紙の上のどこで挟んでもよいように)
    { target: paperRef }
  );

  // ▼ iPhone の Safari は、2本指で挟むと画面ごと拡大しようとします。
  //   ピンチを手紙のものの操作に使うため、画面の拡大を止めます
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
    };
  }, []);

  // =====================================================
  // 枠の〇を引っぱって、大きさや形を変える
  // =====================================================
  //
  //   四つ角 … 縦横の比率を保ったまま、拡大・縮小(テキストは文字も大きくなる)
  //   左右   … 横幅だけ変える(テキストは改行の位置が変わる)
  //   上下   … 高さだけ変える(テキストは枠が縦に広がる。中身より低くはならない)

  // ----- 〇を押した瞬間 -----
  function handleResizeDown(e: PointerEvent<HTMLButtonElement>, item: Item, handle: Handle) {
    // 外側の枠(ドラッグで動かす所)に伝えません。伝わると、大きさを変えながら動いてしまいます
    e.stopPropagation();
    // ボタンの親 = 置いたものの枠。いまの高さを、画面から測ります
    const box = e.currentTarget.parentElement;
    if (box === null) {
      return;
    }
    const img = box.querySelector("img");

    e.currentTarget.setPointerCapture(e.pointerId);
    resizeRef.current = {
      id: item.id,
      handle,
      isPhoto: item.type === "photo",
      startX: e.clientX,
      startY: e.clientY,
      startWidth: item.width,
      startItemX: item.x,
      startItemY: item.y,
      startFontSize: item.fontSize,
      startBoxHeight: box.offsetHeight,
      startPhotoHeight: img === null ? 0 : img.offsetHeight,
      // 中身(入力欄など)の高さ + 上下の余白
      startContentHeight:
        (box.firstElementChild instanceof HTMLElement ? box.firstElementChild.offsetHeight : 0) +
        ITEM_PADDING * 2,
      hasBoxHeight: item.boxHeight !== null,
      rotation: item.rotation,
    };
  }

  // ----- 〇を引っぱっている間 -----
  function handleResizeMove(e: PointerEvent<HTMLButtonElement>) {
    const r = resizeRef.current;
    if (r === null) {
      return;
    }
    const h = r.handle;

    // ▼ 置いたものが回っているときは、指の動きを「枠の向き」に直してから計算します。
    //   (45度回っている枠の右の〇は、画面の右ではなく、ななめ右下に引っぱるため)
    const rad = (r.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const moveX = e.clientX - r.startX;
    const moveY = e.clientY - r.startY;
    const localX = moveX * cos + moveY * sin;
    const localY = -moveX * sin + moveY * cos;

    // 外向き(大きくなる向き)に動いたぶんをプラスにします。
    // 右の〇なら右へ、左の〇なら左へ動かすと大きくなります
    const isLeft = h === "tl" || h === "bl" || h === "l";
    const isTop = h === "tl" || h === "tr" || h === "t";
    const dx = localX * (isLeft ? -1 : 1);
    const dy = localY * (isTop ? -1 : 1);

    // 新しい枠の横幅と高さ、ほかに変えるもの
    let width = r.startWidth;
    let height = r.startBoxHeight;
    let changes: Partial<Item> = {};

    if (h === "l" || h === "r") {
      // ▼ 左右の〇:横幅だけ変えます
      const min = r.isPhoto ? PHOTO_MIN_WIDTH : TEXT_MIN_WIDTH;
      const max = r.isPhoto ? PHOTO_MAX_WIDTH : TEXT_MAX_WIDTH;
      width = Math.max(min, Math.min(max, r.startWidth + dx));
      // 写真は高さをそのまま残し、横にだけ広げます(はみ出たぶんは切り取って見せます)
      changes = r.isPhoto ? { photoHeight: r.startPhotoHeight } : {};
    } else if (h === "t" || h === "b") {
      // ▼ 上下の〇:高さだけ変えます
      if (r.isPhoto) {
        const photoHeight = Math.max(
          PHOTO_MIN_HEIGHT,
          Math.min(PHOTO_MAX_HEIGHT, r.startPhotoHeight + dy)
        );
        height = r.startBoxHeight + (photoHeight - r.startPhotoHeight);
        changes = { photoHeight };
      } else {
        // テキスト・URL は枠を縦に広げます。中身より低くはしません
        height = Math.max(r.startContentHeight, r.startBoxHeight + dy);
        changes = { boxHeight: height };
      }
    } else {
      // ▼ 四つ角:縦横の比率を保って、拡大・縮小します
      // 写真は中身(写真そのもの)の大きさで、テキストは枠ぜんたいの大きさで比べます
      const baseWidth = r.isPhoto ? r.startWidth - ITEM_PADDING * 2 : r.startWidth;
      const baseHeight = r.isPhoto ? r.startPhotoHeight : r.startBoxHeight;

      // 縦の動きは、比率で割って「横幅にするとどれだけか」に直し、
      // 横と縦、大きく動いたほうに合わせます(ななめに引いても自然に伸びるように)
      const dyAsWidth = (dy * baseWidth) / baseHeight;
      const grow = Math.abs(dx) > Math.abs(dyAsWidth) ? dx : dyAsWidth;

      // 何倍にするか。小さくなりすぎ・大きくなりすぎないように、範囲に収めます
      let scale = (baseWidth + grow) / baseWidth;
      if (r.isPhoto) {
        scale = Math.max(PHOTO_MIN_WIDTH / r.startWidth, Math.min(PHOTO_MAX_WIDTH / r.startWidth, scale));
      } else {
        scale = Math.max(FONT_SIZE_MIN / r.startFontSize, Math.min(FONT_SIZE_MAX / r.startFontSize, scale));
      }

      width = r.isPhoto ? baseWidth * scale + ITEM_PADDING * 2 : r.startWidth * scale;
      height = r.startBoxHeight + baseHeight * (scale - 1);
      // 写真は高さを、テキストは文字の大きさを、同じ倍率で変えます
      changes = r.isPhoto
        ? { photoHeight: r.startPhotoHeight * scale }
        : {
            fontSize: Math.round(r.startFontSize * scale * 10) / 10,
            // 枠の高さを決めてあるときは、それも同じ倍率にします
            boxHeight: r.hasBoxHeight ? r.startBoxHeight * scale : null,
          };
    }

    // ▼ 反対側の辺や角が動かないように、置く位置を直します。
    //   枠は真ん中を軸に回っているので、「真ん中がどれだけずれるか」を
    //   枠の向きで考えてから、画面の向きに戻して計算します
    const shiftX = ((width - r.startWidth) / 2) * (isLeft ? -1 : 1);
    const shiftY = ((height - r.startBoxHeight) / 2) * (isTop ? -1 : 1);
    const centerX = r.startItemX + r.startWidth / 2 + shiftX * cos - shiftY * sin;
    const centerY = r.startItemY + r.startBoxHeight / 2 + shiftX * sin + shiftY * cos;

    updateItem(r.id, {
      ...changes,
      width,
      x: centerX - width / 2,
      y: centerY - height / 2,
    });
  }

  // ----- 〇を離した瞬間 -----
  function handleResizeUp() {
    resizeRef.current = null;
  }

  // =====================================================
  // 紙を PNG 画像にする
  // =====================================================
  //
  // 画面には出さない canvas(キャンバス)を1枚作り、
  // items に覚えているとおりの位置に、文字や写真を描き直します。
  // 最後に canvas.toBlob で PNG にします(手書き機能と同じやり方です)。
  //
  // async は「途中で待つ処理(await)がある関数」という印です。
  // Promise<Blob | null> は「あとで Blob(ファイルの中身)か null が届く」という意味です。
  async function makeLetterPng(): Promise<Blob | null> {
    const paper = paperRef.current;
    if (paper === null) {
      return null;
    }

    // 紙の大きさ(px)。clientWidth / clientHeight は「部品の中身の幅と高さ」です
    const width = paper.clientWidth;
    const height = paper.clientHeight;

    // 2倍の大きさで描いて、スマホの画面でもぼやけないようにします
    const SCALE = 2;

    // document.createElement("canvas") で、画面に出さない canvas を作ります
    const canvas = document.createElement("canvas");
    canvas.width = width * SCALE;
    canvas.height = height * SCALE;

    // getContext("2d") は「この canvas に絵を描くための道具箱」を取り出します
    const ctx = canvas.getContext("2d");
    if (ctx === null) {
      return null;
    }
    // これ以降は、1 と書けば 2px で描かれるようにします
    ctx.scale(SCALE, SCALE);

    // ----- 紙を塗る -----
    ctx.fillStyle = PAPER_COLOR;
    ctx.fillRect(0, 0, width, height);

    // ----- 水引の飾り(画面の紙と同じ位置・同じ色) -----
    // 金の二重線の枠。strokeRect = 四角の線だけを描く命令です
    ctx.strokeStyle = "rgba(194, 161, 77, 0.7)";
    ctx.lineWidth = 1;
    ctx.strokeRect(8.5, 8.5, width - 17, height - 17);
    ctx.strokeStyle = "rgba(194, 161, 77, 0.4)";
    ctx.strokeRect(12.5, 12.5, width - 25, height - 25);
    // 左下の紅白の結び目。画面と同じ絵(public/knot.svg)を、横幅 72px で描きます
    const knot = new Image();
    knot.src = "/knot.svg";
    await knot.decode();
    const knotHeight = (72 * knot.naturalHeight) / knot.naturalWidth;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(knot, 10, height - 10 - knotHeight, 72, knotHeight);
    ctx.globalAlpha = 1;

    // textBaseline = "middle" … 指定した高さが、文字の縦の真ん中になる
    ctx.textBaseline = "middle";

    // ----- 置いたものを1つずつ描く -----
    // for (const item of items) は、配列から1つずつ取り出すくり返しです
    for (const item of items) {
      // 中身を描き始める位置(置いた位置 + 内側の余白)
      const left = item.x + ITEM_PADDING;
      const top = item.y + ITEM_PADDING;
      // 中身を置ける横幅(置いたものの横幅 - 左右の余白)
      const contentWidth = item.width - ITEM_PADDING * 2;
      // 文字の設定(ここで決めたものが、下の fillText で使われます)
      ctx.font = `${item.fontSize}px ${fontFamilyOf(item.fontKey)}`;
      const lineHeight = lineHeightOf(item.fontSize);

      // ▼ Google Fonts のフォントは、選んだときに読み込むので、まだ届いていないことがあります。
      //   届く前に描くと、ちがうフォントで画像になってしまうので、ここで待ちます
      //
      //   ▼ 失敗しても止めません
      //     next/font は、フォントごとに「届くまでの代わり」（Arial など端末に入っているもの）を登録しています。
      //     その代わりのフォントが端末に無いと（Android など）、本命のフォントは届いているのに
      //     ここが「A network error occurred.」で失敗し、手紙が送れなくなっていました。
      //     失敗しても、届いているフォントでそのまま描けるので、先へ進みます
      if (item.type !== "photo") {
        try {
          await document.fonts.load(ctx.font, item.type === "text" ? item.text : item.url);
        } catch {
          // 代わりのフォントが無いだけなので、気にせず描きます
        }
      }

      // ▼ 回っているときは、枠の真ん中を軸に、紙ごと回してから描きます。
      //   save / restore で、次のものを描くときには元の向きに戻します。
      //   枠の高さは、画面に出ている枠から測ります(中身の行数などで決まるため)
      const box = paper.querySelector<HTMLElement>(`[data-item-id="${item.id}"]`);
      const boxHeight = box?.offsetHeight ?? 0;
      const centerX = item.x + item.width / 2;
      const centerY = item.y + boxHeight / 2;
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate((item.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);

      // ===== テキスト =====
      if (item.type === "text") {
        ctx.fillStyle = item.color;
        const lines = wrapText(ctx, item.text, contentWidth);
        // .forEach((line, i) => ...) は、配列の1つ1つに処理をするくり返しです
        lines.forEach((line, i) => {
          // i 行目の縦の真ん中 = 上端 + 行の高さの半分 + 行の高さ × i
          ctx.fillText(line, left, top + lineHeight / 2 + lineHeight * i);
        });
      }

      // ===== 写真 =====
      if (item.type === "photo" && item.imageSrc !== "") {
        // new Image() は「画面に出さない画像の入れ物」です
        const img = new Image();
        img.src = item.imageSrc;
        // decode() は「画像の読み込みが終わるまで待つ」関数です
        await img.decode();
        // 高さを決めていないときは、元の写真の比率のままの高さにします
        const h = item.photoHeight ?? (contentWidth * img.naturalHeight) / img.naturalWidth;

        // ▼ 画面の object-cover と同じく、枠いっぱいに広げて、はみ出たぶんを切り取ります。
        //   枠が写真より横長なら上下を、縦長なら左右を、真ん中を残して切ります
        const scale = Math.max(contentWidth / img.naturalWidth, h / img.naturalHeight);
        const sw = contentWidth / scale; // 写真から切り出す横幅
        const sh = h / scale; // 写真から切り出す高さ
        const sx = (img.naturalWidth - sw) / 2;
        const sy = (img.naturalHeight - sh) / 2;
        ctx.drawImage(img, sx, sy, sw, sh, left, top, contentWidth, h);
      }

      // ===== URL =====
      if (item.type === "url" && item.url.trim() !== "") {
        ctx.fillStyle = item.color;
        const t = fitText(ctx, item.url, contentWidth);
        const textCenterY = top + lineHeight / 2;
        ctx.fillText(t, left, textCenterY);
        // 下線(文字の少し下に、高さ1pxの細い四角を塗る)。文字が大きいほど下にずらします
        ctx.fillRect(left, textCenterY + item.fontSize * 0.6, ctx.measureText(t).width, 1);
      }

      ctx.restore();
    }

    // ----- PNG にする -----
    // toBlob は、終わったときに結果を渡してくれる形の関数なので、
    // new Promise で包んで、await で待てるようにしています
    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });
  }

  // =====================================================
  // 未来へ送る(保存する)
  // =====================================================

  // いま選んでいるもの(何も選んでいないときは undefined)
  const selectedItem = items.find((it) => it.id === selectedId);

  // 紙の上に、中身の入ったものが1つでもあるか
  const hasContent = items.some(
    (it) =>
      (it.type === "text" && it.text.trim() !== "") ||
      (it.type === "photo" && it.imageSrc !== "") ||
      (it.type === "url" && it.url.trim() !== "")
  );

  async function handleSend() {
    if (isSending) {
      return;
    }
    if (!hasContent) {
      setErrorText("手紙に何か書いてから送ってください");
      return;
    }

    setIsSending(true);
    setErrorText(null);
    setSelectedId(null);

    // ▼ try / catch / finally について
    // try の中で throw new Error(...) が起きると、残りを飛ばして catch に移ります
    // finally の中は、成功しても失敗しても、最後に必ず実行されます
    try {
      const supabase = createClient();

      // ----- 1. ログイン中のユーザーを取る -----
      // getClaims() = ログインの証明書を、この場で確かめる命令(Supabase まで聞きに行かないので速い)
      const claimsResult = await supabase.auth.getClaims();
      const userId = claimsResult.data?.claims.sub;
      if (!userId) {
        throw new Error("ログインしていません。/login からログインしてください");
      }
      const user = { id: userId };

      // ----- 1.5 送り先のコミュニティ -----
      // 封筒の画面で選んだもの(1つしか入っていなければ、それ)です
      if (!communityId) {
        throw new Error(
          "コミュニティに入っていません。先にコミュニティに参加してください",
        );
      }

      // ----- 2. 紙を PNG にする -----
      const blob = await makeLetterPng();
      if (blob === null) {
        throw new Error("画像への変換に失敗しました");
      }

      // ----- 3. 手紙の ID を先に作り、画像をアップロードする -----
      // crypto.randomUUID() は「重ならない ID」を作る関数です
      // 先に作っておくと、保存したあとにデータベースへ ID を聞き直さなくて済みます
      // (time_capsules は開封日前だと中身を返さない設定なので、聞き直せないためです)
      const capsuleId = crypto.randomUUID();
      const path = `${user.id}/${capsuleId}.png`;

      const uploadResult = await supabase.storage
        .from(BUCKET)
        // cacheControl = 「この画像は1年間そのまま使い回してよい」とブラウザに伝えます。
        // ファイル名は手紙ごとにちがうので、同じ名前の中身が変わることはありません
        .upload(path, blob, { contentType: "image/png", cacheControl: "31536000" });
      if (uploadResult.error !== null) {
        throw new Error("画像の保存: " + uploadResult.error.message);
      }

      // ----- 4. time_capsules に手紙を追加する -----
      // 開封日：封筒の画面で入れた年月日
      const openAt = openDate;

      // body にはテキストの中身をつなげて入れます(なければ null)
      const bodyText = items
        .filter((it) => it.type === "text" && it.text.trim() !== "")
        .map((it) => it.text)
        .join("\n\n");

      const capsuleResult = await supabase.from("time_capsules").insert({
        id: capsuleId,
        community_id: communityId,
        author_id: user.id,
        image_url: path,
        body: bodyText === "" ? null : bodyText,
        // toISOString() は、日時をデータベースが読める文字の形にする関数です
        open_at: openAt.toISOString(),
      });
      if (capsuleResult.error !== null) {
        throw new Error("手紙の保存: " + capsuleResult.error.message);
      }

      // ----- 5. イベントがあれば、events と event_date_options に追加する -----
      if (eventPlan !== null) {
        const eventId = crypto.randomUUID();

        const eventResult = await supabase.from("events").insert({
          id: eventId,
          capsule_id: capsuleId,
          community_id: communityId,
          created_by: user.id,
          name: eventPlan.name,
        });
        if (eventResult.error !== null) {
          throw new Error("イベントの保存: " + eventResult.error.message);
        }

        // 候補日の数だけ行を作って、まとめて追加します
        // insert に配列を渡すと、1回で何行も追加できます
        const optionsResult = await supabase.from("event_date_options").insert(
          eventPlan.dates.map((d) => ({
            event_id: eventId,
            community_id: communityId,
            event_date: d,
          }))
        );
        if (optionsResult.error !== null) {
          throw new Error("候補日の保存: " + optionsResult.error.message);
        }
      }

      // ここまで来たら全部成功
      setIsSent(true);
    } catch (error) {
      // error instanceof Error は「error が Error の形をしているか」を調べます
      const message =
        error instanceof Error ? error.message : "不明なエラーが起きました";
      setErrorText(message);
    } finally {
      setIsSending(false);
      // 失敗したときにエラーが見えるよう、封筒は閉じます(成功時は送信完了の画面になります)
      setShowEnvelope(false);
      setSwipeY(0);
    }
  }

  // =====================================================
  // 封筒とスワイプ
  // =====================================================

  // ----- 「未来へ送る」を押したとき:封筒を出す -----
  async function openEnvelope() {
    if (!hasContent) {
      setErrorText("手紙に何か書いてから送ってください");
      return;
    }
    setErrorText(null);
    setSelectedId(null);
    setSwipeY(0);
    setShowEnvelope(true);

    // 送り先の候補。RLS で「自分が入っているもの」だけが返ります
    if (communities.length === 0) {
      const { data } = await createClient()
        .from("communities")
        .select("id, name")
        // 作った順に並べます（ホームのコミュニティ切り替えと同じ順）
        .order("created_at", { ascending: true });
      setCommunities(data ?? []);
      // 最初は先頭を選んだ状態にします
      if (data && data.length > 0 && communityId === "") setCommunityId(data[0].id);
    }
  }

  // ----- 指を置いた -----
  function handleSwipeStart(e: PointerEvent<HTMLDivElement>) {
    // 日付が入るまでは、スワイプできません(未来の日付でないと、送ってすぐ開けられてしまうため)
    if (isSending || !canSwipe) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeStartRef.current = e.clientY;
    setIsSwiping(true);
  }

  // ----- 指を動かしている間:上に動いたぶんだけ封筒を持ち上げる -----
  function handleSwipeMove(e: PointerEvent<HTMLDivElement>) {
    if (swipeStartRef.current === null) {
      return;
    }
    // 下に動かしても 0 のまま(マイナスにならないようにする)
    setSwipeY(Math.max(0, swipeStartRef.current - e.clientY));
  }

  // ----- 指を離した:十分上がっていたら送る。足りなければ元に戻す -----
  function handleSwipeEnd() {
    if (swipeStartRef.current === null) {
      return;
    }
    swipeStartRef.current = null;
    setIsSwiping(false);
    if (swipeY >= SWIPE_SEND_DISTANCE) {
      handleSend();
    } else {
      setSwipeY(0);
    }
  }

  // ----- もう一通書く(全部空に戻す) -----
  function resetAll() {
    setItems([]);
    setEventPlan(null);
    setOpenYear("");
    setOpenMonth("");
    setOpenDay("");
    setSelectedId(null);
    setErrorText(null);
    setIsSent(false);
  }

  // =====================================================
  // 紙の上のものの中身を、種類ごとに作る
  // =====================================================
  function renderBody(item: Item) {
    // 選んだ大きさ・フォント・色を、そのまま style にします
    // (Tailwind のクラスは、あらかじめ決めた値しか使えないため)
    const textStyle = {
      fontSize: item.fontSize,
      fontFamily: fontFamilyOf(item.fontKey),
      color: item.color,
      lineHeight: `${lineHeightOf(item.fontSize)}px`,
    };

    // ===== テキスト =====
    if (item.type === "text") {
      return (
        <textarea
          rows={1}
          value={item.text}
          // 文字の大きさを変えたときにも、高さを合わせ直すためです
          // (onChange だけだと、文字を打ったときにしか高さが変わりません)
          ref={(el) => {
            if (el !== null) {
              autoResize(el);
            }
          }}
          style={textStyle}
          autoFocus
          onChange={(e) => {
            autoResize(e.target);
            updateItem(item.id, { text: e.target.value });
          }}
          placeholder="テキストを入力"
          className="block w-full resize-none overflow-hidden bg-transparent outline-none placeholder:text-stone-300"
        />
      );
    }

    // ===== 写真 =====
    if (item.type === "photo") {
      if (item.imageSrc === "") {
        return (
          <label className="inline-flex h-11 cursor-pointer items-center rounded-full border border-kin/60 bg-white px-4 text-xs text-kin">
            ファイルを選択
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                // ▼ 大きすぎる写真は、先に小さくしてから置きます(lib/image.ts)。
                //   スマホの写真はそのままだと 3〜5MB あり、送るときに紙の画像を作るのが遅くなるためです。
                //   縮められない形式(HEIC など)のときは、元のまま使います
                let blob: Blob = file;
                try {
                  blob = await shrinkImage(file);
                } catch {
                  blob = file;
                }
                updateItem(item.id, { imageSrc: URL.createObjectURL(blob) });
              }}
            />
          </label>
        );
      }
      return (
        // object-cover = 枠の形が写真と違っても、ゆがめずに、はみ出たぶんを切り取って見せる
        // eslint-disable-next-line @next/next/no-img-element -- その場で選んだ写真（blob: の URL）は、next/image では出せないため
        <img
          src={item.imageSrc}
          alt="選んだ写真"
          draggable={false}
          className="block w-full object-cover"
          style={{ height: item.photoHeight ?? "auto" }}
        />
      );
    }

    // ===== URL(ここまで来たら type は "url") =====

    if (selectedId !== item.id && item.url !== "") {
      return (
        <span className="flex items-center gap-1" style={textStyle}>
          {LinkIcon}
          <span className="truncate underline">{item.url}</span>
        </span>
      );
    }

    const link = item.url.startsWith("http") ? (
      <a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-stone-500 underline">
        開く
      </a>
    ) : null;

    return (
      <div>
        <div className="flex items-center gap-1" style={textStyle}>
          {LinkIcon}
          <input
            type="url"
            value={item.url}
            onChange={(e) => updateItem(item.id, { url: e.target.value })}
            placeholder="https://..."
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-stone-300"
          />
        </div>
        {link}
      </div>
    );
  }

  // =====================================================
  // 送信が終わったあとの画面
  // =====================================================
  if (isSent) {
    return (
      <main className="flex h-full items-center justify-center overflow-hidden bg-[#f3ede2] p-6 text-stone-800">
        <div className="w-full max-w-[430px] text-center">
          <p className="mb-2 text-lg font-bold">未来へ送りました</p>
          <p className="mb-8 text-sm text-stone-500">
            {openDate.toLocaleDateString("ja-JP")} に、みんなのもとへ届きます
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="h-11 rounded-full border border-kin/60 bg-white px-6 text-sm text-kin"
          >
            もう一通書く
          </button>
        </div>
      </main>
    );
  }

  // =====================================================
  // 画面
  // =====================================================
  return (
    // h-full = 親(layout の main)の高さにぴったり合わせる。
    // 以前の min-h-screen と h-[78vh] は、下タブのぶんだけ親より高くなり、
    // 画面がスクロールしてしまっていました。
    // relative = 下の封筒を、ブラウザ全体ではなくこの画面の中に重ねるための基準
    <main className="relative flex h-full justify-center overflow-hidden bg-[#f3ede2] text-stone-800">
      {/* ===== スマホの幅の入れ物 ===== */}
      {/* pb は、下に重なっている下タブのぶんの逃げです。
          この画面には下タブが出ているので、4px だけだと
          いちばん下にある「未来へ送る」ボタンが裏に隠れてしまいます。
          env(safe-area-inset-bottom) は iPhone 下端の横棒のぶんです。 */}
      <div className="relative flex h-full w-full max-w-[430px] flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] pt-4">
        {/* ===== 手紙の紙 ===== */}
        <div
          ref={paperRef}
          // ▼ 紙の何もない所を軽く押したら、選ぶのをやめます。
          //   押した瞬間(onPointerDown)ではなく、離したあと(onClick)に判断します。
          //   押した瞬間だと、2本指で挟もうとした1本目で、選んでいたものが外れてしまうためです
          onPointerDown={(e) => {
            // 1本目の指のとき(isPrimary)に、前回のピンチの印を消します
            if (e.isPrimary) {
              pinchedRef.current = false;
            }
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !pinchedRef.current) {
              setSelectedId(null);
            }
          }}
          // flex-1 = ボタンのぶんを残して、余った高さを全部つかう。
          // min-h-0 = 中身が大きくても、枠からはみ出させない。
          className="relative min-h-0 flex-1 overflow-hidden bg-[#fdfbf5] shadow-md"
        >
          {/* ▼ 水引の飾り。紙のふちに金の二重線、左下に紅白の結び目を置きます。
              pointer-events-none = 飾りの上を押しても、紙を押したことになるようにします。
              同じ飾りを、送る画像にも描いています(makeLetterPng の drawDecoration) */}
          <div className="pointer-events-none absolute inset-[8px] rounded-sm border border-kin/70" />
          <div className="pointer-events-none absolute inset-[12px] rounded-sm border border-kin/40" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/knot.svg"
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute bottom-[10px] left-[10px] w-[72px] opacity-90"
          />
          {/* ----- 置いたもの ----- */}
          {items.map((item) => {
            const isSelected = selectedId === item.id;

            return (
              <div
                key={item.id}
                // 回転や画像を作るときに、この枠を探し出すための目印
                data-item-id={item.id}
                // 押す・動かすの見分けは bindDrag(上の「ドラッグ」)にまかせます
                {...bindDrag(item.id)}
                className={`absolute cursor-move select-none p-2 ${
                  isSelected ? "outline outline-1 outline-stone-700" : ""
                }`}
                style={{
                  left: item.x,
                  top: item.y,
                  width: item.width,
                  // テキスト・URL の枠の高さ(上下の〇で広げたとき)
                  minHeight: item.type !== "photo" ? (item.boxHeight ?? undefined) : undefined,
                  // 真ん中を軸に回します(transform の軸は、何も書かなければ真ん中です)
                  transform: item.rotation !== 0 ? `rotate(${item.rotation}deg)` : undefined,
                  touchAction: "none",
                }}
              >
                {renderBody(item)}

                {isSelected && (
                  <>
                    {/* ▼ 枠の上に、削除のボタンを置きます。
                        (回すのは2本指でできるので、回転のボタンは無くしました)
                        枠から細い点線でつなぎ、どの枠のボタンか分かるようにしています。
                        見た目は 28px の丸ですが、押せる範囲は 44px あります */}
                    <span className="pointer-events-none absolute -top-8 left-1/2 h-6 -translate-x-1/2 border-l border-dotted border-stone-700" />
                    <div className="absolute -top-[68px] left-1/2 flex -translate-x-1/2">
                      {/* 削除 */}
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        aria-label="削除"
                        className="flex h-11 w-11 items-center justify-center"
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-700 bg-white text-xs text-stone-700 shadow-sm">
                          ×
                        </span>
                      </button>
                    </div>

                    {/* 枠の〇(四つ角と、辺の中点)。引っぱると大きさや形が変わります。
                        見た目は 12px ですが、押せる範囲は 44px あります */}
                    {HANDLES.filter((h) => {
                      // 写真をまだ選んでいないときは、大きさを変えられないので、
                      // 四つ角だけを飾りとして出します
                      if (item.type === "photo" && item.imageSrc === "") {
                        return h.handle.length === 2;
                      }
                      return true;
                    }).map((h) =>
                      item.type === "photo" && item.imageSrc === "" ? (
                        <span
                          key={h.handle}
                          className={`pointer-events-none absolute flex h-11 w-11 items-center justify-center ${h.position}`}
                        >
                          <span className="h-3 w-3 rounded-full border border-stone-700 bg-white" />
                        </span>
                      ) : (
                        <button
                          key={h.handle}
                          type="button"
                          aria-label="大きさを変える"
                          onPointerDown={(e) => handleResizeDown(e, item, h.handle)}
                          onPointerMove={handleResizeMove}
                          onPointerUp={handleResizeUp}
                          onPointerCancel={handleResizeUp}
                          className={`absolute flex h-11 w-11 items-center justify-center ${h.position} ${h.cursor}`}
                          style={{ touchAction: "none" }}
                        >
                          <span className="h-3 w-3 rounded-full border border-stone-700 bg-white" />
                        </button>
                      )
                    )}
                  </>
                )}
              </div>
            );
          })}

          {/* ----- テキスト・URL を選んでいるときの道具 ----- */}
          {/* 文字の大きさは、写真と同じく四つ角を引っぱって変えます */}
          {selectedItem !== undefined && selectedItem.type !== "photo" && (
            <>
              {/* ===== 書体と色:紙の下の帯 =====
                  手紙の紙と同じ生成り色に、金の細いふち。
                  「書体」と「色」をタブで切り替えて、片方ずつ出します */}
              <div className="absolute inset-x-2 bottom-7 z-10 rounded-lg bg-[#fdfbf5] px-2 pb-1 shadow-sm ring-1 ring-kin/50">
                {/* 下線つきのタブ。カード作り(CardComposer)のタブと同じ見た目です */}
                <div className="flex border-b border-kin/30">
                  {(["font", "color"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStyleTab(tab)}
                      // h-11 = 押せる範囲 44px。
                      // 下線は選んでいないときも透明で引いておき、切り替えても高さが変わらないようにします
                      className={`-mb-px h-11 flex-1 border-b-2 text-sm font-bold ${
                        styleTab === tab ? "border-kin text-kin" : "border-transparent text-stone-400"
                      }`}
                    >
                      {tab === "font" ? "書体" : "色"}
                    </button>
                  ))}
                </div>

                {/* タブの中身の高さを固定します。
                    固定しないと、切り替えるたびに帯の高さが変わって、紙の上で上下に動いてしまいます */}
                <div className="flex h-[3.75rem] items-center">
                  {styleTab === "font" ? (
                    // ===== 書体:見本の「あ」と名前を書いた札を、横に並べます =====
                    <HorizontalScroller className="w-full">
                      {FONTS.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          onClick={() => updateItem(selectedItem.id, { fontKey: f.key })}
                          className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center gap-0.5 rounded-md ${
                            selectedItem.fontKey === f.key
                              ? "bg-white text-kin ring-1 ring-kin"
                              : "text-stone-700"
                          }`}
                        >
                          {/* 見本の字は、そのフォントで書きます */}
                          <span className="text-xl leading-none" style={{ fontFamily: f.family }}>
                            あ
                          </span>
                          <span className="whitespace-nowrap text-xs text-stone-500">{f.label}</span>
                        </button>
                      ))}
                    </HorizontalScroller>
                  ) : (
                    // ===== 色:色見本の四角を、横に並べます =====
                    // 名前は画面に出しませんが、読み上げ用に aria-label に残しています
                    <HorizontalScroller className="w-full">
                      {COLORS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => updateItem(selectedItem.id, { color: c.value })}
                          aria-label={c.label}
                          // 押せる範囲は 44px
                          className="flex h-11 w-11 shrink-0 items-center justify-center"
                        >
                          {/* border = 白い色でも、紙の上で四角が見えるように、うすい線でふちどります */}
                          <span
                            className={`h-7 w-7 rounded-sm border border-black/10 ${
                              selectedItem.color === c.value ? "ring-1 ring-kin ring-offset-2" : ""
                            }`}
                            style={{ backgroundColor: c.value }}
                          />
                        </button>
                      ))}
                    </HorizontalScroller>
                  )}
                </div>
              </div>
            </>
          )}

          {/* ----- 2本指で回して、まっすぐになったときの点線 ----- */}
          {/* 置いたものの真ん中を通る、横と縦の線です。紙の端から端まで引きます */}
          {rotateGuide !== null && (
            <>
              <span
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-beni"
                style={{ top: rotateGuide.y }}
              />
              <span
                className="pointer-events-none absolute inset-y-0 z-10 border-l border-dashed border-beni"
                style={{ left: rotateGuide.x }}
              />
            </>
          )}

          {/* ----- 右上の黒い丸ボタン ----- */}
          {/* 押せる範囲は 44px(h-11 w-11)。見た目の丸は 36px です。
              色はアプリにそろえて、白地に金のふち・金のアイコンにしています */}
          <div className="absolute right-1.5 top-1.5 z-10 flex flex-col gap-1">
            {TOOLS.map((tool) => (
              <button
                key={tool.type}
                type="button"
                onClick={() =>
                  tool.type === "event" ? openEventPanel() : addItem(tool.type)
                }
                aria-label={`${tool.label}を追加`}
                className="flex h-11 w-11 items-center justify-center active:scale-90"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-kin shadow-sm ring-1 ring-kin/60">
                  {tool.icon}
                </span>
              </button>
            ))}
          </div>



          {/* ----- 「予定調整へ」ボタン(イベントがあるときだけ) ----- */}
          {/* ※ PNG 画像には入れません(受けとる側で、本物のボタンとして出すため) */}
          {eventPlan !== null && (
            <button
              type="button"
              onClick={openEventPanel}
              className="absolute bottom-10 right-3 rounded-full bg-[#efe8da] px-3 py-1 text-xs text-stone-700"
            >
              予定調整へ →
            </button>
          )}
        </div>

        {/* ===== 「未来へ送る」ボタン ===== */}
        <button
          type="button"
          onClick={openEnvelope}
          // 送信中は押せないようにします(2回送ってしまうのを防ぐため)
          disabled={isSending}
          // shrink-0 = 場所が足りなくても縮めない。h-11 = 押せる範囲 44px
          className="relative -mt-5 mr-2 flex h-11 shrink-0 items-center gap-2 self-end rounded-full bg-beni px-5 text-sm font-bold text-white shadow ring-1 ring-kin ring-offset-2 ring-offset-[#f3ede2] disabled:opacity-60"
        >
          未来へ送る
          {SendIcon}
        </button>

        {/* ===== エラーの表示 ===== */}
        {/* 紙の大きさが変わらないよう、absolute で重ねて出します。
            「未来へ送る」ボタンは紙の下に 20px 食いこんでいるので、
            紙の下には、ボタンの左に高さ 24px(h-6)のすき間ができます。そこに1行で出します。
            bottom は外側の枠の pb と同じ値 = ボタンの下端にそろえるためです */}
        {errorText !== null && (
          <p className="absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-4 right-40 flex h-6 items-center text-xs font-bold text-beni">
            {errorText}
          </p>
        )}
      </div>

      {/* ===================================================== */}
      {/* 封筒(日付を入れて、上にスワイプして送る) */}
      {/* 紙(paperRef)を消さないよう、別の画面にせず上に重ねています */}
      {/* ===================================================== */}
      {showEnvelope && (
        // absolute = この画面(main)の中だけに重ねます。
        // 前は fixed で、スマホ幅の枠を越えてブラウザ全体を覆ってしまっていました。
        // 不透明にして、後ろの紙が透けないようにしています
        // z-50 = 下タブ(z-40)より手前に出して、ボタンが隠れないようにします
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f3ede2]">
          <div className="flex w-full max-w-[430px] flex-col items-center gap-6 px-4">
            {/* 上向きの矢印。日付が入って送れるようになると、金色になって上下に揺れます */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              // 大きく・太くして、ひと目で「上へ」と分かるようにしています
              strokeWidth="2.5"
              className={`h-20 w-20 ${canSwipe ? "animate-bounce text-kin" : "text-stone-300"}`}
            >
              <path d="M12 19V5" />
              <path d="M5 12l7-7 7 7" />
            </svg>

            {/* 封筒本体。touchAction: none = 指の上下の動きで画面がスクロールしないようにする */}
            <div
              onPointerDown={handleSwipeStart}
              onPointerMove={handleSwipeMove}
              onPointerUp={handleSwipeEnd}
              onPointerCancel={handleSwipeEnd}
              style={{
                transform: `translateY(${-swipeY}px)`,
                opacity: 1 - Math.min(swipeY / (SWIPE_SEND_DISTANCE * 2), 0.5),
                // 指で動かしている間は遅れず追いかけ、離したら元へなめらかに戻す
                transition: isSwiping ? "none" : "transform 0.2s",
                touchAction: "none",
              }}
              // 日付が未入力のあいだは薄くして、動かせないことを見た目でも伝える
              className={`relative flex h-52 w-full select-none items-center justify-center rounded-xl bg-[#fdfbf5] shadow-lg ${
                canSwipe ? "cursor-grab" : "opacity-60"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="#a8a29e" strokeWidth="0.6" className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
                <path d="M0 3l12 9 12-9" />
              </svg>
              {/* 封筒に、ご祝儀袋のような紅・白・金の水引の帯と、真ん中に結び目をかけます */}
              <div className="pointer-events-none absolute inset-x-0 top-[62%] flex flex-col gap-[2px]">
                <span className="h-[3px] bg-beni" />
                <span className="h-[3px] bg-white" />
                <span className="h-[2px] bg-kin" />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/knot.svg"
                alt=""
                aria-hidden="true"
                className="pointer-events-none absolute left-1/2 top-[62%] w-24 -translate-x-1/2 -translate-y-1/2 drop-shadow"
              />
              {isSending && (
                <span className="relative rounded-full bg-beni px-4 py-2 text-sm text-white">
                  送信中…
                </span>
              )}
            </div>

            {/* ===== 何年何月何日の私たちへ ===== */}
            {/* 数を選ぶだけなので、select を3つ並べています。
                押しやすいよう高さ 48px(h-12)、文字は 17px にしています */}
            <div className="flex flex-wrap items-center justify-center gap-1.5 text-base text-stone-700">
              <select
                value={openYear}
                onChange={(e) => setOpenYear(e.target.value)}
                aria-label="開封する年"
                className={DATE_SELECT}
              >
                <option value="">----</option>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              年
              <select
                value={openMonth}
                onChange={(e) => setOpenMonth(e.target.value)}
                aria-label="開封する月"
                className={DATE_SELECT}
              >
                <option value="">--</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              月
              <select
                value={openDay}
                onChange={(e) => setOpenDay(e.target.value)}
                aria-label="開封する日"
                className={DATE_SELECT}
              >
                <option value="">--</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              日の私たちへ
            </div>

            {/* 入れた日付が過去・存在しない日のときだけ、短く知らせます */}
            {isDateValid && !canSwipe && <p className="text-sm text-beni">過去の日付です</p>}
            {openYear !== "" && openMonth !== "" && openDay !== "" && !isDateValid && (
              <p className="text-sm text-beni">存在しない日付です</p>
            )}

            {/* ===== 送り先のコミュニティ(2つ以上入っているときだけ選べます) ===== */}
            {communities.length > 1 && (
              <label className="flex items-center gap-2 text-sm text-stone-700">
                送り先
                <select
                  value={communityId}
                  onChange={(e) => setCommunityId(e.target.value)}
                  className="h-11 rounded-lg bg-[#fdfbf5] px-3 shadow-sm ring-1 ring-kin/40"
                >
                  {communities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={() => setShowEnvelope(false)}
              disabled={isSending}
              className="h-11 px-4 text-sm text-stone-500 disabled:opacity-40"
            >
              やめる
            </button>
          </div>
        </div>
      )}

      {/* ===================================================== */}
      {/* イベントのパネル(draft が null でないときだけ表示) */}
      {/* ===================================================== */}
      {draft !== null && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              closeEventPanel();
            }
          }}
          // absolute = アプリの枠(スマホ幅)の中だけに重ねます。前は fixed で、PC では画面全体を覆っていました。
          // z-50 = 下タブ(z-40)より手前。前は z-10 で、決定ボタンが下タブの裏に隠れていました
          className="absolute inset-0 z-50 flex items-end justify-center bg-black/30"
        >
          <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-[#fdfbf5] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
            <p className="mb-4 flex items-center gap-2 font-bold">
              {CalendarIcon}
              イベントを企画する
            </p>

            {/* イベント名 */}
            <label className="mb-1 block text-xs text-stone-500">イベント名</label>
            <input
              type="text"
              value={draft.name}
              autoFocus
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder="例：飲み会"
              className="mb-4 w-full border-b border-stone-300 bg-transparent py-1 outline-none placeholder:text-stone-300"
            />

            {/* 候補日 */}
            <p className="mb-1 text-xs text-stone-500">イベント候補日</p>
            {draft.rows.map((row, index) => (
              <div key={index} className="mb-3">
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={row.start}
                    onChange={(e) => updateRow(index, { start: e.target.value })}
                    aria-label="候補日"
                    className="h-11 min-w-0 flex-1 border-b border-stone-300 bg-transparent text-base outline-none"
                  />
                  {/* 期間のときだけ、終わりの日の欄を出します */}
                  {row.isRange && (
                    <>
                      <span className="text-stone-400">〜</span>
                      <input
                        type="date"
                        value={row.end}
                        min={row.start}
                        onChange={(e) => updateRow(index, { end: e.target.value })}
                        aria-label="期間の終わりの日"
                        className="h-11 min-w-0 flex-1 border-b border-stone-300 bg-transparent text-base outline-none"
                      />
                    </>
                  )}
                  {draft.rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({ ...draft, rows: draft.rows.filter((_, i) => i !== index) })
                      }
                      aria-label="この候補日を消す"
                      className="flex h-11 w-11 shrink-0 items-center justify-center text-xl text-stone-400"
                    >
                      ×
                    </button>
                  )}
                </div>
                {/* 1日 / 期間 の切り替え */}
                <div className="mt-1 flex gap-1">
                  {[false, true].map((isRange) => (
                    <button
                      key={String(isRange)}
                      type="button"
                      onClick={() => updateRow(index, { isRange, end: isRange ? row.end : "" })}
                      className={`h-9 rounded-full px-3 text-sm ${
                        row.isRange === isRange
                          ? "bg-white font-bold text-kin ring-1 ring-kin"
                          : "text-stone-400"
                      }`}
                    >
                      {isRange ? "期間" : "1日"}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {hasDuplicate && (
              <p className="mb-2 text-xs text-beni">同じ日が入っています</p>
            )}

            <button
              type="button"
              onClick={() =>
                setDraft({ ...draft, rows: [...draft.rows, { start: "", end: "", isRange: false }] })
              }
              className="mb-6 h-11 rounded-full border border-kin/60 px-4 text-sm text-kin"
            >
              ＋ 候補日を追加
            </button>

            {/* 決定・キャンセル */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeEventPanel}
                className="h-11 flex-1 rounded-xl border border-stone-300 text-sm text-stone-600"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEvent}
                disabled={!canSaveEvent}
                className="h-11 flex-1 rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-40"
              >
                決定
              </button>
            </div>

            {eventPlan !== null && (
              <button
                type="button"
                onClick={removeEvent}
                className="mt-3 h-11 w-full text-xs text-beni"
              >
                イベントを削除
              </button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
