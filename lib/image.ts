// 写真を小さくしてから送るための処理です。
//
// スマホの写真はそのままだと 3〜5MB あります。
// 送るのにも時間がかかりますし、見るときも毎回そのサイズを読むことになります。
// 長辺を 1200px までに縮めると、見た目はほぼ変わらないのに
// 大きさは10分の1くらいになります。

const MAX_SIZE = 1200;

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
  // 0.82 は画質。1 に近いほどきれいですが、そのぶん重くなります。
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.82);
  });

  if (blob === null) {
    throw new Error("画像の変換に失敗しました");
  }

  return blob;
}
