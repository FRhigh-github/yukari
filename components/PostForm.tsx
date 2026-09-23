"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import type { Community } from "@/components/CommunitySwitcher";

type PostFormProps = {
  communities: Community[];
};

export default function PostForm({ communities }: PostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // 最初から1つ目を選んだ状態にしておきます
  const [communityId, setCommunityId] = useState(communities[0]?.id ?? "");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!communityId) {
      setError("投稿先のコミュニティを選んでください");
      return;
    }

    // 画像は必須です。文字だけの報告が並ぶと、一覧が寂しくなるためです。
    // <input type="file"> には required が効かないので、ここで確かめます。
    if (!imageFile) {
      setError("写真を1枚えらんでください");
      return;
    }

    setIsSending(true);

    const supabase = createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return;
    }

    // 写真を小さくしてから預けます。
    //
    // 置き場所の名前は、こちらで作った id にします。
    // ファイル名をそのまま使うと、日本語や空白が入っていたときに
    // 保管庫が受け付けてくれません
    //（スマホのスクショは「スクリーンショット 2026-09-21 ....png」のような名前です）。
    const shrunk = await shrinkImage(imageFile);

    const upload = await supabase.storage
      .from("posts")
      .upload(`${crypto.randomUUID()}.jpg`, shrunk, {
        contentType: "image/jpeg",
      });

    if (upload.error) {
      setError("画像のアップロードに失敗しました: " + upload.error.message);
      setIsSending(false);
      return;
    }

    const { error: insertError } = await supabase.from("posts").insert({
      title,
      body,
      image_url: upload.data.path,
      author_id: data.user.id,
      community_id: communityId,
    });

    if (insertError) {
      setError("投稿の保存に失敗しました: " + insertError.message);
      setIsSending(false);
      return;
    }

    // refresh() が無いと、ホームに戻っても さっきの投稿が出ないことがあります
    router.push("/");
    router.refresh();
  };

  return (
    // 色はホームにそろえています（生成りの背景・金のふち・紅は「ご報告」ボタンだけ）
    // pb = 下タブ（浮いている分も入れて約110px）に「ご報告」ボタンが隠れないための余白
    <div className="min-h-full bg-[#faf9f6] px-4 pb-[calc(env(safe-area-inset-bottom)+8rem)] pt-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* コミュニティ選択 */}
        <div className="relative">
          <select
            value={communityId}
            onChange={(event) => setCommunityId(event.target.value)}
            className="h-11 w-full appearance-none rounded-full border border-kin/50 bg-white px-10 text-center font-bold text-stone-800 focus:outline-none"
          >
            {communities.length === 0 ? (
              <option value="">参加しているコミュニティがありません</option>
            ) : null}
            {communities.map((community) => (
              <option key={community.id} value={community.id} className="text-black">
                {community.name}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-kin">
            ▼
          </span>
        </div>

        {/* 画像を添付。input は隠して、label 全体を押せるようにしています */}
        {/* ▼ 写真を選んだら、ここがそのまま「見え方のお試し（プレビュー）」になります。
              見る側のストーリー画面（StoryViewer）と同じ 9:16 の形・余白のぼかし・文字の重なり方です。
              押すと写真を選び直せます */}
        <label
          className={`relative mx-auto flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl ${
            imageFile
              ? "aspect-[9/16] w-2/3 bg-stone-700 ring-1 ring-kin/60"
              : "h-64 w-full border border-dashed border-kin/60 bg-white"
          }`}
        >
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          />
          {imageFile ? (
            <>
              {/* 見る側と同じく、後ろにぼかした同じ写真を敷いて余白をなじませます */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(imageFile)}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={URL.createObjectURL(imageFile)}
                alt=""
                className="absolute inset-0 h-full w-full object-contain"
              />
              {/* 下を暗くして、入力中のタイトルと本文を重ねて見せます */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-3 pt-12 text-left">
                <p className="text-base font-bold text-white">{title || "タイトル"}</p>
                <p className="line-clamp-4 text-[10px] leading-relaxed text-white/85">{body}</p>
              </div>
              <span className="absolute right-2 top-2 rounded-full bg-black/50 px-2 py-1 text-[10px] text-white">
                押すと選び直せます
              </span>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-kin">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-kin text-2xl font-light">
                ＋
              </div>
              <span className="text-sm text-stone-500">写真を選ぶ（必須）</span>
            </div>
          )}
        </label>

        <input
          type="text"
          required
          placeholder="タイトルを入力"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-xl border border-kin/30 bg-white px-4 py-3 text-[17px] font-bold text-stone-800 placeholder:font-normal placeholder:text-stone-400 focus:border-kin focus:outline-none"
        />

        <textarea
          placeholder="本文を入力"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="h-32 w-full resize-none rounded-xl border border-kin/30 bg-white p-4 text-[17px] text-stone-700 placeholder:text-stone-400 focus:border-kin focus:outline-none"
        />

        {error ? (
          <p className="text-center text-xs text-beni">{error}</p>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSending}
            className="flex h-12 items-center gap-2 rounded-full bg-beni px-7 font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6] disabled:opacity-40"
          >
            <span>{isSending ? "送信中..." : "ご報告"}</span>
            <svg className="h-4 w-4 rotate-45" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
