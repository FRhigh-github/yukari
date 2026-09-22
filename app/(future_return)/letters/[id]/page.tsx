"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase の time_capsules テーブルの実際のカラム名に合わせた型定義
type TimeCapsule = {
  id: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  open_at?: string | null;
  sealed_at?: string | null;
  event_id?: string | null;
};

export default function LetterDetailPage() {
  const params = useParams();
  const letterId = params.id as string;

  const [letter, setLetter] = useState<TimeCapsule | null>(null);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null); // 署名付き画像URLを入れる状態
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  useEffect(() => {
    async function fetchLetter() {
      if (!letterId) return;

      // URLのIDに一致するタイムカプセル(手紙)を1件取得
      const { data, error } = await supabase
        .from("time_capsules")
        .select("*")
        .eq("id", letterId)
        .maybeSingle(); // 該当データがなくてもエラーで止まらないよう安全に取得

      if (error) {
        console.error("タイムカプセル(手紙)の取得エラー:", error.message);
      } else if (data) {
        setLetter(data);

        // 画像が設定されている場合、非公開バケットから署名付きURLを発行
        if (data.image_url) {
          const { data: urlData, error: urlError } = await supabase.storage
            .from("time_capsules") // 正しいバケット名 (time_capsules) に修正
            .createSignedUrl(data.image_url, 3600); // 3600秒（1時間）有効なURLを作成

          if (urlError) {
            console.error("画像の署名付きURL発行エラー:", urlError.message);
          } else if (urlData) {
            setSignedImageUrl(urlData.signedUrl);
          }
        }
      }
      setLoading(false);
    }

    fetchLetter();
  }, [letterId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        手紙を開いています...
      </div>
    );
  }

  if (!letter) {
    return (
      <div className="min-h-screen bg-gray-200 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        手紙が見つかりませんでした。
      </div>
    );
  }

  // テーブルのカラム名（title, body, open_at）に合わせた表示データの準備
  const displayTitle = letter.title || "未来のあなたへ";
  const displayBody = letter.body || "";
  const displayDate = letter.open_at || "";

  return (
    <div className="min-h-screen bg-gray-200 p-4 flex flex-col justify-center max-w-sm mx-auto font-sans">
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

        {/* イベントがある場合の「予定調整へ」リンク */}
        {letter.event_id && (
          <div className="pt-6 flex justify-end">
            <Link
              href={`/events/${letter.event_id}`}
              className="text-xs text-gray-600 border-b border-gray-400 pb-0.5 hover:text-black flex items-center space-x-1"
            >
              <span>予定調整へ</span>
              <span>➔</span>
            </Link>
          </div>
        )}

        {/* 封筒の下部グラフィック演出 */}
        <div className="absolute bottom-0 left-0 right-0 h-3 bg-amber-100/40 pointer-events-none" />
      </div>
    </div>
  );
}