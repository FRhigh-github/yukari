// プロフィールの上半分です。
//
// 自分のプロフィール（/profile）と、
// ほかの人のプロフィール（/members/[id]/profile）の
// 両方で使います。違うのは「編集」ボタンが出るかどうかだけです。

import Link from "next/link";
import { MOODS } from "@/lib/mood";
import MoodIcon from "@/components/MoodIcon";

type ProfileHeaderProps = {
  displayName: string | null;
  avatarUrl: string | null;
  birthday: string | null;
  mood: string | null;
  // 所属しているコミュニティの名前
  communityNames: string[];
  // 自分のプロフィールのときだけ、編集ボタンを出します
  isMe?: boolean;
};

export default function ProfileHeader({
  displayName,
  avatarUrl,
  birthday,
  mood,
  communityNames,
  isMe = false,
}: ProfileHeaderProps) {
  const selectedMood = MOODS.find((item) => item.value === mood);

  return (
    <section className="flex gap-4 bg-[#fdf6f0] p-5">
      <div className="relative shrink-0">
        {/* アイコンは背景画像で置きます（読み込みに失敗しても印が出ないため） */}
        <div
          className="h-24 w-24 rounded-full bg-white bg-cover bg-center shadow-sm"
          style={
            avatarUrl
              ? { backgroundImage: `url("${encodeURI(avatarUrl)}")` }
              : undefined
          }
        />

        {/* 気持ちの印。アイコンの右下に重ねます */}
        {selectedMood ? (
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow">
            <MoodIcon value={selectedMood.value} className="h-5 w-5" />
          </span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 pt-1">
        {/* truncate = 長いときは「…」で切る */}
        <p className="truncate text-xs text-stone-500">
          {communityNames.join("・")}
        </p>

        <h1 className="mt-0.5 truncate text-2xl font-bold text-stone-800">
          {displayName ?? "名無し"}
        </h1>

        <p className="mt-1 text-xs text-stone-500">
          誕生日{" "}
          {birthday
            ? new Date(birthday).toLocaleDateString("ja-JP", {
                month: "long",
                day: "numeric",
              })
            : "未設定"}
        </p>

        {isMe ? (
          <Link
            href="/profile/edit"
            className="mt-2 inline-block rounded-full bg-stone-300 px-4 py-1.5 text-xs font-bold text-white"
          >
            プロフィールを編集
          </Link>
        ) : null}
      </div>
    </section>
  );
}
