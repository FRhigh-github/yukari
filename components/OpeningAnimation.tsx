// アプリを開いたときのアニメーションです。
// 2本の紐が入ってきて淡路結びになり、「ゆかり」の文字が現れます。
//
// ▼ 中身について
// 結び目の形を計算している部分（どこで紐が交差するか、
// どちらが上を通るか）は、もらったコードをほぼそのまま使っています。
// 数学の計算が中心で、読み解かなくても動きます。
// アプリ側として足したのは、この3つだけです。
//   ・一度見たら、そのセッションでは出さない
//   ・画面を押したら飛ばせる
//   ・終わったら、すっと消えてアプリが出てくる

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

// ▼ オープニングを流さない画面
//
//   ログインやサインアップの最中に紐が出てくると、
//   入るという目的の邪魔になります。
//   入ったあと（ホームに着いたとき）に流すほうが、始まりらしくなります。
const SKIP_PATHS = ["/login", "/signup", "/setup", "/recover"];

// 元は9.65秒。起動のたびに長いので、少し早送りで流します。
// 数字を大きくするほど速くなります。
const RATE = 1.7;
const DURATION = 9.65;

// 一度見たかどうかの目印。
// sessionStorage は「タブを閉じるまで覚えておく入れ物」です。
// localStorage だと次の日も覚えてしまい、二度と出なくなります。
const SEEN_KEY = "yukari-opening-seen";

export default function OpeningAnimation() {
  const router = useRouter();

  // 今どの画面にいるか。ログイン系の画面では流しません。
  // この判定はサーバー側でも行われるので、一瞬ちらつくこともありません。
  const pathname = usePathname();
  const isSkipped = SKIP_PATHS.includes(pathname);

  // 「飛ばしてほしい」という合図。描画のループが毎コマ見ています。
  // 状態（useState）ではなくこちらにしているのは、
  // ループの中から読む必要があり、画面の描き直しも要らないためです。
  const skipRef = useRef(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // ▼ 最初から「出す」で始めます。
  //
  //   前は false で始めて、画面が出てから出すか決めていました。
  //   その結果、JSが動き出すまでの間（＝サーバーがホームを作っている間）が
  //   白いままで、待たされているように見えていました。
  //
  //   最初のHTMLに入れておけば、その待ち時間ごと紐で隠せます。
  //   一度見たあとは、下の useEffect がすぐ消します。
  const [isShown, setIsShown] = useState(true);
  const [isFading, setIsFading] = useState(false);
  // 紐と文字が描き終わったか。終わっても自動では消さず、タップを待ちます。
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // sessionStorage はブラウザにしか無いので、
    // 画面が出たあと（＝この中）でしか読めません。
    // そのため、ここで一度だけ状態を変えるのは避けられません。
    try {
      // 一度見ていたら、すぐ片づけます（2回目以降は出しません）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (sessionStorage.getItem(SEEN_KEY) !== null) setIsShown(false);
    } catch {
      // 使えない環境では、そのまま出しておきます
    }

    // ▼ 紐を結んでいる間に、下のタブの行き先を用意しておきます。
    //
    //   オープニングが出ている数秒は、画面が塞がっていて何もできません。
    //   その裏でDBに聞いておけば、はじめてタブを押したときにも待ちません。
    //   ※ 押されるかどうか分からないので、取りに行くだけで表示はしません。
    for (const path of ["/cards", "/letter", "/profile", "/cards/inbox"]) {
      router.prefetch(path);
    }
  }, [router]);

  const finish = () => {
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // 保存できなくても、動きには影響しません
    }
    setIsFading(true);
    // 消えるアニメーション(400ms)が終わってから、要素ごと片づけます
    setTimeout(() => setIsShown(false), 400);
  };

  // ▼ 押されたときの動き。2段階にしています。
  //
  //   1回目 … 途中でも、いっきに完成形まで進める
  //   2回目 … ホームへ進む
  //
  //   1回で消してしまうと、結ばれる瞬間を見ないまま終わります。
  //   急いでいる人も、完成形だけは目に入る形にしました。
  const handleTap = () => {
    if (isDone) {
      finish();
      return;
    }
    // 描画のループはこの箱を見ています（下の tick を参照）
    skipRef.current = true;
  };

  useEffect(() => {
    if (!isShown || isSkipped) return;

    const svg = svgRef.current;
    const box = boxRef.current;
    if (svg === null || box === null) return;

    const cords = svg.querySelector("#cords");
    const defs = svg.querySelector("#rope-defs");
    if (cords === null || defs === null) return;

    // ▼ 作る前に、中を空にします。
    //
    //   開発モードの React は、この処理を2回動かします（書き間違いを見つけるため）。
    //   空にしないと紐の部品が二重にでき、同じ名前の型が2つできてしまいます。
    //   そうなると先にできた空のほうが使われて、紐が見えなくなります。
    cords.replaceChildren();
    defs.replaceChildren();

    // 動きを減らす設定の人には、完成形だけ見せてすぐ終わります
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ns = "http://www.w3.org/2000/svg";
    const clamp = (n: number) => Math.max(0, Math.min(1, n));
    const ease = (n: number) => n * n * (3 - 2 * n);
    const mix = (a: number, b: number, t: number) => a + (b - a) * t;

    const element = (
      name: string,
      attrs: Record<string, string | number>,
      parent: Element,
    ) => {
      const e = document.createElementNS(ns, name);
      Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v)));
      parent.appendChild(e);
      return e;
    };

    const centerX = 240;
    const base: number[][][] = [
      [[385, 615], [339, 655], [285, 704], [236, 724]],
      [[236, 724], [203, 741], [171, 742], [156, 723]],
      [[156, 723], [138, 700], [150, 671], [175, 658]],
      [[175, 658], [196, 647], [220, 652], [240, 665]],
      [[240, 665], [278, 689], [327, 730], [372, 779]],
    ];

    // つなぎ目がカクつかないように、制御点をならします
    for (let j = 1; j < base.length; j++) {
      const p = base[j][0];
      const a = base[j - 1][2];
      const b = base[j][1];
      const ax = p[0] - a[0], ay = p[1] - a[1];
      const bx = b[0] - p[0], by = b[1] - p[1];
      const al = Math.hypot(ax, ay), bl = Math.hypot(bx, by);
      const dx = ax / al + bx / bl, dy = ay / al + by / bl;
      const l = Math.hypot(dx, dy);
      base[j - 1][2] = [p[0] - (dx / l) * al, p[1] - (dy / l) * al];
      base[j][1] = [p[0] + (dx / l) * bl, p[1] + (dy / l) * bl];
    }

    // 1本目を作り、それを左右反転したものを2本目にします
    const white = base.map((c) =>
      c.map(([x, y]) => [centerX + (x - 245) * 1.16, 204 + (y - 704) * 1.16]),
    );
    const gray = white
      .slice()
      .reverse()
      .map((c) => c.slice().reverse().map(([x, y]) => [centerX * 2 - x, y]));

    const curves = [white, gray];
    const bounds: Element[] = [];

    const bezier = (c: number[][], t: number) => {
      const s = 1 - t;
      return {
        x: s * s * s * c[0][0] + 3 * s * s * t * c[1][0] + 3 * s * t * t * c[2][0] + t * t * t * c[3][0],
        y: s * s * s * c[0][1] + 3 * s * s * t * c[1][1] + 3 * s * t * t * c[2][1] + t * t * t * c[3][1],
      };
    };

    const mask = (id: string) => {
      const m = element(
        "mask",
        {
          id,
          maskUnits: "userSpaceOnUse",
          maskContentUnits: "userSpaceOnUse",
          style: "mask-type:luminance",
        },
        defs,
      );
      bounds.push(m);
      return m;
    };

    type Visit = { rope: number; distance: number; over?: boolean; crossing?: Crossing };
    type Crossing = { visits: Visit[]; id: number; over?: Visit; under?: Visit; cut?: Element };

    const strands = curves.map((cs, i) => {
      const points = cs.flatMap((c) =>
        Array.from({ length: 96 }, (_, j) => bezier(c, j / 96)),
      );
      points.push(bezier(cs[cs.length - 1], 1));

      const lengths = [0];
      points.forEach((p, j) => {
        if (j) lengths.push(lengths[j - 1] + Math.hypot(p.x - points[j - 1].x, p.y - points[j - 1].y));
      });

      const group = element(
        "g",
        { "data-rope": i, class: i ? "rope-second" : "rope-first" },
        cords,
      );

      const layers = [24, 21].map((width, j) => {
        const m = mask(`cord-shape-${i}-${j}`);
        const rect = element(
          "rect",
          { class: j ? "cord-body" : "cord-edge", mask: `url(#cord-shape-${i}-${j})` },
          group,
        );
        bounds.push(rect);
        return { width, mask: m };
      });

      const direction = { x: cs[0][1][0] - cs[0][0][0], y: cs[0][1][1] - cs[0][0][1] };
      return {
        i,
        layers,
        points,
        lengths,
        direction,
        total: lengths[lengths.length - 1],
        visits: [] as Visit[],
        chunks: [] as {
          index: number;
          lo: number;
          hi: number;
          layers: { path: Element; start: Element; end: Element; radius: number }[];
        }[],
      };
    });

    // ▼ 紐どうしが交わる場所を全部さがします。
    //   交互に「上・下」を割り当てると、編んだように見えます。
    const crossings: Crossing[] = [];
    for (let r = 0; r < 2; r++)
      for (let q = r; q < 2; q++) {
        const apts = strands[r].points, bpts = strands[q].points;
        for (let i = 0; i < apts.length - 1; i++)
          for (let j = r === q ? i + 3 : 0; j < bpts.length - 1; j++) {
            const a = apts[i], b = apts[i + 1], c = bpts[j], d = bpts[j + 1];
            const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
            const den = rx * sy - ry * sx;
            if (Math.abs(den) < 1e-8) continue;
            const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / den;
            const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / den;
            if (t <= 0 || t >= 1 || u <= 0 || u >= 1) continue;
            const first: Visit = { rope: r, distance: mix(strands[r].lengths[i], strands[r].lengths[i + 1], t) };
            const second: Visit = { rope: q, distance: mix(strands[q].lengths[j], strands[q].lengths[j + 1], u) };
            const crossing: Crossing = { visits: [first, second], id: crossings.length };
            first.crossing = crossing;
            second.crossing = crossing;
            strands[r].visits.push(first);
            strands[q].visits.push(second);
            crossings.push(crossing);
          }
      }

    strands.forEach((s) => {
      s.visits.sort((a, b) => a.distance - b.distance);
      s.visits.forEach((v, j) => (v.over = j % 2 === 1));
    });

    for (const c of crossings) {
      c.over = c.visits.find((v) => v.over);
      c.under = c.visits.find((v) => !v.over);
      const m = mask(`under-${c.id}`);
      bounds.push(element("rect", { fill: "white" }, m));
      c.cut = element(
        "path",
        { fill: "none", stroke: "black", "stroke-width": 25, "stroke-linecap": "round", "stroke-linejoin": "round" },
        m,
      );
    }

    for (const s of strands)
      s.visits.forEach((v, j) => {
        const lo = j ? (s.visits[j - 1].distance + v.distance) / 2 : 0;
        const hi = j < s.visits.length - 1 ? (v.distance + s.visits[j + 1].distance) / 2 : s.total;
        const layers = s.layers.map((layer) => {
          const group = element("g", v.over ? {} : { mask: `url(#under-${v.crossing?.id})` }, layer.mask);
          const path = element(
            "path",
            { fill: "none", stroke: "white", "stroke-width": layer.width, "stroke-linecap": "butt", "stroke-linejoin": "round" },
            group,
          );
          const start = element("circle", { fill: "white", r: 0 }, group);
          const end = element("circle", { fill: "white", r: 0 }, group);
          return { path, start, end, radius: layer.width / 2 };
        });
        s.chunks.push({ index: j, lo, hi, layers });
      });

    type Strand = (typeof strands)[number];

    const at = (s: Strand, d: number) => {
      d = Math.max(0, Math.min(s.total, d));
      let lo = 0, hi = s.lengths.length - 1;
      while (lo + 1 < hi) {
        const m = (lo + hi) >> 1;
        if (s.lengths[m] < d) lo = m;
        else hi = m;
      }
      const f = (d - s.lengths[lo]) / (s.lengths[hi] - s.lengths[lo] || 1);
      return { x: mix(s.points[lo].x, s.points[hi].x, f), y: mix(s.points[lo].y, s.points[hi].y, f) };
    };

    const portion = (s: Strand, lo: number, hi: number) => {
      lo = Math.max(0, lo);
      hi = Math.min(s.total, hi);
      if (hi <= lo) return [];
      const pts = [at(s, lo)];
      s.points.forEach((p, j) => {
        if (s.lengths[j] > lo && s.lengths[j] < hi) pts.push(p);
      });
      pts.push(at(s, hi));
      return pts;
    };

    const pathData = (pts: { x: number; y: number }[]) =>
      pts.map((p, j) => `${j ? "L" : "M"}${p.x.toFixed(4)} ${p.y.toFixed(4)}`).join(" ");

    const cap = (circle: Element, p: { x: number; y: number } | null, r: number) => {
      circle.setAttribute("r", String(p ? r : 0));
      if (p) {
        circle.setAttribute("cx", String(p.x));
        circle.setAttribute("cy", String(p.y));
      }
    };

    // 「ゆかり」の文字。線をなぞるように出します。
    //
    // 書き順の制御（stroke-dasharray）を入れ終えたので、ここで見える状態に戻します。
    // HTML側では opacity=0 にしてあります。そうしないと、
    // ここへ来るまでの一瞬だけ、完成した文字が見えてしまいます。
    const lettering = svg.querySelector<SVGGElement>("#lettering");
    if (lettering !== null) lettering.style.opacity = "1";

    const letters = [...svg.querySelectorAll<SVGPathElement>("#lettering path")].map((el) => {
      const length = el.getTotalLength();
      el.style.strokeDasharray = `${length} ${length}`;
      // 線の長さぶんずらして、まだ1本も描かれていない状態にしておきます
      el.style.strokeDashoffset = `${length}`;
      return {
        el,
        length,
        at: Number(el.dataset.at) + 3.1,
        duration: Number(el.dataset.duration),
      };
    });

    let reach = 1400;
    let lastPainted = 0;

    const measure = () => {
      const rect = svg.getBoundingClientRect();
      const outer = box.getBoundingClientRect();
      const ratio = 410 / Math.max(rect.width, 1);
      reach = Math.max(innerWidth, innerHeight) * ratio + 500;
      const region = {
        x: 35 + (outer.left - rect.left) * ratio - 32,
        y: 10 + (outer.top - rect.top) * ratio - 32,
        width: outer.width * ratio + 64,
        height: outer.height * ratio + 64,
      };
      bounds.forEach((el) =>
        Object.entries(region).forEach(([k, v]) => el.setAttribute(k, String(v))),
      );
    };

    const paint = (seconds: number) => {
      lastPainted = seconds;
      const heads: number[] = [];

      for (const s of strands) {
        const enter = ease(clamp(seconds / 1.1));
        const feed = clamp((seconds - 1.1) / 4.35);
        const tail = ease(clamp((seconds - 4.45) / 1.8));
        const p = s.points[0];
        const l = Math.hypot(s.direction.x, s.direction.y);
        const tangent = [p.x - (s.direction.x / l) * 90, p.y - (s.direction.y / l) * 90];
        const inlet = s.i
          ? [[centerX - reach, 460], [-200, 450], tangent, [p.x, p.y]]
          : [[centerX + reach, 65], [710, 45], tangent, [p.x, p.y]];

        const inletPts: { x: number; y: number }[] = [];
        if (tail < enter)
          for (let j = 0; j <= 140; j++) inletPts.push(bezier(inlet, mix(tail, enter, j / 140)));

        const head = s.total * feed;
        heads[s.i] = head;

        for (const chunk of s.chunks) {
          const pts = portion(s, Math.max(0, chunk.lo - 0.6), Math.min(head, chunk.hi + 0.6));
          if (chunk.index === 0 && inletPts.length) pts.unshift(...inletPts);
          const d = pathData(pts);
          const hasHead =
            (feed > 0 && head > chunk.lo && head <= chunk.hi) ||
            (feed === 0 && chunk.index === 0 && inletPts.length > 0);
          const tip = hasHead ? (feed > 0 ? at(s, head) : inletPts[inletPts.length - 1]) : null;
          const start = chunk.index === 0 && pts.length ? pts[0] : null;
          for (const layer of chunk.layers) {
            layer.path.setAttribute("d", d);
            cap(layer.start, start, layer.radius);
            cap(layer.end, tip, layer.radius);
          }
        }
      }

      for (const c of crossings) {
        if (!c.over || !c.cut) continue;
        const s = strands[c.over.rope];
        const d = c.over.distance;
        c.cut.setAttribute("d", pathData(portion(s, d - 48, Math.min(d + 48, heads[s.i]))));
      }

      for (const { el, length, at: start, duration } of letters) {
        const p = clamp((seconds - start) / duration);
        el.style.opacity = p > 0 ? "1" : "0";
        el.style.strokeDashoffset = String(length * (1 - ease(p)));
      }
    };

    measure();
    const onResize = () => {
      measure();
      paint(lastPainted);
    };
    addEventListener("resize", onResize);

    if (reduceMotion) {
      paint(DURATION);
      // 描き終わった状態にします。
      // 0秒の setTimeout にしているのは、画面を描いている最中ではなく
      // 描き終わったあとに切り替えるためです（React に怒られます）。
      const timer = setTimeout(() => setIsDone(true), 0);
      return () => {
        clearTimeout(timer);
        removeEventListener("resize", onResize);
      };
    }

    let time = 0;
    let last = performance.now();
    let request = 0;

    const tick = (now: number) => {
      // 1回目のタップで、いっきに完成形まで進めます
      if (skipRef.current) time = DURATION;

      time = Math.min(DURATION, time + ((now - last) / 1000) * RATE);
      last = now;
      paint(time);
      if (time >= DURATION) {
        // 完成したら、そのまま止めて待ちます。
        // 押されるまで消えないので、じっくり見られます。
        setIsDone(true);
        return;
      }
      request = requestAnimationFrame(tick);
    };

    paint(0);
    request = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(request);
      removeEventListener("resize", onResize);
      // 作ったものを片づけます。残すと、次に作るぶんと重なります。
      cords.replaceChildren();
      defs.replaceChildren();
    };
  }, [isShown, isSkipped]);

  if (!isShown || isSkipped) return null;

  return (
    <div
      ref={boxRef}
      onClick={handleTap}
      // absolute inset-0 = 親（アプリの枠）いっぱいに広げる。
      // overflow-hidden = はみ出したぶんを切り取る。
      //   紐は画面の外から入ってくるので、これが無いと
      //   アプリの枠を越えて、外の灰色の上まで描かれてしまいます。
      // z-[100] で、下タブより手前に出します。
      // opening-overlay = 一度見たあとに隠すための目印（globals.css）
      className={`opening-overlay absolute inset-0 z-[100] grid place-items-center overflow-hidden bg-[#faf9f6] transition-opacity duration-400 ${
        isFading ? "opacity-0" : "opacity-100"
      }`}
    >
      <svg
        ref={svgRef}
        viewBox="35 10 410 600"
        // 枠の幅の8割。縦にも収まるよう、高さにも上限を付けています
        className="max-h-[70%] w-[80%] overflow-visible"
        aria-label="ゆかり"
      >
        <defs id="rope-defs" />
        <g
          id="cords"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          // ▼ 紐の色。水引の紅白にしています。
          //
          //   cord-body = 紐の真ん中、cord-edge = そのふち です。
          //   ふちを本体より少し濃くすると、平らな帯ではなく
          //   丸い紐が置いてあるように見えます。
          //
          //   1本目の「白」は、真っ白ではなく生成り(#eee6d7)にしています。
          //   背景が白なので、本当に白くすると紐が消えてしまい、
          //   紅の1本だけが宙に浮いて見えてしまうためです。
          //   水引の白も、実物は紙に近いこの色をしています。
          //
          //   2本目が紅。globals.css の --mizuhiki-beni と同じ色です。
          className="pointer-events-none [&_.cord-body]:fill-[#eee6d7] [&_.cord-edge]:fill-[#b7ae9d] [&_.rope-second_.cord-body]:fill-[#b7282e] [&_.rope-second_.cord-edge]:fill-[#8a1d22]"
        />
        <g
          id="lettering"
          // ▼ 最初は隠しておきます。
          //
          //   「ゆかり」の線はHTMLに最初から書いてあるので、
          //   何もしないと、JSが描き始めるまでの一瞬だけ
          //   完成した文字がそのまま見えてしまいます。
          //
          //   JSは1コマ目で opacity を 1 に戻します。
          //   （書き順の制御は stroke-dasharray でやっています）
          opacity={0}
          fill="none"
          stroke="#282b27"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path data-at="3.15" data-duration=".58" d="M153 426 C116 417 122 392 150 380 C177 367 207 373 214 391 C224 414 202 434 168 440" />
          <path data-at="3.57" data-duration=".85" d="M179 356 C187 424 144 520 68 579" />
          <path data-at="4.3" data-duration=".4" d="M256 392 C247 418 224 452 204 476" />
          <path data-at="4.61" data-duration=".42" d="M229 416 C242 396 265 402 279 413 C296 430 282 438 264 429" />
          <path data-at="4.91" data-duration=".19" d="M274 379 C280 388 285 395 290 399" />
          <path data-at="5.12" data-duration=".22" d="M323 369 C325 384 326 395 337 389" />
          <path data-at="5.37" data-duration=".83" d="M357 369 C383 434 353 517 298 570" />
        </g>
      </svg>

      {/* ▼ 案内の文字は、少し遅れて出します。
          HTMLは先に届きますが、紐はJSが描き始めてから現れます。
          そのため何もしないと、紐より先に文字だけが一瞬見えます。
          opening-caption は globals.css で「0.35秒待ってから浮かび上がる」指定です。 */}
      <p className="opening-caption absolute bottom-16 text-[11px] tracking-[0.22em] text-[#767a72]">
        糸がむすぶ、ゆかり。
      </p>
      <p className="opening-caption absolute bottom-8 text-xs text-stone-400">
        {isDone ? "画面を押してはじめる" : "画面を押すと最後まで進みます"}
      </p>
    </div>
  );
}
