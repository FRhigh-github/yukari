"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Supabase の events テーブルの型定義
type EventDetail = {
  id: string;
  title?: string | null;
  community_id?: string | null;
};

// Supabase の event_date_options テーブルの型定義
type DateOption = {
  id: string;
  event_id: string;
  option_date?: string | null;
  date?: string | null;
};

// Supabase の event_responses テーブルの型定義
type EventResponse = {
  id: string;
  event_id: string;
  event_date_option_id: string;
  status: string; // 'ok' | 'maybe' | 'ng' など
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventDetail | null>(null);
  const [dateOptions, setDateOptions] = useState<DateOption[]>([]); // 候補日リスト
  const [responses, setResponses] = useState<EventResponse[]>([]); // 回答リスト
  const [loading, setLoading] = useState(true);

  // 回答モーダルの状態管理
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [myResponses, setMyResponses] = useState<{ [optionId: string]: string }>({});
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  // データの取得処理
  async function fetchEventData() {
    if (!eventId) return;

    // 1. events テーブルからイベント情報を取得
    const { data: eventData, error: eventError } = await supabase
      .from("events")
      .select("*")
      .eq("id", eventId)
      .maybeSingle();

    if (eventError) {
      console.error("イベント取得エラー:", eventError.message);
    } else if (eventData) {
      setEvent(eventData);

      // 2. event_date_options テーブルから候補日一覧を取得
      const { data: optionsData, error: optionsError } = await supabase
        .from("event_date_options")
        .select("*")
        .eq("event_id", eventId);

      if (optionsError) {
        console.error("候補日取得エラー:", optionsError.message);
      } else if (optionsData) {
        setDateOptions(optionsData);
      }

      // 3. event_responses テーブルから回答一覧を取得
      const { data: responsesData, error: responsesError } = await supabase
        .from("event_responses")
        .select("*")
        .eq("event_id", eventId);

      if (responsesError) {
        console.error("回答取得エラー:", responsesError.message);
      } else if (responsesData) {
        setResponses(responsesData);
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  // モーダルを開いたときの初期選択値を設定
  const handleOpenModal = () => {
    const initialMap: { [optionId: string]: string } = {};
    dateOptions.forEach((opt) => {
      const existing = responses.find((r) => r.event_date_option_id === opt.id);
      initialMap[opt.id] = existing ? existing.status : "ok";
    });
    setMyResponses(initialMap);
    setIsModalOpen(true);
  };

  // ステータス（〇 / △ / ✕）の切り替え処理
  const handleStatusChange = (optionId: string, status: string) => {
    setMyResponses((prev) => ({ ...prev, [optionId]: status }));
  };

  // 回答の保存処理
  const handleSaveResponses = async () => {
    setSaving(true);

    const updates = dateOptions.map((opt) => ({
      event_id: eventId,
      event_date_option_id: opt.id,
      status: myResponses[opt.id] || "ok",
    }));

    const { error } = await supabase
      .from("event_responses")
      .upsert(updates, { onConflict: "event_id, event_date_option_id" });

    if (error) {
      console.error("回答保存エラー:", error.message);
      alert("回答の保存に失敗しました。");
    } else {
      await fetchEventData();
      setIsModalOpen(false);
    }
    setSaving(false);
  };

  // チャット画面への遷移処理
  const handleGoToChat = () => {
    if (event?.community_id) {
      router.push(`/communities/${event.community_id}/chat`);
    } else {
      router.push(`/events/${eventId}/chat`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        イベント情報を読み込んでいます...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center max-w-sm mx-auto font-sans text-xs text-gray-500">
        イベントが見つかりませんでした。
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] p-4 flex flex-col justify-between max-w-sm mx-auto font-sans text-gray-800 relative">
      {/* 上部・メインエリア */}
      <div>
        {/* ヘッダー部分：イベント名表示 */}
        <div className="border-b pb-3 mb-4 flex items-center space-x-2 text-sm font-bold">
          <span>📅</span>
          <span>{event.title || "イベント名なし"}</span>
        </div>

        {/* イベント候補日一覧エリア */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-gray-600">イベント候補日</h2>

          {dateOptions.length === 0 ? (
            <p className="text-xs text-gray-400">候補日が登録されていません。</p>
          ) : (
            <div className="bg-white rounded-lg p-3 shadow-sm space-y-3 border border-gray-100">
              {dateOptions.map((option) => {
                const rawDate = option.option_date || option.date;
                const dateText = rawDate
                  ? new Date(rawDate).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    })
                  : "日程未定";

                const optionResponses = responses.filter(
                  (r) => r.event_date_option_id === option.id
                );
                const okCount = optionResponses.filter(
                  (r) => r.status === "ok" || r.status === "○"
                ).length;
                const maybeCount = optionResponses.filter(
                  (r) => r.status === "maybe" || r.status === "△"
                ).length;
                const ngCount = optionResponses.filter(
                  (r) => r.status === "ng" || r.status === "×"
                ).length;

                return (
                  <div
                    key={option.id}
                    className="flex justify-between items-center py-2 border-b border-gray-50 last:border-none text-xs"
                  >
                    <span className="font-medium text-gray-700">{dateText}</span>

                    <div className="flex items-center space-x-3 text-gray-500 text-[11px]">
                      <span>〇 {okCount}</span>
                      <span>△ {maybeCount}</span>
                      <span>✕ {ngCount}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 下部・ボタンエリア（設計図通り） */}
      <div className="mt-8 space-y-2 pt-4">
        <button
          type="button"
          onClick={handleOpenModal}
          className="w-full py-2.5 bg-gray-600 text-white text-xs font-bold rounded-md hover:bg-gray-700 transition"
        >
          回答を修正する
        </button>
        <button
          type="button"
          onClick={handleGoToChat}
          className="w-full py-2.5 bg-gray-700 text-white text-xs font-bold rounded-md hover:bg-gray-800 transition"
        >
          チャットで連絡
        </button>
      </div>

      {/* 回答入力用モーダルポップアップ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs space-y-4 shadow-lg">
            <h3 className="text-sm font-bold text-gray-800 border-b pb-2">
              出欠回答の入力
            </h3>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {dateOptions.map((option) => {
                const rawDate = option.option_date || option.date;
                const dateText = rawDate
                  ? new Date(rawDate).toLocaleDateString("ja-JP", {
                      month: "numeric",
                      day: "numeric",
                      weekday: "short",
                    })
                  : "日程未定";

                const currentStatus = myResponses[option.id] || "ok";

                return (
                  <div
                    key={option.id}
                    className="flex justify-between items-center text-xs py-1"
                  >
                    <span className="text-gray-700 font-medium">{dateText}</span>

                    <div className="flex space-x-1">
                      {[
                        { label: "〇", value: "ok" },
                        { label: "△", value: "maybe" },
                        { label: "✕", value: "ng" },
                      ].map((item) => (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => handleStatusChange(option.id, item.value)}
                          className={`px-2.5 py-1 rounded text-xs transition ${
                            currentStatus === item.value
                              ? "bg-gray-800 text-white font-bold"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-1/2 py-2 bg-gray-200 text-gray-700 text-xs font-medium rounded-md hover:bg-gray-300"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveResponses}
                disabled={saving}
                className="w-1/2 py-2 bg-amber-600 text-white text-xs font-bold rounded-md hover:bg-amber-700 transition disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}