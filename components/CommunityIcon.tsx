// コミュニティのアイコンです。設定画面のいちばん上に出します。
//
// アイコンは、そのコミュニティの人なら誰でも変えられます。
// 名前や招待コードと違って、間違えても直せばいいものだからです。
//
// ただし RLS は「行」の単位でしか効かないので、
// 「メンバーなら communities を書き換えてよい」にすると
// 名前や招待コードまで一緒に変えられてしまいます。
// そのため、アイコンだけを変える関数を DB 側に用意して、それを呼んでいます。
//   → supabase/02_community_icon.sql の set_community_icon

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { shrinkImage } from "@/lib/image";
import CameraBadge from "@/components/CameraBadge";

type CommunityIconProps = {
  communityId: string;
  name: string;
  // まだ決めていなければ null
  iconUrl: string | null;
};

export default function CommunityIcon({
  communityId,
  name,
  iconUrl,
}: CommunityIconProps) {
  const router = useRouter();

  // ▼ 画像を選んでも、すぐには保存しません。
  //   選ぶ → 見た目だけ変わる → 「保存する」で確定、の順にします。
  //   選んだ瞬間に保存すると、いつ反映されたのか分からず、
  //   間違えて選んだときにも取り消せないためです。
  const [preview, setPreview] = useState(iconUrl);
  // 選んだけれど、まだ保存していない画像。null なら何も選んでいない
  const [picked, setPicked] = useState<Blob | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // 結果の知らせ。isError でエラーかどうかを分けて色を変えます
  const [message, setMessage] = useState<{ text: string; isError: boolean } | null>(null);

  const handlePick = async (file: File) => {
    setMessage(null);

    // shrinkImage = 大きすぎる写真を小さくします。
    // そのまま上げると、開くたびに何MBも読み込むことになります。
    //
    // ただし、ブラウザが読めない形式（iPhone の HEIC など）だと失敗します。
    // 前はここで止まってしまい、何も起きないように見えていました。
    // 失敗したときは、縮めずに元のファイルのまま進めます。
    let blob: Blob = file;
    try {
      blob = await shrinkImage(file);
    } catch {
      blob = file;
    }
    setPicked(blob);
    // createObjectURL = 選んだ画像を、その場で表示できるURLにする命令
    setPreview(URL.createObjectURL(blob));
  };

  // やめる：選ぶ前の絵に戻します
  const handleCancel = () => {
    setPicked(null);
    setPreview(iconUrl);
    setMessage(null);
  };

  const handleSave = async () => {
    if (picked === null) return;
    setMessage(null);
    setIsSaving(true);

    try {
      const blob = picked;
      const supabase = createClient();

      // ▼ avatars はプロフィール写真と同じ、公開の置き場所です。
      //   公開なので、URLをそのまま communities に入れておけます。
      //   非公開だと、コミュニティを出すたびに期限付きURLの発行が要ります。
      //
      //   ファイル名はコミュニティのid。
      //   変えるたびにファイルが増えていかないようにするためです。
      const path = `communities/${communityId}.jpg`;
      const upload = await supabase.storage
        .from("avatars")
        .upload(path, blob, {
          // 縮められなかったときは元の形式のままなので、ファイルに合わせます
          contentType: blob.type || "image/jpeg",
          // upsert = 同じ名前があれば上書きする
          upsert: true,
        });

      if (upload.error) throw new Error(`画像: ${upload.error.message}`);

      const { data: publicUrl } = supabase.storage
        .from("avatars")
        .getPublicUrl(path);

      // ?t=... を付けて、古い絵が表示され続けるのを防ぎます
      const savedUrl = `${publicUrl.publicUrl}?t=${Date.now()}`;

      // ▼ 表を直接書き換えるのではなく、DB側の関数を呼びます。
      //   関数の中で「このコミュニティの人か」を確かめているので、
      //   メンバーでなければここでエラーが返ります。
      const { error } = await supabase.rpc("set_community_icon", {
        target_community: communityId,
        url: savedUrl,
      });

      if (error) throw new Error(error.message);

      setPicked(null);
      setMessage({ text: "保存しました", isError: false });
      // 画面を取り直して、上のバーなどにも新しい絵を出します
      router.refresh();
    } catch (error) {
      // 何で止まったかが分かるように、エラーの中身も出します
      setMessage({
        text: `保存できませんでした（${error instanceof Error ? error.message : "原因不明"}）`,
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  // 四角にしているのは、上のバーで人の顔と見分けがつくようにするためです。
  const square = (
    <span
      className={`block h-20 w-20 rounded-2xl bg-stone-200 bg-cover bg-center ${
        isSaving ? "opacity-50" : ""
      }`}
      style={
        preview ? { backgroundImage: `url("${encodeURI(preview)}")` } : undefined
      }
    />
  );

  return (
    // 縦に2段。上の段にアイコンと名前、下の段に「保存する・やめる」を出します
    <section>
      <div className="flex items-center gap-4">
        {/* label で包むと、中のどこを押しても写真を選べます。
            input 本体は hidden で隠します（見た目が端末ごとに違うため）。 */}
        <label className="relative shrink-0 cursor-pointer">
          {square}
          {/* カメラの印。これが無いと「押せる」と気づかれません */}
          <CameraBadge />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) handlePick(file);
              // 同じ画像をもう一度選んでも反応するように、選んだ記録を消しておきます
              event.target.value = "";
            }}
          />
        </label>

        {/* min-w-0 = 名前が長くても、この欄が押し広がらないようにする指定 */}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold text-stone-800">{name}</h1>
          {message ? (
            <p className={`mt-1 text-xs ${message.isError ? "text-red-600" : "text-stone-500"}`}>
              {message.text}
            </p>
          ) : (
            <p className="mt-1 text-xs text-stone-400">
              {picked !== null ? "まだ保存していません" : "押すと絵を変えられます"}
            </p>
          )}
        </div>
      </div>

      {/* ▼ 画像を選んだあとだけ、名前の下（招待コードの上）に出します。
            横いっぱいのボタンにして、押し忘れないようにしています */}
      {picked !== null ? (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving}
            className="h-12 flex-1 cursor-pointer rounded-xl border border-stone-300 text-sm text-stone-600 disabled:opacity-50"
          >
            やめる
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="h-12 flex-[2] cursor-pointer rounded-xl bg-stone-800 text-sm font-bold text-white disabled:opacity-50"
          >
            {isSaving ? "保存中…" : "保存する"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
