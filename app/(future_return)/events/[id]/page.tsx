"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type DateOption = {
  id: string;
  possible_date?: string;
  event_date?: string;
  date?: string;
};

type EventData = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  created_by?: string;
  confirmed_option_id?: string | null;
  capsule_id?: string | null;
  event_date_options: DateOption[];
};

type ResponseStatus = "ok" | "maybe" | "ng";

type MemberResponse = {
  user_id: string;
  user_name: string;
  comment?: string | null;
  responses: Record<string, ResponseStatus>;
};

// DBのEnum型 (yes, maybe, no) への変換
const toDbAnswer = (status: ResponseStatus): string => {
  if (status === "ok") return "yes";
  if (status === "maybe") return "maybe";
  if (status === "ng") return "no";
  return status;
};

// DBからの表記を画面のステータス (ok, maybe, ng) に正規化
const normalizeAnswer = (ans?: string | null): ResponseStatus | null => {
  if (!ans) return null;
  const lower = ans.toLowerCase();
  if (["yes", "ok", "○", "〇", "attendance", "attending"].includes(lower)) return "ok";
  if (["maybe", "△"].includes(lower)) return "maybe";
  if (["no", "ng", "×", "absence", "absent"].includes(lower)) return "ng";
  return null;
};

export default function EventDetailPage() {
  const params = useParams();
  const rawId = params.id as string;

  const [event, setEvent] = useState<EventData | null>(null);
  const [memberResponses, setMemberResponses] = useState<MemberResponse[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [myResponses, setMyResponses] = useState<Record<string, ResponseStatus>>({});
  const [myComment, setMyComment] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const fetchEventData = async () => {
    if (!rawId) return;
    setLoading(true);

    // 1. ユーザー情報取得
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const myId = user?.id || null;
    setCurrentUserId(myId);

    // 2. イベント本体の取得
    const { data: eventData, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .or(`id.eq.${rawId},capsule_id.eq.${rawId}`)
      .maybeSingle();

    if (eventErr) console.error("イベント取得エラー:", eventErr);

    if (!eventData) {
      setLoading(false);
      setEvent(null);
      return;
    }

    const targetEventId = eventData.id;

    // 3. 日時候補の取得
    const { data: dateOptions, error: optErr } = await supabase
      .from("event_date_options")
      .select("*")
      .eq("event_id", targetEventId);

    if (optErr) console.error("日時候補取得エラー:", optErr);

    setEvent({
      ...eventData,
      event_date_options: dateOptions || [],
    });

    // 4. 回答一覧およびコメントの取得
    const optionIds = (dateOptions || []).map((opt: DateOption) => opt.id);
    if (optionIds.length > 0) {
      const { data: responsesData, error: respErr } = await supabase
        .from("event_responses")
        .select("option_id, user_id, answer, comment")
        .in("option_id", optionIds);

      if (respErr) console.error("回答データ取得エラー:", respErr);

      if (responsesData && responsesData.length > 0) {
        const userIds = Array.from(new Set(responsesData.map((r) => r.user_id)));

        let profileMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, name, username")
            .in("id", userIds);

          profileMap = new Map(
            (profilesData || []).map((p) => [p.id, p.name || p.username || "メンバー"])
          );
        }

        const userMap: Record<string, MemberResponse> = {};
        const myRespMap: Record<string, ResponseStatus> = {};
        let currentUserComment = "";

        responsesData.forEach((row: any) => {
          const uId = row.user_id || "unknown";
          let uName = uId === myId ? "自分" : profileMap.get(uId) || "メンバー";

          if (!userMap[uId]) {
            userMap[uId] = {
              user_id: uId,
              user_name: uName,
              comment: null,
              responses: {},
            };
          }

          if (row.comment && row.comment.trim() !== "") {
            userMap[uId].comment = row.comment;
          }

          const normAns = normalizeAnswer(row.answer);
          if (normAns) {
            userMap[uId].responses[row.option_id] = normAns;
          }

          if (uId === myId) {
            if (normAns) myRespMap[row.option_id] = normAns;
            if (row.comment) currentUserComment = row.comment;
          }
        });

        setMemberResponses(Object.values(userMap));
        setMyResponses(myRespMap);
        setMyComment(currentUserComment);
      } else {
        setMemberResponses([]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchEventData();
  }, [rawId]);

  // 1. 候補日ごとの〇△×集計計算
  const getSummaryCounts = (optionId: string) => {
    let ok = 0,
      maybe = 0,
      ng = 0;
    memberResponses.forEach((m) => {
      const res = m.responses[optionId];
      if (res === "ok") ok++;
      else if (res === "maybe") maybe++;
      else if (res === "ng") ng++;
    });
    return { ok, maybe, ng };
  };

  // 2. イベント日程の確定（主催者機能）
  const handleConfirmDate = async (optionId: string) => {
    if (!event) return;
    if (!confirm("この日程で確定しますか？")) return;

    const newConfirmedId = event.confirmed_option_id === optionId ? null : optionId;

    const { error } = await supabase
      .from("events")
      .update({ confirmed_option_id: newConfirmedId })
      .eq("id", event.id);

    if (error) {
      alert(`確定処理に失敗しました: ${error.message}`);
    } else {
      setEvent((prev) => (prev ? { ...prev, confirmed_option_id: newConfirmedId } : null));
    }
  };

  const handleSelectStatus = (optionId: string, status: ResponseStatus) => {
    setMyResponses((prev) => ({ ...prev, [optionId]: status }));
  };

  // 回答保存処理
  const handleSaveResponses = async () => {
    let userId = currentUserId;
    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id || null;
      if (userId) setCurrentUserId(userId);
    }

    if (!userId) {
      alert("ログイン情報が取得できませんでした。ログイン後に再度お試しください。");
      return;
    }

    setSaving(true);

    try {
      const payload =
        event?.event_date_options.map((opt) => ({
          option_id: opt.id,
          user_id: userId,
          answer: myResponses[opt.id] ? toDbAnswer(myResponses[opt.id]) : null,
          comment: myComment.trim() !== "" ? myComment : null,
          responded_at: new Date().toISOString(),
        })) || [];

      const validPayload = payload.filter((item) => item.answer !== null || item.comment !== null);

      if (validPayload.length > 0) {
        const { error } = await supabase
          .from("event_responses")
          .upsert(validPayload, { onConflict: "option_id,user_id" });

        if (error) {
          console.error("保存失敗エラー:", error);
          alert(`保存に失敗しました: ${error.message}`);
        } else {
          await fetchEventData();
          setIsModalOpen(false);
        }
      } else {
        alert("出欠（〇△×）またはコメントを入力してください。");
      }
    } catch (err: any) {
      console.error("予期せぬエラー:", err);
      alert("保存中にエラーが発生しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-xs text-gray-400">読み込み中...</div>;

  // 💡 イベントが見つからなかった場合にも「＜ 戻る」ボタンを表示
  if (!event) {
    return (
      <div className="min-h-screen bg-[#F7F5F0] max-w-sm mx-auto p-4 font-sans pb-20">
        <div className="flex items-center justify-between mb-4">
          <Link href={`/letters/${rawId}`} className="text-gray-500 text-xs">
            ＜ 戻る
          </Link>
        </div>
        <div className="bg-white rounded-2xl p-8 text-center text-xs text-gray-400 shadow-sm">
          イベントが見つかりませんでした。
        </div>
      </div>
    );
  }

  const eventTitle = event.name || event.title || "イベント詳細";
  const isHost = !event.created_by || event.created_by === currentUserId;

  // 戻り先となる手紙（capsule）のIDを確定
  const letterId = event.capsule_id || rawId;

  return (
    <div className="min-h-screen bg-[#F7F5F0] max-w-sm mx-auto p-4 font-sans pb-20">
      <div className="flex items-center justify-between mb-4">
        {/* 戻るボタンの遷移先を letters ページに変更 */}
        <Link href={`/letters/${letterId}`} className="text-gray-500 text-xs">
          ＜ 戻る
        </Link>
        <h1 className="text-xs font-bold text-gray-700 truncate">{eventTitle}</h1>
        <Link href={`/events/${event.id}/chat`} className="text-xs text-blue-600 font-bold">💬 チャット</Link>
      </div>

      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4">
        <h2 className="text-sm font-bold text-gray-800 mb-1">{eventTitle}</h2>
        <p className="text-xs text-gray-500">{event.description || "日程の調整をお願いします！"}</p>
      </div>

      {/* 回答一覧 ＆ 集計 ＆ 日程確定機能 */}
      <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 overflow-x-auto">
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-xs font-bold text-gray-700">回答一覧</h3>
          <span className="text-[10px] text-gray-400">回答人数: {memberResponses.length}名</span>
        </div>

        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr className="border-b border-gray-100 text-gray-400">
              <th className="py-2 text-left font-normal">候補日</th>
              <th className="py-2 px-1 font-normal text-gray-400">集計</th>
              {memberResponses.map((m) => (
                <th key={m.user_id} className="py-2 px-1 font-bold text-gray-600 min-w-[36px] truncate">
                  {m.user_name}
                </th>
              ))}
              {isHost && <th className="py-2 px-1 font-normal text-gray-400">確定</th>}
            </tr>
          </thead>
          <tbody>
            {event.event_date_options.map((opt) => {
              const dateText = opt.possible_date || opt.event_date || opt.date || "日時未設定";
              const counts = getSummaryCounts(opt.id);
              const isConfirmed = event.confirmed_option_id === opt.id;

              return (
                <tr
                  key={opt.id}
                  className={`border-b border-gray-50 ${
                    isConfirmed ? "bg-amber-50/60 font-medium" : ""
                  }`}
                >
                  <td className="py-2.5 text-left text-gray-700 whitespace-nowrap">
                    {dateText}
                    {isConfirmed && (
                      <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] rounded-full font-bold">
                        確定
                      </span>
                    )}
                  </td>

                  <td className="py-2.5 px-1 text-[10px] whitespace-nowrap">
                    <span className="text-green-600 font-bold">〇{counts.ok}</span>{" "}
                    <span className="text-yellow-600 font-bold">△{counts.maybe}</span>{" "}
                    <span className="text-red-500 font-bold">×{counts.ng}</span>
                  </td>

                  {memberResponses.map((m) => {
                    const ans = m.responses[opt.id];
                    return (
                      <td key={m.user_id} className="py-2.5 px-1">
                        {ans === "ok" && <span className="text-green-500 font-bold">〇</span>}
                        {ans === "maybe" && <span className="text-yellow-500 font-bold">△</span>}
                        {ans === "ng" && <span className="text-red-500 font-bold">×</span>}
                        {!ans && <span className="text-gray-300">-</span>}
                      </td>
                    );
                  })}

                  {isHost && (
                    <td className="py-2.5 px-1">
                      <button
                        onClick={() => handleConfirmDate(opt.id)}
                        className={`text-[10px] px-2 py-0.5 rounded-lg border font-bold ${
                          isConfirmed
                            ? "bg-amber-500 text-white border-amber-500"
                            : "bg-gray-50 text-gray-500 border-gray-200"
                        }`}
                      >
                        {isConfirmed ? "確定解除" : "確定"}
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {memberResponses.some((m) => m.comment && m.comment.trim() !== "") && (
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
            <p className="text-[11px] font-bold text-gray-600">💬 コメント</p>
            <div className="space-y-1.5">
              {memberResponses
                .filter((m) => m.comment && m.comment.trim() !== "")
                .map((m) => (
                  <div key={m.user_id} className="text-xs bg-gray-50 p-2 rounded-lg">
                    <span className="font-bold text-gray-700 mr-1.5">{m.user_name}:</span>
                    <span className="text-gray-600">{m.comment}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full mt-4 bg-neutral-800 text-white text-xs font-bold py-2.5 rounded-xl shadow-sm"
        >
          自分の回答を入力・修正する
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 w-full max-w-xs shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-gray-800">出欠の回答</h3>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {event.event_date_options.map((opt) => {
                const dateText = opt.possible_date || opt.event_date || opt.date || "日時未設定";
                return (
                  <div key={opt.id} className="flex items-center justify-between border-b pb-2">
                    <span className="text-xs text-gray-700">{dateText}</span>
                    <div className="flex space-x-1">
                      {(["ok", "maybe", "ng"] as ResponseStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleSelectStatus(opt.id, st)}
                          className={`px-2.5 py-1 text-xs rounded-lg font-bold border ${
                            myResponses[opt.id] === st
                              ? st === "ok"
                                ? "bg-green-500 text-white border-green-500"
                                : st === "maybe"
                                ? "bg-yellow-500 text-white border-yellow-500"
                                : "bg-red-500 text-white border-red-500"
                              : "bg-gray-50 text-gray-500 border-gray-200"
                          }`}
                        >
                          {st === "ok" ? "〇" : st === "maybe" ? "△" : "×"}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">コメント（任意）</label>
              <input
                type="text"
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
                placeholder="例: 遅れる可能性があります"
                className="w-full text-xs border border-gray-200 rounded-lg p-2 focus:outline-none focus:border-gray-400"
              />
            </div>

            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 bg-gray-100 text-gray-600 text-xs py-2 rounded-xl font-bold"
              >
                キャンセル
              </button>
              <button
                onClick={handleSaveResponses}
                disabled={saving}
                className="flex-1 bg-neutral-800 text-white text-xs py-2 rounded-xl font-bold"
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