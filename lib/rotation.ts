// 2本指で回した角度を、そろえる計算です。
// 未来への手紙（app/letter/page.tsx）とカード作り（components/CardComposer.tsx）で使います。

// 角度を -180〜180 に直し、まっすぐ（0度）や真横（90度）の近くでは、ぴたっと止めます。
// 指で少しだけ傾いてしまうのを防ぐためです。isStraight = ぴたっと止めたかどうか
export function snapRotation(value: number) {
  let rotation = ((((value + 180) % 360) + 360) % 360) - 180;
  let isStraight = false;
  for (const snap of [-180, -90, 0, 90, 180]) {
    if (Math.abs(rotation - snap) < 5) {
      rotation = snap;
      isStraight = true;
    }
  }
  return { rotation, isStraight };
}
