"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { renderCardToBlob, type CardItem } from "@/lib/cardCanvas";
import CardTemplate, { type CardKind } from "@/components/CardTemplate";
import HorizontalScroller from "@/components/HorizontalScroller";

export type Recipient = {
  userId: string;
  communityId: string;
  displayName: string | null;
  communityName: string;
};

export type Background = {
  id: string;
  kind: CardKind;
  name: string;
};

type CardComposerProps = {
  backgrounds: Background[];
  initialBackgroundId: string;
  recipients: Recipient[];
};

type Tab = "background" | "text" | "image";

export default function CardComposer({
  backgrounds,
  initialBackgroundId,
  recipients,
}: CardComposerProps) {
  const router = useRouter();

  // カードの枠。指の位置を「カードの中での割合」に直すのに使います
  const cardRef = useRef<HTMLDivElement>(null);
  // 動かしている最中のものの id。null なら誰も動かしていません
  const draggingRef = useRef<string | null>(null);

  const [backgroundId, setBackgroundId] = useState(initialBackgroundId);
  const [items, setItems] = useState<CardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("background");

  const [target, setTarget] = useState(
    recipients[0] ? `${recipients[0].userId}|${recipients[0].communityId}` : "",
  );
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const background =
    backgrounds.find((item) => item.id === backgroundId) ?? backgrounds[0];

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
      { id, type: "text", x: 0.1, y: 0.1, width: 0.6, text: "ここに文字" },
    ]);
    setSelectedId(id);
    setTab("text");
  };

  const addImage = async (file: File) => {
    const blob = await shrinkImage(file);

    // 写真は data: の形にして持ちます。
    // こうしておくと、画像に書き出すときにそのまま描けます。
    const src = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsDataURL(blob);
    });

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

      const path = `${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage
        .from("cards")
        .upload(path, blob, { contentType: "image/jpeg" });

      if (upload.error) throw new Error(upload.error.message);

      const [toUser, communityId] = target.split("|");

      // drawing_data には、置いたものの一覧をそのまま残します。
      // 画像だけだと後から直せませんが、これがあれば作り直せます。
      const { error: insertError } = await supabase.from("card_sends").insert({
        template_id: background.id,
        from_user: data.user.id,
        to_user: toUser,
        community_id: communityId,
        drawing_url: upload.data.path,
        drawing_data: items,
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

  return (
    <div className="flex h-full flex-col">
      {/* ▼ 上半分：カード。ここに置いたものが、そのまま送られます */}
      <div className="flex flex-1 items-center justify-center overflow-hidden bg-stone-100 p-4">
        <div
          ref={cardRef}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          // touch-none = 指で動かしている間、画面がスクロールしないようにする
          className="relative aspect-[2/3] h-full max-h-full touch-none overflow-hidden rounded-xl shadow-lg"
        >
          <CardTemplate
            kind={background.kind}
            name={background.name}
            plain
            className="absolute inset-0 h-full w-full"
          />

          {items.map((item) => (
            <div
              key={item.id}
              onPointerDown={handlePointerDown(item.id)}
              className={`absolute cursor-move ${
                item.id === selectedId ? "ring-2 ring-orange-400" : ""
              }`}
              style={{
                left: `${item.x * 100}%`,
                top: `${item.y * 100}%`,
                width: `${item.width * 100}%`,
              }}
            >
              {item.type === "text" ? (
                // whitespace-pre-wrap = 改行をそのまま表示する
                <p className="whitespace-pre-wrap break-words text-sm font-bold leading-snug">
                  {item.text}
                </p>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.src} alt="" className="w-full" draggable={false} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ▼ 下半分：道具 */}
      <div className="shrink-0 border-t border-stone-200 bg-white">
        <div className="flex">
          <TabButton
            label="背景"
            isActive={tab === "background"}
            onClick={() => setTab("background")}
          />
          <TabButton
            label="テキスト"
            isActive={tab === "text"}
            onClick={() => setTab("text")}
          />
          <TabButton
            label="画像"
            isActive={tab === "image"}
            onClick={() => setTab("image")}
          />
        </div>

        <div className="space-y-3 p-4">
          {tab === "background" ? (
            <HorizontalScroller>
              {backgrounds.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setBackgroundId(item.id)}
                  className={`shrink-0 rounded-lg ${
                    item.id === backgroundId ? "ring-2 ring-orange-400" : ""
                  }`}
                >
                  <CardTemplate
                    kind={item.kind}
                    name={item.name}
                    className="h-16 w-12"
                    plain
                  />
                </button>
              ))}
            </HorizontalScroller>
          ) : null}

          {tab === "text" ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={addText}
                className="w-full rounded-xl border border-stone-200 py-2.5 text-sm text-stone-700"
              >
                ＋ 文字を置く
              </button>

              {selected?.type === "text" ? (
                <textarea
                  value={selected.text}
                  onChange={(event) =>
                    updateSelected({ text: event.target.value })
                  }
                  className="h-16 w-full resize-none rounded-xl border border-stone-200 p-3 text-sm focus:outline-none"
                />
              ) : (
                <p className="text-xs text-stone-400">
                  カードの上の文字を押すと、ここで書き換えられます。
                </p>
              )}
            </div>
          ) : null}

          {tab === "image" ? (
            <label className="block w-full rounded-xl border border-stone-200 py-2.5 text-center text-sm text-stone-700">
              ＋ 写真を置く
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) addImage(file);
                }}
              />
            </label>
          ) : null}

          {/* 選んでいるものの大きさ変更と削除 */}
          {selected ? (
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={10}
                max={90}
                value={Math.round(selected.width * 100)}
                onChange={(event) =>
                  updateSelected({ width: Number(event.target.value) / 100 })
                }
                className="flex-1"
              />
              <button
                type="button"
                onClick={removeSelected}
                className="text-xs text-red-600"
              >
                削除
              </button>
            </div>
          ) : null}

          <select
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            className="w-full rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700 focus:outline-none"
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

          {error ? <p className="text-xs text-red-600">{error}</p> : null}

          <button
            type="button"
            onClick={handleSend}
            disabled={isSending || recipients.length === 0}
            className="w-full rounded-full bg-stone-800 py-3 text-sm font-bold text-white disabled:opacity-40"
          >
            {isSending ? "送信中..." : "カードを送る"}
          </button>
        </div>
      </div>
    </div>
  );
}

type TabButtonProps = {
  label: string;
  isActive: boolean;
  onClick: () => void;
};

function TabButton({ label, isActive, onClick }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-3 text-xs ${
        isActive
          ? "border-b-2 border-stone-800 font-bold text-stone-800"
          : "text-stone-400"
      }`}
    >
      {label}
    </button>
  );
}
