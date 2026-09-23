"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type TimeCapsule = {
  id: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  open_at?: string | null;
  sealed_at?: string | null;
  event_id?: string | null;
  community_id?: string | null;
};

export default function LetterDetailPage() {
  const params = useParams();
  const initialLetterId = params.id as string;

  const [letters, setLetters] = useState<TimeCapsule[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  // 1. 全ての手紙を取得してリストを保持する
  useEffect(() => {
    async function fetchAllLetters() {
      const { data, error } = await supabase
        .from("time_capsules")
        .select("*")
        .order("open_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setLetters(data);
        // 最初はURLのIDと一致する手紙のインデックスをセット
        const foundIndex = data.findIndex((item) => item.id === initialLetterId);
        setCurrentIndex(foundIndex !== -1 ? foundIndex : 0);
      }
      setLoading(false);
    }

    fetchAllLetters();
  }, [initialLetterId]);

  // 2. 表示中の手紙が切り替わったら画像を取得する
  const currentLetter = letters[currentIndex];

  useEffect(() => {
    async function loadSignedImage() {
      setSignedImageUrl(null);
      if (!currentLetter?.image_url) return;

      if (
        currentLetter.image_url.startsWith("http://") ||
        currentLetter.image_url.startsWith("https://")
      ) {
        setSignedImageUrl(currentLetter.image_url);
      } else {
        // 画像のURLはサーバーに作ってもらいます（app/api/letter-image/route.ts）。
        // 前は time_capsules という置き場所を探していましたが、
        // 手紙の画像は drawings に保存されているので、見つからずに表示されていませんでした。
        // また drawings は、他人のフォルダをブラウザから直接読めない決まりにしてあります
        const response = await fetch(`/api/letter-image?id=${currentLetter.id}`);
        const result = await response.json();
        if (response.ok && result.url) {
          setSignedImageUrl(result.url);
        }
      }
    }

    if (currentLetter) {
      loadSignedImage();
    }
  }, [currentLetter]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        手紙を開いています...
      </div>
    );
  }

  if (!currentLetter) {
    return (
      <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        手紙が見つかりませんでした。
      </div>
    );
  }

  const displayTitle = currentLetter.title || "未来のあなたへ";
  const displayBody = currentLetter.body || "";
  const displayDate = currentLetter.open_at || "";

  // 紐づくイベントID、または手紙自身のIDを取得（community_idは除外）
  const targetId = currentLetter.event_id || currentLetter.id;

  return (
    <div className="min-h-screen bg-gray-200 p-4 flex flex-col justify-center max-w-sm mx-auto font-sans space-y-4">
      {/* 複数ある場合の件数カウント表示（例: 1 / 2通目） */}
      {letters.length > 1 && (
        <div className="text-center text-xs font-bold text-stone-500">
          {currentIndex + 1} / {letters.length} 通目の手紙
        </div>
      )}

      {/* 手紙の便箋エリア */}
      <div className="bg-[#FFFDF9] rounded-2xl p-6 shadow-md border border-amber-100 min-h-[360px] flex flex-col justify-between relative overflow-hidden">
        {/* 本文エリア */}
        <div className="space-y-6">
          <h1 className="text-base font-bold text-gray-800 border-b pb-2 border-amber-100">
            {displayTitle}
          </h1>

          {displayDate && (
            <div className="text-xs text-gray-500 font-medium">
              {new Date(displayDate).toLocaleDateString("ja-JP")} 頃
            </div>
          )}

          {/* 署名付きURLが取得できた場合のみ画像を表示 */}
          {signedImageUrl && (
            <div className="my-3 rounded-lg overflow-hidden">
              <img
                src={signedImageUrl}
                alt="タイムカプセルの画像"
                className="w-full h-auto object-cover rounded-md"
              />
            </div>
          )}

          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {displayBody}
          </p>
        </div>

        {/* IDが存在する場合の「日程調整へ進む」ボタン */}
        {targetId && (
          <div className="pt-6 flex justify-end z-10">
            <Link
              href={`/events/${targetId}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold shadow-md transition-colors"
            >
              <span>📅 日程調整へ進む</span>
              <span>➔</span>
            </Link>
          </div>
        )}

        {/* 封筒の下部グラフィック演出 */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-amber-100/40 pointer-events-none" />
      </div>

      {/* 複数通ある場合の「前へ」「次へ」切り替えナビゲーション */}
      {letters.length > 1 && (
        <div className="flex justify-between items-center px-2 pt-2">
          <button
            onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentIndex === 0}
            className="px-3 py-1.5 text-xs bg-white rounded-lg shadow-sm border border-stone-200 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-stone-700"
          >
            ← 前の手紙
          </button>
          <button
            onClick={() => setCurrentIndex((prev) => Math.min(letters.length - 1, prev + 1))}
            disabled={currentIndex === letters.length - 1}
            className="px-3 py-1.5 text-xs bg-white rounded-lg shadow-sm border border-stone-200 disabled:opacity-30 disabled:cursor-not-allowed font-medium text-stone-700"
          >
            次の手紙 →
          </button>
        </div>
      )}
    </div>
  );
}