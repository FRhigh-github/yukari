// 未来への手紙で選べる、Google Fonts の日本語フォントです。
//
// next/font/google を使うと、ビルドのときにフォントのファイルを
// このアプリの中に取り込んでくれます。見る人の端末に入っていないフォントでも、
// iPhone でも Android でも同じ見た目になります。
//
// preload: false … 日本語のフォントは1つで数MBあるので、
//                   画面を開いたときに全部を先に読むことはしません。
//                   選んだときに、使う文字のぶんだけ読み込まれます。

import {
  DotGothic16,
  Hachi_Maru_Pop,
  Kaisei_Decol,
  Kiwi_Maru,
  Klee_One,
  Mochiy_Pop_One,
  RocknRoll_One,
  Shippori_Mincho,
  Yomogi,
  Yusei_Magic,
  Zen_Kurenaido,
  Zen_Maru_Gothic,
} from "next/font/google";

// ※ next/font の決まりで、1つずつ const に入れる必要があります
const kleeOne = Klee_One({ weight: "400", preload: false });
const yomogi = Yomogi({ weight: "400", preload: false });
const zenKurenaido = Zen_Kurenaido({ weight: "400", preload: false });
const zenMaruGothic = Zen_Maru_Gothic({ weight: "500", preload: false });
const kiwiMaru = Kiwi_Maru({ weight: "400", preload: false });
const hachiMaruPop = Hachi_Maru_Pop({ weight: "400", preload: false });
const mochiyPopOne = Mochiy_Pop_One({ weight: "400", preload: false });
const shipporiMincho = Shippori_Mincho({ weight: "500", preload: false });
const kaiseiDecol = Kaisei_Decol({ weight: "400", preload: false });
const yuseiMagic = Yusei_Magic({ weight: "400", preload: false });
const rocknRollOne = RocknRoll_One({ weight: "400", preload: false });
const dotGothic16 = DotGothic16({ weight: "400", preload: false });

// style.fontFamily には、next/font が付けた名前が入っています。
// 画面の style にも、画像を作るときの canvas にも、そのまま使えます。
export const WEB_FONTS = [
  { key: "klee", label: "ペン字", family: kleeOne.style.fontFamily },
  { key: "yomogi", label: "えんぴつ", family: yomogi.style.fontFamily },
  { key: "kurenaido", label: "筆ペン", family: zenKurenaido.style.fontFamily },
  { key: "zenmaru", label: "まるゴシ", family: zenMaruGothic.style.fontFamily },
  { key: "kiwimaru", label: "キウイ丸", family: kiwiMaru.style.fontFamily },
  { key: "hachimaru", label: "丸文字ポップ", family: hachiMaruPop.style.fontFamily },
  { key: "mochiy", label: "ぽってり", family: mochiyPopOne.style.fontFamily },
  { key: "shippori", label: "しっぽり明朝", family: shipporiMincho.style.fontFamily },
  { key: "kaisei", label: "かざり明朝", family: kaiseiDecol.style.fontFamily },
  { key: "yusei", label: "マジック", family: yuseiMagic.style.fontFamily },
  { key: "rocknroll", label: "ロックンロール", family: rocknRollOne.style.fontFamily },
  { key: "dot", label: "ドット", family: dotGothic16.style.fontFamily },
];
