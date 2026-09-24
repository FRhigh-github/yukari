"use client";

import { useRef, useState } from "react";
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
  // 動かしている最中のものの id。null なら誰も動かしていません
  const draggingRef = useRef<string | null>(null);

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

  const selected = items.find((item) => item.id === selectedId);

  // ▼ 指の位置を、カードの中での割合(0〜1)に直します。
  //   割合で持っておくと、画面の大きさが変わっても位置がずれません。
  const toRatio = (clientX: number, clientY: number) => {
    const rect = cardRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const handlePointerDown = (id: string) => (event: React.PointerEvent) => {
    // setPointerCapture = 指がその要素から外れても、動きを追い続ける指定
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = id;
    setSelectedId(id);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (draggingRef.current === null) return;

    const pos = toRatio(event.clientX, event.clientY);
    setItems((current) =>
      current.map((item) =>
        item.id === draggingRef.current
          ? // カードの外へ出てしまわないように、0〜0.95 に収めます
            {
              ...item,
              x: Math.min(0.95, Math.max(0, pos.x)),
              y: Math.min(0.95, Math.max(0, pos.y)),
            }
          : item,
      ),
    );
  };

  const handlePointerUp = () => {
    draggingRef.current = null;
  };

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

  const updateSelected = (changes: Partial<CardItem>) => {
    setItems((current) =>
      current.map((item) =>
        item.id === selectedId ? ({ ...item, ...changes } as CardItem) : item,
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
      // 自分の id のフォルダにしか置けない決まりにしているためです（supabase/04_security.sql）
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
      setError(
        sendError instanceof Error ? sendError.message : "送信に失敗しました",
      );
      setIsSending(false);
    }
  };

  // ▼ 背景を、カードの上で左右にスライドして切り替えます。
  //   カードの何もない所（背景）に触れて、横に大きく動かしたときだけ切り替えます
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const kindIndex = CARD_KINDS.findIndex((item) => item.kind === kind);
  const changeKind = (step: number) => {
    // % で端から端へぐるっと回ります（最後の次は最初）
    const next = (kindIndex + step + CARD_KINDS.length) % CARD_KINDS.length;
    setKind(CARD_KINDS[next].kind);
  };

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
            // 置いたものの上ではなく、背景に触れたときだけ
            if (event.target !== event.currentTarget && !(event.target instanceof HTMLElement && event.target.dataset.cardBackground)) return;
            swipeStartRef.current = { x: event.clientX, y: event.clientY };
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={(event) => {
            handlePointerUp();
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
                onPointerDown={(event) => {
                  // 選んでいる文字の入力欄を押したときは、動かさずに文字を打てるようにします
                  if (isSelected && event.target instanceof HTMLTextAreaElement) return;
                  handlePointerDown(item.id)(event);
                }}
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
        <div className="flex h-11 items-center gap-3">
          {selected ? (
            <>
              {/* 大きさ（横幅）のつまみ */}
              <input
                type="range"
                min={15}
                max={95}
                value={Math.round(selected.width * 100)}
                onChange={(event) =>
                  updateSelected({ width: Number(event.target.value) / 100 })
                }
                aria-label="大きさ"
                className="flex-1 accent-[#c2a14d]"
              />
              <button
                type="button"
                onClick={removeSelected}
                aria-label="消す"
                className="flex h-11 w-11 items-center justify-center text-beni"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6"><path d="M4 7h16" /><path d="M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13" /><path d="M9 7V4h6v3" /></svg>
              </button>
            </>
          ) : (
            // 何も選んでいないときは、いまの背景の名前と、何枚目かの点を出します
            <div className="flex w-full items-center justify-center gap-3">
              <span className="text-sm font-bold text-kin">{background.label}</span>
              <span className="flex gap-1.5">
                {CARD_KINDS.map((item) => (
                  <span
                    key={item.kind}
                    className={`h-1.5 w-1.5 rounded-full ${item.kind === kind ? "bg-kin" : "bg-stone-300"}`}
                  />
                ))}
              </span>
            </div>
          )}
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
