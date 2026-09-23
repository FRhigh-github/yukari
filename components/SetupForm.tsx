// 名前・誕生日・アイコンを入力してもらう部品です。
//
// メールで登録した人も、Googleで入った人も、必ずここを通ります。
// Googleの場合は名前とアイコンが最初から入っているので、確認だけで進めます。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import CameraBadge from "@/components/CameraBadge";
import BirthdayPicker from "@/components/BirthdayPicker";

type SetupFormProps = {
  initialName: string;
  initialAvatarUrl: string | null;
};

export default function SetupForm({
  initialName,
  initialAvatarUrl,
}: SetupFormProps) {
  const router = useRouter();

  const [name, setName] = useState(initialName);
  const [birthday, setBirthday] = useState("");

  // 選んだアイコン。決めるまでは、その場で見えるようにしておきます
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(initialAvatarUrl);

  const [isSending, setIsSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePick = async (file: File) => {
    const blob = await shrinkImage(file);
    setAvatar(blob);
    // createObjectURL = 選んだ画像を、その場で表示できるURLにする命令
    setPreview(URL.createObjectURL(blob));
  };

  const handleStart = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    // 誕生日は選ぶ形にしたので、入力欄の required が使えません。
    // 代わりにここで確かめます。
    if (birthday === "") {
      setMessage("誕生日を選んでください");
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

      let avatarUrl = initialAvatarUrl;

      // アイコンを選んでいれば、公開の置き場所へ上げます。
      // 上げられなくても先へ進みます（あとからプロフィールで設定できます）。
      if (avatar !== null) {
        const path = `${data.user.id}.jpg`;
        const upload = await supabase.storage
          .from("avatars")
          .upload(path, avatar, { contentType: "image/jpeg", upsert: true });

        if (upload.error === null) {
          const { data: publicUrl } = supabase.storage
            .from("avatars")
            .getPublicUrl(path);
          avatarUrl = publicUrl.publicUrl;
        }
      }

      // profiles の行は、アカウントができた時点でDB側が自動で作ります。
      // なので insert ではなく update です。
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          birthday: birthday === "" ? null : birthday,
          avatar_url: avatarUrl,
        })
        .eq("id", data.user.id);

      if (error) throw new Error(error.message);

      // ▼ ホームではなく、まず「入る／作る」を選ぶ画面へ。
      //   この時点ではどのコミュニティにも入っていないので、
      //   ホームへ送っても誰もいない相関図が出るだけになります。
      router.push("/start");
      router.refresh();
    } catch (setupError) {
      setMessage(
        setupError instanceof Error ? setupError.message : "保存に失敗しました",
      );
      setIsSending(false);
    }
  };

  return (
    <form onSubmit={handleStart} className="space-y-4">
      {/* ▼ アイコン。押すと写真を選べます。
          丸があるだけでは押せると気づかれないので、
          カメラの印を右下に重ねています。 */}
      <label className="mx-auto block w-24 cursor-pointer text-center">
        <span className="relative mx-auto block h-24 w-24">
          <span
            className="block h-24 w-24 rounded-full bg-stone-100 bg-cover bg-center"
            style={
              preview ? { backgroundImage: `url("${preview}")` } : undefined
            }
          />
          <CameraBadge />
        </span>
        <span className="mt-1 block text-xs text-stone-500">
          写真を選ぶ
        </span>
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) handlePick(file);
          }}
        />
      </label>

      <label className="block">
        <span className="text-xs text-stone-500">お名前</span>
        <div className="border-b border-stone-200 py-1.5">
          <input
            required
            maxLength={40}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="岸 大遥"
            className="w-full bg-transparent text-sm text-stone-800 focus:outline-none"
          />
        </div>
      </label>

      {/* 本名をお願いする理由を添えます。理由なく求めると、入れてもらえません */}
      <p className="-mt-2 text-xs text-stone-400">
        大切な人に見つけてもらうところなので、なるべく本名でお願いします
      </p>

      <div>
        <span className="text-xs text-stone-500">誕生日</span>
        <div className="py-1.5">
          <BirthdayPicker value={birthday} onChange={setBirthday} />
        </div>
      </div>

      <button
        type="submit"
        disabled={isSending}
        className="w-full cursor-pointer rounded-full bg-stone-800 py-3 text-sm font-bold text-white disabled:opacity-40"
      >
        {isSending ? "保存中..." : "はじめる"}
      </button>

      {message ? <p className="text-xs text-red-600">{message}</p> : null}
    </form>
  );
}
