// 読み込み中に出す、あわじ結びです。
//
// タグの正体は public/yukari-loader.js にあります。
// 中の CSS が position: fixed（画面全体をふさぐ）になっているので、
// absolute で上書きして、スマホの枠の中だけにおさめています。

type LoaderProps = {
  // "full"    … 枠いっぱい（ページごと待っているとき）
  // "content" … 上のバーと下のタブを残して、真ん中だけ
  //
  // 切り替えのように「画面の一部だけが変わる」ときに全部消すと、
  // 今どこにいるのか分からなくなります。変わるところだけにします。
  area?: "full" | "content";
};

// 上のバーと下のタブの高さぶん、内側に寄せるための数字です
const HEADER = "3.5rem";
const NAV = "4.75rem";

export default function Loader({ area = "full" }: LoaderProps) {
  return (
    <yukari-loader
      style={
        area === "content"
          ? {
              position: "absolute",
              top: HEADER,
              bottom: NAV,
              left: 0,
              right: 0,
              // 下の白い画面と同じ色にして、色が変わったと感じさせません
              background: "#ffffff",
            }
          : {
              position: "absolute",
              // 生成り色のままだと、画面が切り替わるたびに
              // 色の違う板が割り込んで見えます。アプリと同じ白にします。
              background: "#ffffff",
            }
      }
    />
  );
}
