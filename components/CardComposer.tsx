"use client";

import { useEffect, useRef, useState } from "react";
// 指の動き(ドラッグ・2本指のピンチ)を見分けてくれるライブラリ
import { useDrag, usePinch } from "@use-gesture/react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import {
  renderCardToBlob,
  FONT_RATIO,
  ITEM_PADDING_RATIO,
  type CardItem,
} from "@/lib/cardCanvas";
import { TEXT_COLORS } from "@/lib/cardBackground";
// 回した角度を、まっすぐの近くでぴたっと止める計算（未来への手紙と共通）
import { snapRotation } from "@/lib/rotation";
import CardTemplate, {
  CARD_KINDS,
  type CardKind,
} from "@/components/CardTemplate";

export type Recipient = {
  userId: string;
  communityId: string;
  displayName: string | null;
  communityName: string;
};

type CardComposerProps = {
  // 最初に開いておく背景の種類
  initialKind: CardKind;
};


export default function CardComposer({ initialKind }: CardComposerProps) {
  const router = useRouter();

  // カードの枠。指の位置を「カードの中での割合」に直すのに使います
  const cardRef = useRef<HTMLDivElement>(null);
  // 2本指で大きさを変えている最中か。その間は、1本指で動かすほうを止めます
  const pinchingRef = useRef(false);

  const [kind, setKind] = useState<CardKind>(initialKind);
  // ▼ 最初から、文字の枠を1つ置いておきます（中身は空。薄く「ここに文字」と出ます）。
  //   開いてすぐ書き始められるように、選んだ状態から始めます
  const [items, setItems] = useState<CardItem[]>([
    { id: "first-text", type: "text", x: 0.1, y: 0.12, width: 0.8, text: "" },
  ]);
  const [selectedId, setSelectedId] = useState<string | null>("first-text");

  // ▼ 送る相手は、この画面を開いた時点では取りに行きません。
  //   選ぶのは最後なので、先に取ると、絵を描き始めるまで待たされます。
  //   null = まだ取っていない、という意味です。
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [isPicking, setIsPicking] = useState(false);

  const [target, setTarget] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const background =
    CARD_KINDS.find((item) => item.kind === kind) ?? CARD_KINDS[0];

  const addText = () => {
    const id = crypto.randomUUID();
    setItems((current) => [
      ...current,
      { id, type: "text", x: 0.1, y: 0.4, width: 0.6, text: "" },
    ]);
    setSelectedId(id);
  };

  const addImage = async (file: File) => {
    setError(null);
    // 読めない形式の写真だと、縮める途中で失敗します（例外）。
    // 受け止めないと何も起きないので、別の写真を選んでもらうよう知らせます
    let src: string;
    try {
      const blob = await shrinkImage(file);

      // 写真は data: の形にして持ちます。
      // こうしておくと、画像に書き出すときにそのまま描けます。
      src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      setError("この写真は使えませんでした。別の写真を選んでください");
      return;
    }

    const id = crypto.randomUUID();
    setItems((current) => [
      ...current,
      { id, type: "image", x: 0.15, y: 0.3, width: 0.5, src },
    ]);
    setSelectedId(id);
  };

  const updateItem = (id: string, changes: Partial<CardItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id ? ({ ...item, ...changes } as CardItem) : item,
      ),
    );
  };

  const removeSelected = () => {
    setItems((current) => current.filter((item) => item.id !== selectedId));
    setSelectedId(null);
  };

  // ▼「送る」を押したときに、はじめて相手を取りに行きます。
  //   一度取ったら覚えておくので、2回目からは待ちません。
  const openPicker = async () => {
    setIsPicking(true);
    if (recipients !== null) return;

    const supabase = createClient();

    const [{ data: userData }, { data: communities }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("communities").select("id, name").order("created_at", { ascending: true }),
    ]);

    if (!userData.user) {
      router.push("/login");
      return;
    }

    // 送れる相手＝自分と同じコミュニティにいる人（自分は除く）
    const { data: memberships } = await supabase
      .from("memberships")
      .select("user_id, community_id")
      .in("community_id", communities?.map((item) => item.id) ?? [])
      .neq("user_id", userData.user.id);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", memberships?.map((item) => item.user_id) ?? []);

    const list: Recipient[] =
      memberships?.map((membership) => ({
        userId: membership.user_id,
        communityId: membership.community_id,
        displayName:
          profiles?.find((profile) => profile.id === membership.user_id)
            ?.display_name ?? null,
        communityName:
          communities?.find((item) => item.id === membership.community_id)
            ?.name ?? "",
      })) ?? [];

    setRecipients(list);
    setTarget(list[0] ? `${list[0].userId}|${list[0].communityId}` : "");
  };

  const handleSend = async () => {
    setError(null);

    if (!target) {
      setError("送る相手を選んでください");
      return;
    }

    setIsSending(true);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      // 画面に置いたものを、1枚の画像にします
      const blob = await renderCardToBlob(background.kind, items);

      // 置き場所は「自分の id / でたらめな id.jpg」。
      // 自分の id のフォルダにしか置けない決まりにしているためです（supabase/01_schema.sql）
      const path = `${data.user.id}/${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage
        .from("cards")
        // cacheControl = ブラウザに「この写真は1年間そのまま使い回してよい」と伝えます。
        // ファイル名は毎回ちがう id なので、同じ名前の中身が変わることはありません
        .upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" });

      if (upload.error) throw new Error(upload.error.message);

      const [toUser, communityId] = target.split("|");

      // ▼ card_sends.template_id は、DB側でまだ card_templates と結ばれています。
      //   画面では使わなくなったので、送るときだけ種類から1件引いてきます。
      //   （画面を開くときに引かないので、待ち時間には影響しません）
      //   あとから足した背景（結婚祝いなど）は card_templates に行が無いので、
      //   そのときは「その他（custom）」の行を代わりに使います
      const { data: templates } = await supabase
        .from("card_templates")
        .select("id, kind")
        .in("kind", [background.kind, "custom"]);
      const template =
        templates?.find((item) => item.kind === background.kind) ?? templates?.[0];

      // ▼ drawing_data には、置いたものの一覧を残します。
      //   後から作り直せるようにするためです。
      //
      //   ただし写真だけは外します。
      //   items の中の写真は data:image/jpeg;base64,... という文字の塊で、
      //   1枚で数百KB〜数MBあります。絵はすでに保管庫に上げてあるので、
      //   そのままDBにも入れると、同じ写真を二重に持つことになります。
      const layout = items.map((item) =>
        item.type === "image" ? { ...item, src: "" } : item,
      );

      const { error: insertError } = await supabase.from("card_sends").insert({
        template_id: template?.id ?? null,
        from_user: data.user.id,
        to_user: toUser,
        community_id: communityId,
        drawing_url: upload.data.path,
        drawing_data: layout,
      });

      if (insertError) throw new Error(insertError.message);

      router.push("/cards/inbox");
      router.refresh();
    } catch (sendError) {
      // 原因は開発者向けに残し、画面には分かりやすい言葉だけを出します
      console.error("カードを送れませんでした", sendError);
      setError("送れませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
    }
  };

  // ▼ 背景を、カードの上で左右にスライドして切り替えます。
  //   カードの何もない所（背景）に触れて、横に大きく動かしたときだけ切り替えます
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  // 下の背景えらびの帯で、指を置いた横の位置
  const barStartRef = useRef<number | null>(null);
  const kindIndex = CARD_KINDS.findIndex((item) => item.kind === kind);
  const changeKind = (step: number) => {
    // % で端から端へぐるっと回ります（最後の次は最初）
    const next = (kindIndex + step + CARD_KINDS.length) % CARD_KINDS.length;
    setKind(CARD_KINDS[next].kind);
  };

  // ▼ 置いたものを動かす・大きさを変える。指の動きの計算は @use-gesture/react にまかせています。
  //   前は自分で書いていて、つかんだ瞬間に、写真の左上の角が指の所へ飛んでいました。
  //   このライブラリは「軽く押した(タップ)」と「押したまま動かした(ドラッグ)」を見分けてくれるので、
  //     軽く押す         … 選ぶ
  //     押したまま動かす … つかんだ所のまま、動かす
  //     2本指で挟む      … 選んでいるものの大きさを変える
  //   になります。
  //   memo = 動かし始めたときに返した値を、指を離すまで覚えておいてくれる入れ物です
  const bindDrag = useDrag(
    ({ args, tap, first, movement: [moveX, moveY], memo, cancel }) => {
      const id = args[0] as string;
      if (tap || first) setSelectedId(id);
      if (tap) return memo;
      // 2本指の操作が始まったら、1本指の移動はやめます
      if (pinchingRef.current) {
        cancel();
        return memo;
      }
      const rect = cardRef.current?.getBoundingClientRect();
      const item = items.find((it) => it.id === id);
      if (!rect || !item) return memo;
      const start: { x: number; y: number } = memo ?? { x: item.x, y: item.y };
      // 指が動いたぶん(px)を、カードの中での割合に直して足します。
      // カードの外へ出てしまわないように、0〜0.95 に収めます
      updateItem(id, {
        x: Math.min(0.95, Math.max(0, start.x + moveX / rect.width)),
        y: Math.min(0.95, Math.max(0, start.y + moveY / rect.height)),
      });
      return start;
    },
    // filterTaps = 3px 以内の動きは「タップ」とみなし、ものを動かしません
    { filterTaps: true },
  );

  // ▼ 2本指で挟むと、選んでいるものの大きさと向きが変わります（写真アプリと同じ操作）。
  //   小さい文字でも挟めるよう、カードのどこで挟んでもよいことにしています。
  //   movement = [挟み始めてから何倍に広げたか, 何度回したか]
  usePinch(
    ({ first, last, movement: [scale, angle], memo }) => {
      pinchingRef.current = !last;
      // 背景のスワイプとして数えないようにします
      swipeStartRef.current = null;
      const item = items.find((it) => it.id === selectedId);
      if (!item) return memo;
      const start: CardItem = first || memo === undefined ? item : memo;
      const width = Math.min(0.95, Math.max(0.15, start.width * scale));
      // 真ん中の位置が動かないように、左の位置を直します
      updateItem(item.id, {
        width,
        x: Math.min(0.95, Math.max(0, start.x + (start.width - width) / 2)),
        // まっすぐ・真横の近くでは、ぴたっと止まります
        rotation: snapRotation((start.rotation ?? 0) + angle).rotation,
      });
      return start;
    },
    { target: cardRef },
  );

  // ▼ iPhone の Safari は、2本指で挟むと画面ごと拡大しようとします。
  //   ピンチをカードの操作に使うため、画面の拡大を止めます
  useEffect(() => {
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener("gesturestart", stop);
    document.addEventListener("gesturechange", stop);
    return () => {
      document.removeEventListener("gesturestart", stop);
      document.removeEventListener("gesturechange", stop);
    };
  }, []);

  // 文字や写真の大きさ・位置は、カードの幅に対する割合で決めます（lib/cardCanvas.ts と同じ）。
  // cqw = 「カードの横幅の1%」。カードに @container を付けているので使えます
  const fontSize = `${FONT_RATIO * 100}cqw`;
  const itemPadding = `${ITEM_PADDING_RATIO * 100}cqw`;

  return (
    <div className="flex h-full flex-col bg-[#faf9f6]">
      {/* ▼ 上：カード。ここに置いたものが、そのまま送られます */}
      <div className="flex min-h-0 flex-1 items-center justify-center p-4 pb-2">
        <div
          ref={cardRef}
          onPointerDown={(event) => {
            // 2本目の指は数えません（2本指で挟んだときに、背景が切り替わらないように）
            if (!event.isPrimary) return;
            // 置いたものの上ではなく、背景に触れたときだけ
            if (event.target !== event.currentTarget && !(event.target instanceof HTMLElement && event.target.dataset.cardBackground)) return;
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerUp={(event) => {
            const start = swipeStartRef.current;
            swipeStartRef.current = null;
            if (start === null) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
              // 左へスライド → 次の背景、右へ → 前の背景
              changeKind(dx < 0 ? 1 : -1);
            } else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
              // 背景を軽く押したら、選んでいたものを外します
              setSelectedId(null);
            }
          }}
          // @container = 中の文字を「カードの幅の何%」で決められるようにする指定
          // touch-none = 指で動かしている間、画面がスクロールしないようにする
          className="@container relative aspect-[2/3] h-full max-h-full max-w-full touch-none overflow-hidden rounded-xl shadow-lg ring-1 ring-kin/40"
        >
          <div data-card-background="1" className="absolute inset-0">
            <CardTemplate
              kind={background.kind}
              name={background.label}
              plain
              className="pointer-events-none h-full w-full"
            />
          </div>

          {items.map((item) => {
            const isSelected = item.id === selectedId;
            return (
              <div
                key={item.id}
                // 押す・動かすの見分けは bindDrag（上の説明）にまかせます
                {...bindDrag(item.id)}
                className={`absolute cursor-move rounded ${
                  item.type === "text"
                    ? // 文字の枠は、いつも薄い点線で見せます（ここに文字が書ける、と分かるように）
                      isSelected
                      ? "outline-dashed outline-2 outline-kin"
                      : "outline-dashed outline-1 outline-stone-400/60"
                    : isSelected
                      ? "outline outline-2 outline-kin"
                      : ""
                }`}
                style={{
                  left: `${item.x * 100}%`,
                  top: `${item.y * 100}%`,
                  width: `${item.width * 100}%`,
                  padding: itemPadding,
                  // 真ん中を軸に回します（書き出す lib/cardCanvas.ts も同じ回し方です）
                  transform: item.rotation ? `rotate(${item.rotation}deg)` : undefined,
                }}
              >
                {item.type === "text" ? (
                  // ▼ カードの上で、そのまま文字を打ちます。
                  //   前は下の欄で打っていたので、キーボードが出るとカードが隠れていました。
                  //   選んでいないときは readOnly にして、1回目に触れたときは動かせるようにします
                  <textarea
                    value={item.text}
                    readOnly={!isSelected}
                    placeholder="ここに文字"
                    rows={Math.max(1, item.text.split("\n").length)}
                    onChange={(event) =>
                      setItems((current) =>
                        current.map((it) =>
                          it.id === item.id ? { ...it, text: event.target.value } : it,
                        ),
                      )
                    }
                    className="block w-full resize-none overflow-hidden bg-transparent font-bold leading-[1.5] outline-none placeholder:text-current placeholder:opacity-40"
                    style={{ fontSize, color: TEXT_COLORS[background.kind] }}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.src} alt="" className="block w-full" draggable={false} />
                )}

                {/* ▼ 選んでいるものの右上に、消すボタンを出します。
                    見た目は 28px の丸ですが、押せる範囲は 44px あります。
                    押したときに、外側の「動かす」に伝えないようにします */}
                {isSelected ? (
                  <button
                    type="button"
                    aria-label="消す"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={removeSelected}
                    className="absolute -right-5 -top-5 z-10 flex h-11 w-11 items-center justify-center"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-beni shadow ring-1 ring-kin/60">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true" className="h-4 w-4"><path d="M6 6l12 12M18 6L6 18" /></svg>
                    </span>
                  </button>
                ) : null}
              </div>
            );
          })}

          {/* ▼ 右上：文字・写真を置くボタン。未来への手紙（/letter）と同じ形です */}
          <div className="absolute right-1 top-1 z-10 flex flex-col gap-1">
            <button
              type="button"
              onClick={addText}
              aria-label="文字を置く"
              className="flex h-11 w-11 items-center justify-center active:scale-90"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-kin shadow-sm ring-1 ring-kin/60">
                <span className="font-serif text-xl font-bold">T</span>
              </span>
            </button>
            <label
              aria-label="写真を置く"
              className="flex h-11 w-11 cursor-pointer items-center justify-center active:scale-90"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-kin shadow-sm ring-1 ring-kin/60">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5"><rect x="3" y="5" width="18" height="14" rx="2" /><circle cx="9" cy="10" r="1.5" /><path d="M21 16l-5-5-8 8" /></svg>
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) addImage(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>

      {/* ▼ 下：道具。高さを固定して、選んだり外したりしてもカードが上下に動かないようにします */}
      <div className="shrink-0 space-y-2 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {/* ▼ 背景えらび。左右の矢印を押すか、この帯を横にスライドすると、背景が変わります。
            （大きさは2本指で、消すのは選んだものの右上の × でできるので、つまみの帯は無くしました） */}
        <div
          onPointerDown={(event) => {
            barStartRef.current = event.clientX;
          }}
          onPointerUp={(event) => {
            const start = barStartRef.current;
            barStartRef.current = null;
            if (start === null) return;
            const dx = event.clientX - start;
            // 左へスライド → 次の背景、右へ → 前の背景（カードの上のスライドと同じ向き）
            if (Math.abs(dx) > 40) changeKind(dx < 0 ? 1 : -1);
          }}
          className="flex h-14 touch-none select-none items-center justify-between rounded-2xl bg-white ring-1 ring-kin/40"
        >
          <button
            type="button"
            onClick={() => changeKind(-1)}
            aria-label="前の背景"
            className="flex h-14 w-14 items-center justify-center text-kin active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 6l-6 6 6 6" /></svg>
          </button>
          <div className="flex flex-col items-center gap-1.5">
            <span className="text-base font-bold text-kin">{background.label}</span>
            <span className="flex gap-1.5">
              {CARD_KINDS.map((item) => (
                <span
                  key={item.kind}
                  className={`h-1.5 w-1.5 rounded-full ${item.kind === kind ? "bg-kin" : "bg-stone-300"}`}
                />
              ))}
            </span>
          </div>
          <button
            type="button"
            onClick={() => changeKind(1)}
            aria-label="次の背景"
            className="flex h-14 w-14 items-center justify-center text-kin active:scale-90"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M9 6l6 6-6 6" /></svg>
          </button>
        </div>

        {/* ▼ 相手えらびは、押してから出します。
            まだ押していない間は、DBに聞きに行きません。 */}
        {isPicking ? (
          <div className="space-y-2">
            {recipients === null ? (
              <p className="py-3 text-center text-sm text-stone-400">…</p>
            ) : (
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                className="h-12 w-full cursor-pointer rounded-xl border border-kin/40 bg-white px-4 text-base text-stone-700 focus:outline-none"
              >
                {recipients.length === 0 ? (
                  <option value="">送れる相手がいません</option>
                ) : null}
                {recipients.map((recipient) => (
                  <option
                    key={`${recipient.userId}|${recipient.communityId}`}
                    value={`${recipient.userId}|${recipient.communityId}`}
                  >
                    {recipient.displayName ?? "名無し"}（{recipient.communityName}）
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || recipients === null || target === ""}
              className="h-12 w-full cursor-pointer rounded-full bg-beni text-base font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6] disabled:opacity-40"
            >
              {isSending ? "送信中..." : "この人に送る"}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="h-12 w-full cursor-pointer rounded-full bg-beni text-base font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6]"
          >
            カードを送る
          </button>
        )}

        {error ? <p className="text-sm text-beni">{error}</p> : null}
      </div>
    </div>
  );
}
