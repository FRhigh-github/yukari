"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import type { Community } from "@/components/CommunitySwitcher";

type PostFormProps = {
  communities: Community[];
  // 最初に選んでおくコミュニティ（ホームで見ていたもの）
  initialCommunityId: string;
};

export default function PostForm({ communities, initialCommunityId }: PostFormProps) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  // 選んだ写真を表示するためのURL。選んだときに1回だけ作ります。
  // 前は描き直すたびに URL.createObjectURL を呼んでいたので、
  // タイトルを1文字打つごとに新しいURLができて、写真を読み直していました
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  // 最初から、ホームで見ていたコミュニティを選んだ状態にしておきます
  const [communityId, setCommunityId] = useState(initialCommunityId);

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

    // 空白だけのタイトルは DB が受け付けないので、先にここで知らせます
    if (title.trim() === "") {
      setError("タイトルを入れてください");
      return;
    }

    setIsSending(true);

    // ▼ try / catch について
    //   写真の変換（shrinkImage）や通信が途中で失敗すると、例外（エラー）が起きます。
    //   受け止めないと、ボタンが「送信中...」のまま戻らず、押し直せなくなっていました。
    //   失敗したら catch に移って、ボタンを元に戻します
    try {
      const supabase = createClient();
      // getClaims() = ログインの証明書の署名を、この場で確かめる命令。
      // getUser() と違って Supabase まで聞きに行かないので、送るまでの待ちが1回ぶん減ります
      //（詳しくは lib/supabase/server.ts の getCurrentUserId）
      const { data } = await supabase.auth.getClaims();
      const userId = data?.claims.sub;
      if (!userId) {
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
        // 置き場所は「自分の id / でたらめな id.jpg」。
        // 置き場所の決まり（supabase/01_schema.sql）で、
        // 自分の id のフォルダにしか写真を置けないようにしているためです
        .upload(`${userId}/${crypto.randomUUID()}.jpg`, shrunk, {
          contentType: "image/jpeg",
          // cacheControl = ブラウザに「この写真は1年間そのまま使い回してよい」と伝えます。
          // ファイル名は毎回ちがう id なので、同じ名前の中身が変わることはありません
          cacheControl: "31536000",
        });

      if (upload.error) throw new Error(upload.error.message);

      const { error: insertError } = await supabase.from("posts").insert({
        title: title.trim(),
        body,
        image_url: upload.data.path,
        author_id: userId,
        community_id: communityId,
      });

      if (insertError) throw new Error(insertError.message);

      // 投稿したコミュニティのホームへ戻ります（?c= が無いと、一番上のコミュニティが出るため）。
      // refresh() が無いと、ホームに戻っても さっきの投稿が出ないことがあります
      router.push(`/?c=${communityId}`);
      router.refresh();
    } catch (sendError) {
      // 原因は開発者向けに残し、画面には分かりやすい言葉だけを出します
      console.error("ご報告を送れませんでした", sendError);
      setError("送れませんでした。電波の良いところで、もう一度お試しください");
      setIsSending(false);
    }
  };

  return (
    // 色はホームにそろえています（生成りの背景・金のふち・紅は「ご報告」ボタンだけ）
    // pb = iPhone の下の横棒のぶんの余白（この画面には下タブを出していません）
    //
    // ▼ 画面の高さぴったりに収めて、スクロールしないようにしています。
    //   h-full + flex-col で縦に並べ、写真の欄だけが「残りの高さ」を使います（flex-1）。
    //   前は写真を選ぶと欄が横幅から決まる大きさになり、画面からはみ出してスクロールできていました。
    <div className="h-full overflow-hidden bg-[#faf9f6] px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4">
      <form onSubmit={handleSubmit} className="flex h-full flex-col gap-3">
        {/* ▼ 上：閉じるボタンとコミュニティ選択。
              前は閉じるボタンが無く、ホーム画面に追加したアプリの形（ブラウザの「戻る」が無い）で開くと、
              書かずに戻る方法がありませんでした */}
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={communityId ? `/?c=${communityId}` : "/"}
            aria-label="書かずに閉じる"
            className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-600"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" className="h-7 w-7"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </Link>
          <div className="relative min-w-0 flex-1">
            <select
              value={communityId}
              onChange={(event) => setCommunityId(event.target.value)}
              className="h-11 w-full appearance-none rounded-full border border-kin/50 bg-white px-10 text-center font-bold text-stone-800 focus:outline-none"
            >
              {communities.length === 0 ? (
                <option value="">参加しているコミュニティがありません</option>
              ) : null}
              {communities.map((community) => (
                <option
                  key={community.id}
                  value={community.id}
                  className="text-black"
                >
                  {community.name}
                </option>
              ))}
            </select>
            <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-kin">
              ▼
            </span>
          </div>
        </div>

        {/* 画像を添付。input は隠して、label 全体を押せるようにしています */}
        {/* ▼ 写真を選んだら、ここがそのまま「見え方のお試し（プレビュー）」になります。
              見る側のストーリー画面（StoryViewer）と同じ 9:16 の形・余白のぼかし・文字の重なり方です。
              押すと写真を選び直せます */}
        {/* min-h-0 = flex の中で、中身より小さく縮めてよい、という指定。これが無いと縮まずにはみ出します */}
        <div className="flex min-h-0 flex-1 justify-center">
          <label
            className={`relative flex h-full cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl ${
              imageFile
                ? // 高さを先に決めて、横幅は 9:16 になるように自動で決めます
                  "aspect-[9/16] bg-[#faf9f6] ring-1 ring-kin/60"
                : "w-full border border-dashed border-kin/60 bg-white"
            }`}
          >
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                // 前に作ったURLは、もう使わないので片付けます（メモリを返す）
                if (imageUrl) URL.revokeObjectURL(imageUrl);
                setImageFile(file);
                setImageUrl(file ? URL.createObjectURL(file) : null);
              }}
            />
            {imageFile ? (
              <>
                {/* 見る側と同じく、後ろにぼかした同じ写真を敷いて余白をなじませます */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl ?? ""}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl ?? ""}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain"
                />
                {/* 下に白いもやをかけて、入力中のタイトルと本文を重ねて見せます */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#faf9f6]/90 via-[#faf9f6]/50 to-transparent p-3 pt-12 text-left">
                  <p className="text-base font-bold text-stone-800">
                    {title || "タイトル"}
                  </p>
                  <p className="line-clamp-4 text-xs leading-relaxed text-stone-600">
                    {body}
                  </p>
                </div>
              </>
            ) : (
              // 言葉は出さず、大きな＋だけにしています（読み上げ用に aria-label を付けています）
              <div
                aria-label="写真を選ぶ"
                className="flex h-16 w-16 items-center justify-center rounded-full border border-kin text-4xl font-light text-kin"
              >
                ＋
              </div>
            )}
          </label>
        </div>

        <input
          type="text"
          required
          maxLength={60}
          placeholder="タイトルを入力"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="w-full shrink-0 rounded-xl border border-kin/30 bg-white px-4 py-3 text-[17px] font-bold text-stone-800 placeholder:font-normal placeholder:text-stone-400 focus:border-kin focus:outline-none"
        />

        <textarea
          placeholder="本文を入力"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          className="h-24 w-full shrink-0 resize-none rounded-xl border border-kin/30 bg-white p-4 text-[17px] text-stone-700 placeholder:text-stone-400 focus:border-kin focus:outline-none"
        />

        {error ? (
          <p className="text-center text-xs text-beni">{error}</p>
        ) : null}

        <div className="flex shrink-0 justify-end">
          <button
            type="submit"
            disabled={isSending}
            className="flex h-12 items-center gap-2 rounded-full bg-beni px-7 font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6] disabled:opacity-40"
          >
            <span>{isSending ? "送信中..." : "ご報告"}</span>
            <svg
              className="h-4 w-4 rotate-45"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>
    </div>
  );
}
