// 写真を小さくしてから送るための処理です。
//
// スマホの写真はそのままだと 3〜5MB あります。
// 送るのにも時間がかかりますし、見るときも毎回そのサイズを読むことになります。
// 長辺を 900px までに縮めると、見た目はほぼ変わらないのに
// 大きさは10分の1以下になります。
//
// 900 は、スマホの表示幅（約350px）の2.5倍です。
// 画面は1点を2〜3個の点で描くので、このくらいあれば粗く見えません。
// 前は1200でしたが、表示に使われない大きさぶんだけ
// 毎回ダウンロードを待つことになるので、下げました。

const MAX_SIZE = 900;

export async function shrinkImage(file: File): Promise<Blob> {
  // createImageBitmap = 画像ファイルを、canvas に描ける形にして読み込む命令
  const bitmap = await createImageBitmap(file);

  // 長辺が MAX_SIZE を超えていたら、その割合ぶん縮めます。
  // 元から小さい写真を引き伸ばさないよう、1 を上限にしています。
  const scale = Math.min(1, MAX_SIZE / Math.max(bitmap.width, bitmap.height));

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const ctx = canvas.getContext("2d");
  if (ctx === null) {
    throw new Error("画像の変換に失敗しました");
  }

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  // JPEG にそろえます。PNG のままだと写真では容量が大きくなるためです。
  // 0.78 は画質。1 に近いほどきれいですが、そのぶん重くなります。
  // 写真は 0.8 前後から下で見分けがつきにくくなるので、この辺りが境目です。
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.78);
  });

  if (blob === null) {
    throw new Error("画像の変換に失敗しました");
  }

  return blob;
}
