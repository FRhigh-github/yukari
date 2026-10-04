// アイコン（avatars の置き場所）のファイル名を作る・URL から取り出す処理です。
// プロフィールのアイコン（ProfileForm / SetupForm）と、コミュニティのアイコン（CommunityIcon）で使います。
//
// ▼ なぜファイル名にランダムな id を入れるのか
//   avatars は公開の置き場所なので、URL さえ分かれば、ログインしていない人でも見られます。
//   前は「<ユーザーの id>.jpg」という名前だったので、id を知っている人なら誰でも
//   URL を作れてしまいました（id は画面の URL にも出ています）。
//   毎回ランダムな id を名前にすると、URL を教えてもらった人しか見られません。
//   アイコンを変えたら、前のファイルは消します（removeOldAvatar）。

// 置き場所の中の場所。folder は「<自分の id>」か「communities/<コミュニティの id>」
export function newAvatarPath(folder: string) {
  return `${folder}/${crypto.randomUUID()}.jpg`;
}

// 公開URLから、置き場所の中の場所を取り出します。
// このアプリの avatars のURLでなければ null（Google のアイコンや、ダミーの絵など）
export function avatarPathFromUrl(url: string | null) {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const index = url.indexOf(marker);
  if (index === -1) return null;
  // 後ろの ?t=... は場所ではないので外します
  return url.slice(index + marker.length).split("?")[0];
}
