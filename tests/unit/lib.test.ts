// 画面に関係しない、小さな関数のテストです。
import { describe, expect, it } from "vitest";
import { isUuid } from "@/lib/isUuid";
import { snapRotation } from "@/lib/rotation";
import { avatarPathFromUrl, newAvatarPath } from "@/lib/avatarFile";

describe("isUuid", () => {
  it("DB の id の形だけを通す", () => {
    expect(isUuid("0d6b1f8e-1111-4222-8333-444455556666")).toBe(true);
    expect(isUuid("x,capsule_id.eq.y")).toBe(false);
    expect(isUuid(123)).toBe(false);
  });
});

describe("snapRotation", () => {
  it("まっすぐ・真横の近くでぴたっと止まる", () => {
    expect(snapRotation(3)).toEqual({ rotation: 0, isStraight: true });
    expect(snapRotation(88)).toEqual({ rotation: 90, isStraight: true });
    expect(snapRotation(30)).toEqual({ rotation: 30, isStraight: false });
  });
  it("-180〜180 に直す", () => {
    expect(snapRotation(270).rotation).toBe(-90);
    expect(snapRotation(-200).rotation).toBe(160);
  });
});

describe("avatarFile", () => {
  it("ランダムな名前を作り、URL から場所を取り出せる", () => {
    const path = newAvatarPath("user-id");
    expect(path).toMatch(/^user-id\/[0-9a-f-]{36}\.jpg$/);
    const url = `https://x.supabase.co/storage/v1/object/public/avatars/${path}?t=1`;
    expect(avatarPathFromUrl(url)).toBe(path);
    expect(avatarPathFromUrl("https://lh3.googleusercontent.com/a")).toBeNull();
  });
});
