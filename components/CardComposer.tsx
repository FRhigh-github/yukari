"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { renderCardToBlob, type CardItem } from "@/lib/cardCanvas";
import CardTemplate, {
  CARD_KINDS,
  type CardKind,
} from "@/components/CardTemplate";
import HorizontalScroller from "@/components/HorizontalScroller";

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

type Tab = "background" | "text" | "image";

export default function CardComposer({ initialKind }: CardComposerProps) {
  const router = useRouter();

  // カードの枠。指の位置を「カードの中での割合」に直すのに使います
  const cardRef = useRef<HTMLDivElement>(null);
  // 動かしている最中のものの id。null なら誰も動かしていません
  const draggingRef = useRef<string | null>(null);

  const [kind, setKind] = useState<CardKind>(initialKind);
  const [items, setItems] = useState<CardItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("background");

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

  // ▼「送る」を押したときに、はじめて相手を取りに行きます。
  //   一度取ったら覚えておくので、2回目からは待ちません。
  const openPicker = async () => {
    setIsPicking(true);
    if (recipients !== null) return;

    const supabase = createClient();

    const [{ data: userData }, { data: communities }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("communities").select("id, name"),
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

      const path = `${crypto.randomUUID()}.jpg`;
      const upload = await supabase.storage
        .from("cards")
        .upload(path, blob, { contentType: "image/jpeg" });

      if (upload.error) throw new Error(upload.error.message);

      const [toUser, communityId] = target.split("|");

      // ▼ card_sends.template_id は、DB側でまだ card_templates と結ばれています。
      //   画面では使わなくなったので、送るときだけ種類から1件引いてきます。
      //   （画面を開くときに引かないので、待ち時間には影響しません）
      const { data: template } = await supabase
        .from("card_templates")
        .select("id")
        .eq("kind", background.kind)
        .limit(1)
        .maybeSingle();

      // drawing_data には、置いたものの一覧をそのまま残します。
      // 画像だけだと後から直せませんが、これがあれば作り直せます。
      const { error: insertError } = await supabase.from("card_sends").insert({
        template_id: template?.id ?? null,
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
            name={background.label}
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
              {CARD_KINDS.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() => setKind(item.kind)}
                  className={`shrink-0 cursor-pointer rounded-lg ${
                    item.kind === kind ? "ring-2 ring-orange-400" : ""
                  }`}
                >
                  <CardTemplate
                    kind={item.kind}
                    name={item.label}
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

          {/* ▼ 相手えらびは、押してから出します。
              まだ押していない間は、DBに聞きに行きません。 */}
          {isPicking ? (
            <div className="space-y-2">
              {recipients === null ? (
                <p className="py-3 text-center text-xs text-stone-400">
                  相手をさがしています…
                </p>
              ) : (
                <select
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  className="w-full cursor-pointer rounded-xl border border-stone-200 px-4 py-3 text-sm text-stone-700 focus:outline-none"
                >
                  {recipients.length === 0 ? (
                    <option value="">送れる相手がいません</option>
                  ) : null}
                  {recipients.map((recipient) => (
                    <option
                      key={`${recipient.userId}|${recipient.communityId}`}
                      value={`${recipient.userId}|${recipient.communityId}`}
                    >
                      {recipient.displayName ?? "名無し"}（
                      {recipient.communityName}）
                    </option>
                  ))}
                </select>
              )}

              <button
                type="button"
                onClick={handleSend}
                disabled={isSending || recipients === null || target === ""}
                className="w-full cursor-pointer rounded-full bg-stone-800 py-3 text-sm font-bold text-white disabled:opacity-40"
              >
                {isSending ? "送信中..." : "この人に送る"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={openPicker}
              className="w-full cursor-pointer rounded-full bg-stone-800 py-3 text-sm font-bold text-white"
            >
              カードを送る
            </button>
          )}

          {error ? <p className="text-xs text-red-600">{error}</p> : null}
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
