// <yukari-loader> は自分たちで作ったタグなので、
// TypeScript はこのままだと「そんなタグは知らない」と言ってきます。
// ここで「こういうタグがあります」と教えておきます。

import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "yukari-loader": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        // 明滅の速さ。1が標準で、小さいほどゆっくりです。
        speed?: string;
      };
    }
  }
}
