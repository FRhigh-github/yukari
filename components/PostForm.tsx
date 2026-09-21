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
    <div className="min-h-full bg-gray-300 p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* コミュニティ選択 */}
        <div className="relative">
          <select
            value={communityId}
            onChange={(event) => setCommunityId(event.target.value)}
            className="w-full appearance-none rounded-full bg-gray-500 px-4 py-2.5 text-center font-medium text-white focus:outline-none"
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
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-white">
            ▼
          </span>
        </div>

        {/* 画像を添付。input は隠して、label 全体を押せるようにしています */}
        <label className="relative flex h-64 w-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-3xl bg-white shadow-sm">
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
          />
          {imageFile ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={URL.createObjectURL(imageFile)}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-800">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-black text-2xl font-light">
                ＋
              </div>
              <span className="text-sm font-medium">写真を選ぶ（必須）</span>
            </div>
          )}
        </label>

        <input
          type="text"
          required
          placeholder="タイトルを入力"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full rounded-2xl bg-white px-4 py-3.5 text-center text-gray-700 shadow-sm placeholder:text-gray-400 focus:outline-none"
        />

        <textarea
          placeholder="本文を入力"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="h-28 w-full resize-none rounded-2xl bg-white p-4 text-center text-gray-700 shadow-sm placeholder:text-gray-400 focus:outline-none"
        />

        {error ? (
          <p className="text-center text-xs text-red-600">{error}</p>
        ) : null}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSending}
            className="flex items-center gap-2 rounded-full bg-neutral-800 px-6 py-2.5 font-bold text-white shadow-md disabled:opacity-40"
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
