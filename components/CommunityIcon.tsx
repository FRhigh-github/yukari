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

  // 選んだ絵を、保存を待たずにその場で出すための覚え書きです。
  // 上げ終わるまで前のままだと「押せていない」と感じます。
  const [preview, setPreview] = useState(iconUrl);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handlePick = async (file: File) => {
    setMessage(null);
    setIsSaving(true);

    try {
      // shrinkImage = 大きすぎる写真を小さくします。
      // そのまま上げると、開くたびに何MBも読み込むことになります。
      const blob = await shrinkImage(file);
      // createObjectURL = 選んだ画像を、その場で表示できるURLにする命令
      setPreview(URL.createObjectURL(blob));

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
          contentType: "image/jpeg",
          // upsert = 同じ名前があれば上書きする
          upsert: true,
        });

      if (upload.error) throw new Error(upload.error.message);

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

      router.refresh();
    } catch {
      setMessage("保存できませんでした");
      // 上げられなかったので、見た目も元に戻します
      setPreview(iconUrl);
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
    <section className="flex items-center gap-4">
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
          }}
        />
      </label>

      {/* min-w-0 = 名前が長くても、この欄が押し広がらないようにする指定 */}
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-stone-800">{name}</h1>
        {message ? (
          <p className="mt-1 text-xs text-red-600">{message}</p>
        ) : (
          <p className="mt-1 text-xs text-stone-400">押すと絵を変えられます</p>
        )}
      </div>
    </section>
  );
}
