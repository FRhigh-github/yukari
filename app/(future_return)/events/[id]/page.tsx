"use client";

import { useEffect, useEffectEvent, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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

// 〇△× の印と色。〇は紅、△は金、×は灰色（アプリの水引の色にそろえています）
const ANSWER_MARK: Record<ResponseStatus, string> = { ok: "〇", maybe: "△", ng: "×" };
const ANSWER_COLOR: Record<ResponseStatus, string> = {
  ok: "text-beni",
  maybe: "text-kin",
  ng: "text-stone-400",
};

// "2030-04-01" を「4月1日(月)」の形にします。年が今年でなければ年も付けます
function formatDate(text?: string) {
  if (!text) return "日時未設定";
  const date = new Date(`${text.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return text;
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("ja-JP", {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

// 戻るの絵（ほかの画面と同じ、左向きの線）
const BackIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
);

export default function EventDetailPage() {
  const params = useParams();
  const rawId = params.id as string;
  const router = useRouter();
  // ?answer=1 = チャットを開こうとしたけれど、まだ出欠を答えていない人。
  // 答えるパネルを開いた状態から始めて、保存したらそのままチャットへ進みます（chat/page.tsx）
  const searchParams = useSearchParams();
  const mustAnswer = searchParams.get("answer") === "1";
  // チャット一覧から来た流れを、チャットへ戻るときにも引き継ぎます
  const fromChats = searchParams.get("from") === "chats";

  const [event, setEvent] = useState<EventData | null>(null);
  const [memberResponses, setMemberResponses] = useState<MemberResponse[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(mustAnswer);
  const [myResponses, setMyResponses] = useState<Record<string, ResponseStatus>>({});
  const [myComment, setMyComment] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // うまくいかなかったときの知らせ。前はブラウザの alert で出していましたが、
  // 画面が止まって見た目もアプリと合わないので、画面の中に出します
  const [errorText, setErrorText] = useState<string | null>(null);

  const supabase = createClient();

  const fetchEventData = async () => {
    if (!rawId) return;
    // (前はここで setLoading(true) にしていましたが、保存のあとに取り直すたびに
    //  画面が一瞬まっさらになっていたので外しました。最初の読み込み中は、はじめから true です)

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
            // 名前の列は display_name です（前は無い列を読んでいて、全員「メンバー」と出ていました）
            .select("id, display_name")
            .in("id", userIds);

          profileMap = new Map(
            (profilesData || []).map((p) => [p.id, p.display_name || "メンバー"])
          );
        }

        const userMap: Record<string, MemberResponse> = {};
        const myRespMap: Record<string, ResponseStatus> = {};
        let currentUserComment = "";

        responsesData.forEach((row) => {
          const uId = row.user_id || "unknown";
          const uName = uId === myId ? "自分" : profileMap.get(uId) || "メンバー";

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

  // 画面を開いたとき（とURLのidが変わったとき）に取りに行きます。
  //
  // ▼ useEffectEvent について（React 19.2 の機能）
  //   fetchEventData は描き直すたびに作り直されるので、そのまま useEffect の依存に入れると、
  //   描き直すたびに取りに行ってしまいます。useEffectEvent で包んだ関数は依存に入れなくてよく、
  //   rawId が変わったときだけ動き、中では最新の fetchEventData を使えます。
  const loadEvent = useEffectEvent(async () => {
    await fetchEventData();
  });

  // async の関数を中で作って呼ぶ形にしているのは、
  // 取り終わってから画面を書き換える（=待ってから setState する）ことを React に伝えるためです
  useEffect(() => {
    const load = async () => {
      await loadEvent();
    };
    load();
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

    const newConfirmedId = event.confirmed_option_id === optionId ? null : optionId;

    const { error } = await supabase
      .from("events")
      .update({ confirmed_option_id: newConfirmedId })
      .eq("id", event.id);

    if (error) {
      setErrorText("日程を決められませんでした");
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
      setErrorText("ログインしてから、もう一度試してください");
      return;
    }

    setSaving(true);

    try {
      const payload =
        event?.event_date_options.map((opt) => ({
          option_id: opt.id,
          user_id: userId,
          answer: myResponses[opt.id] ? toDbAnswer(myResponses[opt.id]) : null,
          // comment の列は「空っぽ(null)を入れられない」決まりなので、書いていないときは "" にします。
          // 前は null を送っていて、コメントなしで保存すると失敗していました
          comment: myComment.trim(),
          responded_at: new Date().toISOString(),
        })) || [];

      const validPayload = payload.filter((item) => item.answer !== null || item.comment !== "");

      if (validPayload.length > 0) {
        const { error } = await supabase
          .from("event_responses")
          .upsert(validPayload, { onConflict: "option_id,user_id" });

        if (error) {
          console.error("保存失敗エラー:", error);
          setErrorText("保存できませんでした");
        } else {
          setErrorText(null);
          await fetchEventData();
          setIsModalOpen(false);
          // チャットから来た人は、答え終わったらチャットへ
          if (mustAnswer) router.push(`/events/${rawId}/chat${fromChats ? "?from=chats" : ""}`);
        }
      } else {
        setErrorText("〇△× を選んでください");
      }
    } catch (err) {
      console.error("予期せぬエラー:", err);
      setErrorText("保存できませんでした");
    } finally {
      setSaving(false);
    }
  };

  // 読み込み中は、生成り色の無地だけにします（文字を出すと、一瞬だけ見えてちらつくため）
  if (loading) return <div className="h-full bg-[#faf9f6]" />;

  if (!event) {
    return (
      <div className="flex h-full flex-col bg-[#faf9f6]">
        <header className="flex items-center px-2 pt-2">
          <Link href={`/letters/${rawId}`} aria-label="戻る" className="flex h-11 w-11 items-center justify-center text-stone-700">
            {BackIcon}
          </Link>
        </header>
        <p className="py-20 text-center text-base text-stone-500">イベントが見つかりませんでした</p>
      </div>
    );
  }

  const eventTitle = event.name || event.title || "イベント";
  const isHost = !event.created_by || event.created_by === currentUserId;

  // 戻り先となる手紙（capsule）のIDを確定
  const letterId = event.capsule_id || rawId;

  return (
    // h-full = 親の高さぴったり。前は画面の高さで作っていて、下タブと重なっていました
    <div className="min-h-full bg-[#faf9f6] pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      {/* ▼ 上：戻る・イベント名・チャット */}
      <header className="sticky top-0 z-10 flex items-center gap-1 border-b border-kin/30 bg-[#faf9f6]/90 px-2 py-1 backdrop-blur">
        <Link href={`/letters/${letterId}`} aria-label="手紙へ戻る" className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-700">
          {BackIcon}
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-stone-800">{eventTitle}</h1>
        {/* チャット。絵文字ではなく、ふきだしの線の絵にしています */}
        <Link href={`/events/${event.id}/chat`} aria-label="チャット" className="flex h-11 w-11 shrink-0 items-center justify-center text-kin">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>
        </Link>
      </header>

      <div className="space-y-4 p-4">
        {event.description ? (
          <p className="text-base leading-relaxed text-stone-600">{event.description}</p>
        ) : null}

        {/* ▼ 候補日ごとの出欠。1日1枚のカードにして、横に長い表でスクロールしなくて済むようにしています */}
        <ul className="space-y-3">
          {event.event_date_options.map((opt) => {
            const counts = getSummaryCounts(opt.id);
            const isConfirmed = event.confirmed_option_id === opt.id;

            return (
              <li
                key={opt.id}
                className={`rounded-2xl bg-white p-4 ring-1 ${
                  isConfirmed ? "ring-2 ring-beni" : "ring-kin/30"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-lg font-bold text-stone-800">
                    {formatDate(opt.possible_date || opt.event_date || opt.date)}
                  </span>
                  {/* 集計。〇は紅、△は金、×は灰色 */}
                  <span className="flex items-center gap-2 text-base font-bold">
                    <span className="text-beni">〇{counts.ok}</span>
                    <span className="text-kin">△{counts.maybe}</span>
                    <span className="text-stone-400">×{counts.ng}</span>
                  </span>
                </div>

                {/* だれが〇△× か。名前の横に印を並べます */}
                {memberResponses.some((m) => m.responses[opt.id]) ? (
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                    {memberResponses
                      .filter((m) => m.responses[opt.id])
                      .map((m) => (
                        <span key={m.user_id} className="text-sm text-stone-600">
                          <span className={ANSWER_COLOR[m.responses[opt.id]]}>
                            {ANSWER_MARK[m.responses[opt.id]]}
                          </span>{" "}
                          {m.user_name}
                        </span>
                      ))}
                  </div>
                ) : null}

                {/* 作った人だけ、日程を決められます。決めた日は紅い枠と「決定」になります */}
                {isHost ? (
                  <button
                    type="button"
                    onClick={() => handleConfirmDate(opt.id)}
                    className={`mt-3 h-11 w-full rounded-xl text-sm font-bold ${
                      isConfirmed ? "bg-beni text-white" : "border border-kin/60 text-kin"
                    }`}
                  >
                    {isConfirmed ? "決定（押すと取り消し）" : "この日に決める"}
                  </button>
                ) : isConfirmed ? (
                  <p className="mt-3 text-center text-sm font-bold text-beni">この日に決まりました</p>
                ) : null}
              </li>
            );
          })}
        </ul>

        {/* ▼ ひとことコメント */}
        {memberResponses.some((m) => m.comment && m.comment.trim() !== "") && (
          <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-kin/30">
            {memberResponses
              .filter((m) => m.comment && m.comment.trim() !== "")
              .map((m) => (
                <p key={m.user_id} className="text-base text-stone-700">
                  <span className="mr-2 font-bold text-kin">{m.user_name}</span>
                  {m.comment}
                </p>
              ))}
          </div>
        )}

        {errorText ? <p className="text-center text-sm text-beni">{errorText}</p> : null}

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="h-12 w-full rounded-full bg-beni text-base font-bold text-white ring-1 ring-kin ring-offset-2 ring-offset-[#faf9f6]"
        >
          出欠を答える
        </button>
      </div>

      {/* ▼ 出欠を答えるパネル。下から出ます。
          absolute = アプリの枠の中だけに重ねます。z-50 = 下タブより手前 */}
      {isModalOpen && (
        <div
          className="absolute inset-0 z-50 flex items-end bg-black/30"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="max-h-[85%] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-[#fdfbf5] p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-2">
              {event.event_date_options.map((opt) => (
                <div key={opt.id} className="flex items-center justify-between border-b border-kin/20 pb-2">
                  <span className="text-base text-stone-800">
                    {formatDate(opt.possible_date || opt.event_date || opt.date)}
                  </span>
                  <div className="flex gap-1">
                    {(["ok", "maybe", "ng"] as ResponseStatus[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => handleSelectStatus(opt.id, st)}
                        aria-label={st === "ok" ? "行ける" : st === "maybe" ? "たぶん" : "行けない"}
                        className={`h-11 w-11 rounded-xl text-lg font-bold ${
                          myResponses[opt.id] === st
                            ? st === "ok"
                              ? "bg-beni text-white"
                              : st === "maybe"
                                ? "bg-kin text-white"
                                : "bg-stone-500 text-white"
                            : "bg-white text-stone-400 ring-1 ring-stone-200"
                        }`}
                      >
                        {ANSWER_MARK[st]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <input
              type="text"
              value={myComment}
              onChange={(e) => setMyComment(e.target.value)}
              placeholder="ひとこと"
              className="h-12 w-full rounded-xl border border-kin/40 bg-white px-4 text-base focus:border-kin focus:outline-none"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="h-12 flex-1 rounded-xl border border-stone-300 bg-white text-sm text-stone-600"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={handleSaveResponses}
                disabled={saving}
                className="h-12 flex-[2] rounded-xl bg-beni text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
