# 梅結びの形を計算して、lib/umeKnot.ts に書き出すスクリプトです。
#
#   python scripts/ume_knot.py
#
# 手で座標を書くのは無理なので、式で作っています。
#
# ▼ 梅結びは、1本の紐が5枚の花びらを作りながら、
#   真ん中で星の形に交わる結び方です。
#   実物は、あわじ結びの輪にさらに端を通して5枚にしたものです。
#
# ▼ 形は「円の弧」と「まっすぐな線」だけで作っています。
#     花びら   = 円の弧
#     真ん中   = 花びらから花びらへ、まっすぐ渡る線（星形になる）
#   線は、円にぴったり接する向き（接線）で出入りさせるので、つなぎ目で折れません。
#   まっすぐな線は曲がらないので、曲がる向きが途中で入れかわる「S字」も出ません。
#   水引の図解（花びらを1枚ずつ作っていく図）も、この形で描かれています。
#
# ▼ 端は2本とも結び目の真ん中に残し、そこから結び目の後ろを通って、
#   右上の花びらのてっぺんから、まっすぐ外へ抜けていきます。
#
# ▼ 上と下（どちらの紐が上を通るか）は、紐をたどりながら
#   「上・下・上・下…」と交互にしています。
#   水引の結びは、どれもこの交互の通し方でできています。
import numpy as np

PETAL = 0.88       # 花びらの円の大きさ（中心から花びらまでの距離を 1 としたとき）
TILT = 0           # 結び目を傾ける角度（度）。プラスで時計回り
END_GAP = 0.9      # 切った星の線の、2本の端のあいだの長さ
LEAVE_ANGLE = 115  # 端が花びらから出ていく向き（度）。0 が右、90 が真下。115 は左下
LEAVE_FAR = 5.0    # 右へ抜けていく、まっすぐな部分の長さ（画面の外まで届く長さ）
OUT = 0.08         # 花びらから出て、曲がり始めるまでの長さ
SWEEP = 0.32       # 左下から右へ向きを変えるときの、曲がりの大きさ（大きいほどゆるやか）
SPACING = 0.34     # 抜けていく2本の紐のあいだ
SHOW_TAIL = 1.6    # 右へ伸びる部分のうち、絵の枠に入れる長さ（ここにメンバーの札を置く）
SCALE = 100        # 画面の座標に直すときの倍率

# 花びらの円の中心。画面は下向きが +y なので、-90度が真上です
angles = np.radians(-90 + 72 * np.arange(5))
centers = np.c_[np.cos(angles), np.sin(angles)]

# 花びらを回る順番。1つ飛ばしにすると、真ん中を渡る線が星形になります
order = [(i * 2) % 5 for i in range(5)]


def side(d):
    """進む向き d に対して、横向き（左手側）の向き"""
    return np.array([-d[1], d[0]])


def unit(v):
    return v / np.linalg.norm(v)


points = []
lines = []   # 真ん中を渡る線の、始まりと終わりの点の番号
for k in range(5):
    prev_c = centers[order[k - 1]]
    here = centers[order[k]]
    next_c = centers[order[(k + 1) % 5]]
    d_in = unit(here - prev_c)
    d_out = unit(next_c - here)

    # 円に入る点と出る点（どちらも円に接する向き）
    p_in = here + PETAL * side(d_in)
    p_out = here + PETAL * side(d_out)
    a0 = np.arctan2(p_in[1] - here[1], p_in[0] - here[0])
    a1 = np.arctan2(p_out[1] - here[1], p_out[0] - here[0])

    # 入ってきた向きのまま、円の上を回ります（逆回りにすると折れてしまう）
    forward = np.array([-np.sin(a0), np.cos(a0)])
    turn = 1 if forward @ d_in > 0 else -1
    sweep = ((a1 - a0) * turn) % (2 * np.pi)
    th = a0 + turn * np.linspace(0, sweep, int(np.degrees(sweep) * 2))
    points += list(here + PETAL * np.c_[np.cos(th), np.sin(th)])

    # 次の花びらへ、まっすぐ渡る線
    p_next = next_c + PETAL * side(d_out)
    steps = int(np.linalg.norm(p_next - p_out) * 200)
    q = np.linspace(0, 1, steps)[1:-1]
    lines.append((len(points), len(points) + len(q)))
    points += list(p_out + np.outer(q, p_next - p_out))

P = np.array(points)

# ▼ 結び目ごと回します。
#   上に1枚・下に2枚の向きから、TILT 度だけ傾けて、少し動きを出します。
rot = np.radians(TILT)
P = P @ np.array([[np.cos(rot), -np.sin(rot)], [np.sin(rot), np.cos(rot)]]).T

# 端が花びらから出ていく向き（左下）
leave = np.radians(LEAVE_ANGLE)
LEAVE = np.array([np.cos(leave), np.sin(leave)])

# ▼ 端を作ります。
#   星の線のうち、抜けていく向きと反対側（左下）にある線を切ります。
#
#   ただし「上・下」は、切る前のつながった結び目で決めます。
#   切ってから決めると、切り口のせいで「上・下・上・下」の順番がずれて、
#   どこかで上が2回続くなど、重なり方がおかしくなるためです。
#   そのため、ここでは並びの始まりを切る場所にそろえておくだけにして、
#   実際に切るのは、描く区間を作るとき（下のほう）です。
#   どの線を切るかは、2つの条件で選びます。
#     ・抜けていく向きと直角に近い線
#       → 切った2本の端が左右を向くので、どちらも同じくらい曲がるだけで右上へ向かえる。
#         （平行な線を切ると、片方の端が逆向きになり、ぐるっとUターンしてしまう）
#     ・抜けていく先から遠い（左下の）線
def cut_score(se):
    direction = unit(P[se[1] - 1] - P[se[0]])
    middle = P[(se[0] + se[1]) // 2]
    return abs(direction @ LEAVE) + 0.3 * (middle @ LEAVE)


start, end = min(lines, key=cut_score)
mid = (start + end) // 2
P = np.r_[P[mid:], P[:mid]]
gap = int(END_GAP / 2 * 200)   # 切り口の両側で、描かない点の数


# ▼ 抜けていく2本の端。
#   右上の花びら（抜けていく向きにいちばん出ている花びら）の、丸のてっぺんから
#   まっすぐ外へ抜けていくようにします。
#   2本は、その花びらの真ん中の線をはさんで、左右に同じだけ離して並べます。
#
#   切り口から花びらまでは、結び目の後ろを通します。
turned_centers = centers @ np.array([[np.cos(rot), -np.sin(rot)], [np.sin(rot), np.cos(rot)]]).T
petal = max(turned_centers, key=lambda c: c @ LEAVE)
APEX = petal + LEAVE * PETAL   # 花びらの丸のてっぺん
across = side(LEAVE)           # 抜けていく向きに対して、左手側


def bezier(p0, c1, c2, p3, steps):
    """なめらかな曲線（3次ベジェ曲線）の点を並べます"""
    u = np.linspace(0, 1, steps)[:, None]
    return (1 - u) ** 3 * p0 + 3 * (1 - u) ** 2 * u * c1 + 3 * (1 - u) * u ** 2 * c2 + u ** 3 * p3


# 切り口の2つの端（位置と、紐の先が向いている向き）
ends = [
    (P[gap], unit(P[gap] - P[gap + 1])),            # 片方は、並びを逆向きにたどった先
    (P[-gap - 1], unit(P[-gap - 1] - P[-gap - 2])),
]


def make_tail(end, offset):
    """切り口から、結び目の後ろを通って、花びらのてっぺんまでの紐"""
    point, heading = end
    # 花びらの丸のふちの上で、この紐が通る点。
    # 真ん中の線から offset だけずれているので、てっぺんより少し手前になります（三平方の定理）
    rim = petal + across * offset + LEAVE * np.sqrt(PETAL ** 2 - offset ** 2)
    # 切り口からふちまでは、ゆるやかな曲線でつなぎます。
    # ふちに着くころには抜けていく向きにまっすぐ向いているので、てっぺんで紐がゆがみません。
    reach = np.linalg.norm(rim - point)
    curve = bezier(point, point + heading * reach * 0.35, rim - LEAVE * reach * 0.45, rim, 1200)
    return curve


def count_between(a, b):
    """2本の線が、何回交差するか"""
    return sum(1 for _ in crossings_between(a, b))


def crossings_between(a, b):
    """線 a と線 b が交わる場所を、1つずつ返します（速くするため、点を3個に1個だけ見ます）"""
    for i in range(0, len(a) - 1, 3):
        p, q = a[i], a[min(i + 3, len(a) - 1)]
        for j in range(0, len(b) - 1, 3):
            r, t = b[j], b[min(j + 3, len(b) - 1)]
            d1 = q - p; d2 = t - r
            den = d1[0] * d2[1] - d1[1] * d2[0]
            if abs(den) < 1e-12: continue
            u = ((r - p)[0] * d2[1] - (r - p)[1] * d2[0]) / den
            v = ((r - p)[0] * d1[1] - (r - p)[1] * d1[0]) / den
            if 0 <= u < 1 and 0 <= v < 1: yield (i, j)


# どちらの端を左右どちらに通すかで、2本が途中で交差するかが変わるので、
# 2通り作ってみて、交差しないほうを選びます
half = SPACING / 2
option_a = [make_tail(ends[0], -half), make_tail(ends[1], half)]
option_b = [make_tail(ends[0], half), make_tail(ends[1], -half)]
tails = min([option_a, option_b], key=lambda two: count_between(two[0], two[1]))

# ▼ 花びらから出た2本を、左下へ少し進ませてから、ぐるっと右へ向けて、画面の外へ伸ばします。
#   曲がる向きは「左下 → 下 → 右」の一方向だけなので、S字にはなりません。
#   2本は同じ中心の円の上を曲がるので、曲がっているあいだも幅がそろったままです。
heading_angle = np.radians(LEAVE_ANGLE)
# 円の上の位置を表す角度。進む向きの角度に 90度 足したものになります
th0 = heading_angle + np.pi / 2
to_center = -np.array([np.cos(th0), np.sin(th0)])

# 2本の先を、出ていく向きにそろえます（遅れているほうを長めにまっすぐ伸ばす）
far = max(t[-1] @ LEAVE for t in tails) + OUT
starts = []
for i, t in enumerate(tails):
    extra = far - t[-1] @ LEAVE
    line = t[-1] + np.outer(np.linspace(0, extra, max(int(extra * 200), 2)), LEAVE)
    tails[i] = np.r_[t, line[1:]]
    starts.append(tails[i][-1])

# 内側（曲がる中心に近いほう）の紐が SWEEP の大きさで曲がるように、中心を決めます
inner = max(starts, key=lambda q: q @ to_center)
center = inner + SWEEP * to_center
BOTTOM_RUNS = []
for i, start in enumerate(starts):
    radius = np.linalg.norm(start - center)
    th = np.linspace(th0, np.pi / 2, int(np.degrees(th0 - np.pi / 2) * 2))
    arc = center + radius * np.c_[np.cos(th), np.sin(th)]
    run = arc[-1] + np.c_[np.linspace(0, LEAVE_FAR, int(LEAVE_FAR * 200)), np.zeros(int(LEAVE_FAR * 200))]
    tails[i] = np.r_[tails[i], arc[1:], run[1:]]
    BOTTOM_RUNS.append(run)

def crossings(P):
    n = len(P); out = []
    for i in range(n - 1):
        a, b = P[i], P[i + 1]
        for j in range(i + 2, n - 1):
            c, d = P[j], P[j + 1]
            if max(a[0], b[0]) < min(c[0], d[0]) or max(c[0], d[0]) < min(a[0], b[0]): continue
            if max(a[1], b[1]) < min(c[1], d[1]) or max(c[1], d[1]) < min(a[1], b[1]): continue
            rr = b - a; ss = d - c; den = rr[0]*ss[1] - rr[1]*ss[0]
            if abs(den) < 1e-12: continue
            t = ((c-a)[0]*ss[1] - (c-a)[1]*ss[0]) / den
            v = ((c-a)[0]*rr[1] - (c-a)[1]*rr[0]) / den
            if 0 <= t < 1 and 0 <= v < 1: out.append((i + t, j + v))
    return out


# ▼ 上下を決めます。
#
#   ① 結び目どうしの交わりは、切る前のつながった結び目で「上・下・上・下」と交互に決めます。
#      切ってから決めると、切り口のせいで順番がずれて、上が2回続くなどおかしくなるためです。
knot_crossings = crossings(P)
events = sorted([(x[0], k, 0) for k, x in enumerate(knot_crossings)] + [(x[1], k, 1) for k, x in enumerate(knot_crossings)])
# 各交わりは、最初に出会ったときに決めます（2回目は自動的に反対になる）
knot_over = {}
for idx, (_, k, which) in enumerate(events):
    if k not in knot_over:
        knot_over[k] = which if idx % 2 == 0 else 1 - which
# 上を通るほうの、結び目の中での位置（点の番号）
knot_over_at = [x[knot_over[k]] for k, x in enumerate(knot_crossings)]

#   ② 紐を端から端まで1本につなげます（切り口の部分は除く）。
#      抜けていく端 → 結び目 → 抜けていく端、の順です。
T0 = len(tails[0])
body = P[gap:-gap]
Q = np.r_[tails[0][::-1], body, tails[1]]
KNOT_START, KNOT_END = T0, T0 + len(body)


def in_knot(pos):
    return KNOT_START <= pos < KNOT_END


#   ③ 1本にした紐で、改めて交わりを探し、どちらが上かを決めます。
#        結び目 × 結び目  → ① で決めたとおり
#        結び目 × 抜けていく端 → 結び目が上（端は結び目の後ろを通る）
#        抜けていく端 × 抜けていく端 → 先に出会うほうが上
X = crossings(Q)
over = {}
for k, (pa, pb) in enumerate(X):
    if in_knot(pa) and in_knot(pb):
        # ① のどの交わりか、結び目の中の位置で探します
        ka, kb = pa - KNOT_START + gap, pb - KNOT_START + gap
        nearest = min(knot_over_at, key=lambda o: min(abs(o - ka), abs(o - kb)))
        over[k] = 0 if abs(nearest - ka) < abs(nearest - kb) else 1
    elif in_knot(pa):
        over[k] = 0
    elif in_knot(pb):
        over[k] = 1
    else:
        over[k] = 0

# ▼ 画面の座標へ（左上が 0,0 になるようにずらす）
PAD = 0.2
# 結び目の中心（原点）が、枠のちょうど真ん中に来るようにします。
# 枠を真ん中に置けば、結び目が画面のど真ん中に来ます。
# 抜けていく端は枠の外まで出して、そのまま画面の外へ消えていくようにします。
# 枠の大きさは結び目だけで決めます（曲がるところまで入れると、結び目が小さくなるため）。
# 曲がるところは結び目の下に来るので、縦長の画面なら枠の下にはみ出しても画面に収まります。
reach = np.abs(P).max() + PAD
minx, miny = -reach, -reach
W = H = reach * 2 * SCALE
S = (Q - [minx, miny]) * SCALE

# ▼ メンバーを並べる場所。
#   右へ伸びていく2本の紐の、枠の中に見えている部分のまん中
half_run = int(SHOW_TAIL * 200 * 0.15)
PILE = ((BOTTOM_RUNS[0][half_run] + BOTTOM_RUNS[1][half_run]) / 2 - [minx, miny]) * SCALE

# ▼ 交わるところの描き方。
#   紐を、交わるところ1つにつき1区間になるように区切ります
#   （区切りは、となりの交わりとのちょうど真ん中）。
#   区間は「その交わりで下を通る区間」と「上を通る区間」のどちらかになります。
#
#   画面では、下の区間を先に全部描いてから、上の区間を描きます。
#   上の区間には、紐より少し太い背景色のふちを付けます。
#   それが下の紐を少し消して、すき間になります。
#
#   区切りが交わりから遠いので、ふちの端が別の紐にかかることがありません。

STEP = 6
# 曲線でつなぐ点。全部の点を使うとファイルが大きくなるので、6個に1個にします
PTS = S[::STEP]
LAST = len(PTS) - 1


def path(a, b):
    """PTS[a] から PTS[b] までを、なめらかな曲線(C)の path にします。

    点を直線(L)でつなぐと、曲がりのきついところで角が出ます。
    ここでは Catmull-Rom という方法で、点と点のあいだを曲線でつなぎます。
    前後の点から「この点をどの向きに通るか」を決めるので、角ができません。

    区間どうしも、全体と同じ点・同じ計算で作るので、つなぎ目がずれません。
    """
    out = f"M{PTS[a][0]:.1f} {PTS[a][1]:.1f}"
    for i in range(a, b):
        p0 = PTS[max(i - 1, 0)]; p1 = PTS[i]; p2 = PTS[i + 1]; p3 = PTS[min(i + 2, LAST)]
        c1 = p1 + (p2 - p0) / 6
        c2 = p2 - (p3 - p1) / 6
        out += f" C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {p2[0]:.1f} {p2[1]:.1f}"
    return out


# 紐をたどったときに出会う交わりを、順番に並べたもの。
# 2つ目は「その場所でこちらの紐が上を通るか」
passes = sorted(
    (pos / STEP, over[k] == which) for k, x in enumerate(X) for which, pos in enumerate(x)
)

under_parts = []
over_parts = []
for n, (pos, is_over) in enumerate(passes):
    a = 0 if n == 0 else round((passes[n - 1][0] + pos) / 2)
    b = LAST if n == len(passes) - 1 else round((pos + passes[n + 1][0]) / 2)
    (over_parts if is_over else under_parts).append(path(a, b))

with open("lib/umeKnot.ts", "w", encoding="utf-8", newline="\n") as f:
    f.write("// scripts/ume_knot.py が作ったファイルです。手で書き換えないでください。\n")
    f.write("// 形を変えたいときは、スクリプトの数字を変えて作り直します。\n\n")
    f.write(f"export const UME_WIDTH = {W:.0f};\nexport const UME_HEIGHT = {H:.0f};\n\n")
    # 花びらの丸の中心。上の花びらから時計回りに並べます
    petals = sorted(turned_centers, key=lambda c: (np.arctan2(c[1], c[0]) + np.pi / 2) % (2 * np.pi))
    petals = [(c - [minx, miny]) * SCALE for c in petals]
    f.write("// 花びらの丸の中心（上の花びらから時計回り）。ここにメンバーのアイコンを置きます\n")
    f.write("export const UME_PETALS = [\n" + "".join(f"  [{x:.0f}, {y:.0f}],\n" for x, y in petals) + "];\n\n")
    f.write("// 花びらの丸の、内側の半径（アイコンの大きさを決めるのに使います）\n")
    f.write(f"export const UME_PETAL_INNER = {PETAL * SCALE - 11:.0f};\n\n")
    f.write("// 下を右へ伸びる2本の紐のあいだ。メンバーを並べる場所の目印です\n")
    f.write(f"export const UME_PILE_X = {PILE[0]:.0f};\nexport const UME_PILE_Y = {PILE[1]:.0f};\n\n")
    f.write("// 交わるところで下を通る区間\n")
    f.write('export const UME_UNDER =\n  "' + " ".join(under_parts) + '";\n\n')
    f.write("// 交わるところで上を通る区間（あとから、すき間のふちを付けて描く）\n")
    f.write('export const UME_OVER =\n  "' + " ".join(over_parts) + '";\n')
print(f"{W:.0f} x {H:.0f}, crossings {len(X)}")
