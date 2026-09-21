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

import { useRef, useState } from "react";
// PointerEvent … 指やマウスで押した・動かしたときの情報の型
// ReactNode … 「画面に表示できるもの(文字やアイコンなど)」の型
import type { PointerEvent, ReactNode } from "react";
// Supabase(データベース)とつながる窓口を作る関数(手書き機能と同じもの)
import { createClient } from "@/lib/supabase/client";

// =====================================================
// 保存に使う設定
// =====================================================

// 送り先のコミュニティ(今は手書き機能と同じく、動作確認のため固定)
const COMMUNITY_ID = "dfda40cd-2953-45b0-8620-26f03b9d7c58";

// 画像を保存する Storage のバケット名(手書き機能と同じ場所)
const BUCKET = "drawings";

// 開封日の年を、今年から何年先まで選べるようにするか
const MAX_YEARS_AHEAD = 30;

// 封筒を上に何px以上スワイプしたら「送る」とみなすか
const SWIPE_SEND_DISTANCE = 120;

// =====================================================
// 見た目の設定(画面と PNG 画像で同じ値を使います)
// =====================================================

const PAPER_COLOR = "#fdfbf5"; // 紙の色
const TEXT_COLOR = "#292524"; // 文字の色(Tailwind の stone-800)
const LINK_COLOR = "#44403c"; // URL の文字の色(Tailwind の stone-700)
const ITEM_WIDTH = 208; // 置いたものの横幅(Tailwind の w-52 = 208px)
const ITEM_PADDING = 8; // 置いたものの内側の余白(Tailwind の p-2 = 8px)
const CONTENT_WIDTH = ITEM_WIDTH - ITEM_PADDING * 2; // 中身を置ける横幅
const FONT = "14px Arial, Helvetica, sans-serif"; // 文字の大きさと種類(text-sm = 14px)
const LINE_HEIGHT = 24; // 1行の高さ(leading-6 = 24px)

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
};

// イベント(日程調整)のデータの形です。紙の上のものとは別に覚えておきます。
type EventPlan = {
  name: string; // イベント名(events.name に入れる)
  dates: string[]; // 候補日の一覧(event_date_options.event_date に入れる)
};

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
  };
}

// ===== アイコン =====
// ※ コピーで行が消えないように、1つのアイコンを1行で書いています

// 写真のアイコン
const ImageIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>;

// リンクのアイコン
const LinkIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" /><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" /></svg>;

// カレンダーのアイコン(イベント用)
const CalendarIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>;

// 紙飛行機のアイコン(「未来へ送る」ボタン用)
const SendIcon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="h-4 w-4"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>;

// 紙の右上に並べる、黒い丸ボタンの一覧(上から順番に表示されます)
const TOOLS: { type: ItemType | "event"; label: string; icon: ReactNode }[] = [
  { type: "text", label: "テキスト", icon: <span className="font-serif text-base font-bold">T</span> },
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
  const [draft, setDraft] = useState<EventPlan | null>(null);

  // ===== 開封日(何年何月何日の私たちへ) =====
  // 封筒の画面で入力します。最初は空(""＝未入力)。
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

  // ===== 封筒のスワイプのための状態 =====
  const [showEnvelope, setShowEnvelope] = useState(false); // 封筒を出しているか
  const [swipeY, setSwipeY] = useState(0); // 上に何px動かしたか
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

  // いまドラッグ中のものの情報(ドラッグしていないときは null)
  const dragRef = useRef<{ id: number; offsetX: number; offsetY: number } | null>(
    null
  );

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
      setDraft({ name: "", dates: [""] });
    } else {
      setDraft({ name: eventPlan.name, dates: [...eventPlan.dates] });
    }
  }

  // ----- パネルを閉じる(キャンセル) -----
  function closeEventPanel() {
    setDraft(null);
  }

  // 入力済みの候補日だけを取り出します(空の入力欄は除く)
  const filledDates = draft === null ? [] : draft.dates.filter((d) => d !== "");

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

  // ----- 押した瞬間 -----
  function handlePointerDown(e: PointerEvent<HTMLDivElement>, item: Item) {
    setSelectedId(item.id);

    // 入力欄・ボタン・label の上を押したときは、ドラッグを始めません
    const target = e.target as HTMLElement;
    if (target.closest("textarea, input, button, label")) {
      return;
    }

    if (paperRef.current === null) {
      return;
    }
    const rect = paperRef.current.getBoundingClientRect();

    e.currentTarget.setPointerCapture(e.pointerId);

    dragRef.current = {
      id: item.id,
      offsetX: e.clientX - rect.left - item.x,
      offsetY: e.clientY - rect.top - item.y,
    };
  }

  // ----- 押したまま動かしている間 -----
  function handlePointerMove(e: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (drag === null || paperRef.current === null) {
      return;
    }
    const rect = paperRef.current.getBoundingClientRect();

    let x = e.clientX - rect.left - drag.offsetX;
    let y = e.clientY - rect.top - drag.offsetY;

    x = Math.max(0, Math.min(x, rect.width - 60));
    y = Math.max(0, Math.min(y, rect.height - 40));

    updateItem(drag.id, { x, y });
  }

  // ----- 離した瞬間 -----
  function handlePointerUp() {
    dragRef.current = null;
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

    // 文字の設定(ここで決めたものが、下の fillText で使われます)
    ctx.font = FONT;
    // textBaseline = "middle" … 指定した高さが、文字の縦の真ん中になる
    ctx.textBaseline = "middle";

    // ----- 置いたものを1つずつ描く -----
    // for (const item of items) は、配列から1つずつ取り出すくり返しです
    for (const item of items) {
      // 中身を描き始める位置(置いた位置 + 内側の余白)
      const left = item.x + ITEM_PADDING;
      const top = item.y + ITEM_PADDING;

      // ===== テキスト =====
      if (item.type === "text") {
        ctx.fillStyle = TEXT_COLOR;
        const lines = wrapText(ctx, item.text, CONTENT_WIDTH);
        // .forEach((line, i) => ...) は、配列の1つ1つに処理をするくり返しです
        lines.forEach((line, i) => {
          // i 行目の縦の真ん中 = 上端 + 行の高さの半分 + 行の高さ × i
          ctx.fillText(line, left, top + LINE_HEIGHT / 2 + LINE_HEIGHT * i);
        });
      }

      // ===== 写真 =====
      if (item.type === "photo" && item.imageSrc !== "") {
        // new Image() は「画面に出さない画像の入れ物」です
        const img = new Image();
        img.src = item.imageSrc;
        // decode() は「画像の読み込みが終わるまで待つ」関数です
        await img.decode();
        // 横幅を CONTENT_WIDTH にそろえ、縦は元の写真の比率のままにします
        const h = (CONTENT_WIDTH * img.naturalHeight) / img.naturalWidth;
        ctx.drawImage(img, left, top, CONTENT_WIDTH, h);
      }

      // ===== URL =====
      if (item.type === "url" && item.url.trim() !== "") {
        ctx.fillStyle = LINK_COLOR;
        const t = fitText(ctx, item.url, CONTENT_WIDTH);
        const centerY = top + LINE_HEIGHT / 2;
        ctx.fillText(t, left, centerY);
        // 下線(文字の少し下に、高さ1pxの細い四角を塗る)
        ctx.fillRect(left, centerY + 8, ctx.measureText(t).width, 1);
      }
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
      const userResult = await supabase.auth.getUser();
      const user = userResult.data.user;
      if (user === null) {
        throw new Error("ログインしていません。/login からログインしてください");
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
        .upload(path, blob, { contentType: "image/png" });
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
        community_id: COMMUNITY_ID,
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
          community_id: COMMUNITY_ID,
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
            community_id: COMMUNITY_ID,
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
  function openEnvelope() {
    if (!hasContent) {
      setErrorText("手紙に何か書いてから送ってください");
      return;
    }
    setErrorText(null);
    setSelectedId(null);
    setSwipeY(0);
    setShowEnvelope(true);
  }

  // ----- 指を置いた -----
  function handleSwipeStart(e: PointerEvent<HTMLDivElement>) {
    // 日付が入るまでは、スワイプできません(未来の日付でないと、送ってすぐ開けられてしまうため)
    if (isSending || !canSwipe) {
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    swipeStartRef.current = e.clientY;
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
    // ===== テキスト =====
    if (item.type === "text") {
      return (
        <textarea
          rows={1}
          value={item.text}
          autoFocus
          onChange={(e) => {
            autoResize(e.target);
            updateItem(item.id, { text: e.target.value });
          }}
          placeholder="テキストを入力"
          className="block w-full resize-none overflow-hidden bg-transparent text-sm leading-6 outline-none placeholder:text-stone-300"
        />
      );
    }

    // ===== 写真 =====
    if (item.type === "photo") {
      if (item.imageSrc === "") {
        return (
          <label className="inline-block cursor-pointer rounded-full bg-stone-700 px-3 py-1 text-xs text-white">
            ファイルを選択
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  updateItem(item.id, { imageSrc: URL.createObjectURL(file) });
                }
              }}
            />
          </label>
        );
      }
      return (
        <img src={item.imageSrc} alt="選んだ写真" draggable={false} className="block w-full" />
      );
    }

    // ===== URL(ここまで来たら type は "url") =====

    if (selectedId !== item.id && item.url !== "") {
      return (
        <span className="flex items-center gap-1 text-sm text-stone-700">
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
        <div className="flex items-center gap-1 text-sm text-stone-700">
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
          <p className="mb-6">未来へ送りました</p>
          <button
            type="button"
            onClick={resetAll}
            className="rounded-full bg-stone-700 px-5 py-2 text-sm text-white"
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
    <main className="flex h-full justify-center overflow-hidden bg-[#f3ede2] text-stone-800">
      {/* ===== スマホの幅の入れ物 ===== */}
      <div className="relative flex h-full w-full max-w-[430px] flex-col px-4 pb-4 pt-4">
        {/* ===== 手紙の紙 ===== */}
        <div
          ref={paperRef}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedId(null);
            }
          }}
          // flex-1 = ボタンのぶんを残して、余った高さを全部つかう。
          // min-h-0 = 中身が大きくても、枠からはみ出させない。
          className="relative min-h-0 flex-1 overflow-hidden bg-[#fdfbf5] shadow-md"
        >
          {/* ----- 置いたもの ----- */}
          {items.map((item) => {
            const isSelected = selectedId === item.id;

            return (
              <div
                key={item.id}
                onPointerDown={(e) => handlePointerDown(e, item)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`absolute w-52 cursor-move select-none p-2 ${
                  isSelected ? "outline outline-1 outline-stone-700" : ""
                }`}
                style={{ left: item.x, top: item.y, touchAction: "none" }}
              >
                {renderBody(item)}

                {isSelected && (
                  <>
                    {/* 四隅の小さな〇(今は飾りです) */}
                    <span className="pointer-events-none absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full border border-stone-700 bg-white" />
                    <span className="pointer-events-none absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full border border-stone-700 bg-white" />
                    <span className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-3 w-3 rounded-full border border-stone-700 bg-white" />
                    <span className="pointer-events-none absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border border-stone-700 bg-white" />

                    {/* 枠の上の点線(×ボタンとつなぐ線) */}
                    <span className="pointer-events-none absolute -top-5 left-1/2 h-4 -translate-x-1/2 border-l border-dotted border-stone-700" />

                    {/* 削除ボタン */}
                    <button
                      type="button"
                      onClick={() => deleteItem(item.id)}
                      aria-label="削除"
                      className="absolute -top-11 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-stone-700 bg-white text-xs"
                    >
                      ×
                    </button>
                  </>
                )}
              </div>
            );
          })}

          {/* ----- 右上の黒い丸ボタン ----- */}
          <div className="absolute right-3 top-3 flex flex-col gap-3">
            {TOOLS.map((tool) => (
              <button
                key={tool.type}
                type="button"
                onClick={() =>
                  tool.type === "event" ? openEventPanel() : addItem(tool.type)
                }
                aria-label={`${tool.label}を追加`}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-stone-700 text-white shadow"
              >
                {tool.icon}
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
          className="relative -mt-5 mr-2 flex h-11 shrink-0 items-center gap-2 self-end rounded-full bg-stone-700 px-4 text-sm text-white shadow disabled:opacity-60"
        >
          未来へ送る
          {SendIcon}
        </button>

        {/* ===== エラーの表示 ===== */}
        {/* 紙の大きさが変わらないよう、absolute で紙の下に重ねて出します */}
        {errorText !== null && (
          <p className="absolute bottom-16 left-4 right-4 rounded-lg bg-white/90 p-2 text-sm text-red-600 shadow">
            {errorText}
          </p>
        )}
      </div>

      {/* ===================================================== */}
      {/* 封筒(日付を入れて、上にスワイプして送る) */}
      {/* 紙(paperRef)を消さないよう、別の画面にせず上に重ねています */}
      {/* ===================================================== */}
      {showEnvelope && (
        // 全画面で重ねるので、下タブもこの間は隠れます(不透明にして透けないようにする)
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-[#f3ede2]">
          <div className="flex w-full max-w-[430px] flex-col items-center gap-6 px-4">
            {/* 日付が入るまでは、スワイプできないことを伝える */}
            <p className={`text-sm ${canSwipe ? "text-stone-700" : "text-stone-400"}`}>
              {canSwipe ? "↑ スワイプして送信" : "未来の日付を入れるとスワイプできます"}
            </p>

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
                transition: swipeStartRef.current === null ? "transform 0.2s" : "none",
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
              {isSending && (
                <span className="relative rounded-full bg-stone-700 px-4 py-2 text-sm text-white">
                  送信中…
                </span>
              )}
            </div>

            {/* ===== 何年何月何日の私たちへ ===== */}
            {/* 数を選ぶだけなので、select を3つ並べています(高さ h-11 = 44px) */}
            <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
              <select
                value={openYear}
                onChange={(e) => setOpenYear(e.target.value)}
                aria-label="開封する年"
                className="h-11 rounded-lg bg-[#fdfbf5] px-2 shadow-sm"
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
                className="h-11 rounded-lg bg-[#fdfbf5] px-2 shadow-sm"
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
                className="h-11 rounded-lg bg-[#fdfbf5] px-2 shadow-sm"
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

            {/* 入れた日付が過去・存在しない日のときの案内 */}
            {isDateValid && !canSwipe && (
              <p className="text-xs text-red-500">未来の日付を選んでください</p>
            )}
            {openYear !== "" && openMonth !== "" && openDay !== "" && !isDateValid && (
              <p className="text-xs text-red-500">存在しない日付です</p>
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
          className="fixed inset-0 z-10 flex items-end justify-center bg-black/30"
        >
          <div className="max-h-[80vh] w-full max-w-[430px] overflow-y-auto rounded-t-2xl bg-[#fdfbf5] p-5">
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
            {draft.dates.map((d, index) => (
              <div key={index} className="mb-2 flex items-center gap-2">
                <input
                  type="date"
                  value={d}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      dates: draft.dates.map((old, i) =>
                        i === index ? e.target.value : old
                      ),
                    })
                  }
                  className="min-w-0 flex-1 border-b border-stone-300 bg-transparent py-1 outline-none"
                />
                {draft.dates.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        dates: draft.dates.filter((_, i) => i !== index),
                      })
                    }
                    aria-label="この候補日を消す"
                    className="px-2 text-stone-400"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}

            {hasDuplicate && (
              <p className="mb-2 text-xs text-red-500">同じ日が入っています</p>
            )}

            <button
              type="button"
              onClick={() => setDraft({ ...draft, dates: [...draft.dates, ""] })}
              className="mb-6 rounded-full border border-stone-400 px-3 py-1 text-xs text-stone-600"
            >
              ＋ 候補日を追加
            </button>

            {/* 決定・キャンセル */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={closeEventPanel}
                className="flex-1 rounded border border-stone-400 py-2 text-sm"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={saveEvent}
                disabled={!canSaveEvent}
                className="flex-1 rounded bg-stone-700 py-2 text-sm text-white disabled:opacity-40"
              >
                決定
              </button>
            </div>

            {eventPlan !== null && (
              <button
                type="button"
                onClick={removeEvent}
                className="mt-3 w-full py-2 text-xs text-red-500"
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
