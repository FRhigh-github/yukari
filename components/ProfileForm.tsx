// プロフィールを書き換える画面の中身です。

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import { MOODS } from "@/lib/mood";
import BirthdayPicker from "@/components/BirthdayPicker";

type ProfileFormProps = {
  displayName: string;
  avatarUrl: string | null;
  // 日付の入力欄は "2006-06-18" の形しか受け取りません
  birthday: string;
  mood: string | null;
};

export default function ProfileForm({
  displayName,
  avatarUrl,
  birthday,
  mood,
}: ProfileFormProps) {
  const router = useRouter();

  const [name, setName] = useState(displayName);
  const [date, setDate] = useState(birthday);
  const [selectedMood, setSelectedMood] = useState(mood);

  // 選んだ写真は、その場で見た目に反映します（保存は「保存する」を押してから）
  const [preview, setPreview] = useState(avatarUrl);
  const [newAvatar, setNewAvatar] = useState<Blob | null>(null);

  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePick = async (file: File) => {
    const blob = await shrinkImage(file);
    setNewAvatar(blob);
    // createObjectURL = 選んだ画像を、その場で表示できるURLにする命令
    setPreview(URL.createObjectURL(blob));
  };

  const handleSave = async () => {
    setMessage(null);
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }

      // ▼ アイコンを選んでいれば、先に置き場所へ上げます。
      //   avatars は公開の置き場所なので、URLをそのまま profiles に保存できます。
      //   （非公開だと、名前を出すたびに期限付きURLを発行することになります）
      let uploadedUrl = avatarUrl;

      if (newAvatar !== null) {
        // ファイル名は自分のidにします。作り直すたびに増えません。
        const path = `${data.user.id}.jpg`;
        const upload = await supabase.storage
          .from("avatars")
          .upload(path, newAvatar, {
            contentType: "image/jpeg",
            // upsert = 同じ名前があれば上書きする
            upsert: true,
          });

        if (upload.error) throw new Error(upload.error.message);

        const { data: publicUrl } = supabase.storage
          .from("avatars")
          .getPublicUrl(path);

        // ?t=... を付けて、古い画像が表示され続けるのを防ぎます
        uploadedUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;
      }

      // ▼ 最後の .select() が大事です。
      //   RLS に止められても、Supabase は「エラー」ではなく
      //   「0件変更しました」として返してきます。
      const { data: updated, error } = await supabase
        .from("profiles")
        .update({
          display_name: name,
          avatar_url: uploadedUrl,
          // 空のままなら null（未設定）にします
          birthday: date === "" ? null : date,
          mood: selectedMood,
        })
        .eq("id", data.user.id)
        .select("id");

      if (error) throw new Error(error.message);

      if (updated?.length === 0) {
        setMessage(
          "保存できませんでした。supabase/profile_fields.sql をまだ流していないかもしれません",
        );
        setIsSaving(false);
        return;
      }

      router.push("/profile");
      router.refresh();
    } catch (saveError) {
      setMessage(
        saveError instanceof Error ? saveError.message : "保存に失敗しました",
      );
      setIsSaving(false);
    }
  };

  return (
    <div className="pb-24">
      {/* ▼ アイコン */}
      <section className="flex flex-col items-center gap-2 bg-[#fdf6f0] py-6">
        <div
          className="h-24 w-24 rounded-full bg-white bg-cover bg-center shadow-sm"
          style={preview ? { backgroundImage: `url("${preview}")` } : undefined}
        />

        {/* label で囲むと、文字を押しても写真を選べます */}
        <label className="cursor-pointer text-xs text-stone-500">
          アイコンを編集
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
      </section>

      {/* ▼ 名前と誕生日。左に項目名、右に入力欄を並べます */}
      <Row label="名前">
        <input
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
          className="w-full bg-transparent text-right text-sm text-stone-800 focus:outline-none"
        />
      </Row>

      <Row label="誕生日">
        <div className="flex justify-end">
          <BirthdayPicker value={date} onChange={setDate} />
        </div>
      </Row>

      {/* ▼ 気持ち。選択肢は lib/mood.ts にまとめてあります */}
      <Row label="ステータス">
        <div className="space-y-2">
          {MOODS.map((item) => (
            <MoodRow
              key={item.value}
              emoji={item.emoji}
              label={item.label}
              isSelected={selectedMood === item.value}
              onClick={() => setSelectedMood(item.value)}
            />
          ))}

          <MoodRow
            label="選択しない"
            isSelected={selectedMood === null}
            onClick={() => setSelectedMood(null)}
          />
        </div>
      </Row>

      <div className="flex flex-col items-center gap-3 p-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="cursor-pointer rounded-full bg-stone-600 px-8 py-3 text-sm font-bold text-white disabled:opacity-40"
        >
          {isSaving ? "保存中..." : "保存する"}
        </button>

        {message ? (
          <p className="text-center text-xs text-red-600">{message}</p>
        ) : null}
      </div>
    </div>
  );
}

// 項目1行ぶん。左に名前、右に中身を置きます。
function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 border-b border-stone-200 px-5 py-3">
      <span className="w-20 shrink-0 text-sm text-stone-600">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

// 気持ちの選択肢1つぶん。右端のマルが選択の印です。
function MoodRow({
  emoji,
  label,
  isSelected,
  onClick,
}: {
  emoji?: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full cursor-pointer items-center justify-end gap-2 text-sm text-stone-700"
    >
      {emoji ? <span>{emoji}</span> : null}
      <span>{label}</span>
      {/* 中に点が入っていれば選択中 */}
      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-stone-300">
        {isSelected ? (
          <span className="h-2 w-2 rounded-full bg-stone-700" />
        ) : null}
      </span>
    </button>
  );
}
