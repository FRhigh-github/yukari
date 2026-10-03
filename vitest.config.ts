// テスト（npm test）の設定です。
//
//   tests/unit … 画面に関係しない小さな関数のテスト
//   tests/db   … DB の許可（RLS）のテスト。本物の Supabase は使わず、
//                手元で動く Postgres（PGlite）に supabase/ の SQL を流して確かめます
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // server-only は「ブラウザ側で読み込んだらエラー」の印です。テストではただの空にします
      "server-only": fileURLToPath(new URL("./tests/empty.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // DB のテストは Postgres を立ち上げるので、少し時間がかかります
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
