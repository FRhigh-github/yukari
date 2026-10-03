"use client";

import { useEffect, useEffectEvent, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isUuid } from "@/lib/isUuid";

type Message = {
  id: string;
  event_id?: string | null;
  user_id: string;
  content: string;
  created_at: string;
  user_name?: string;
};

export default function EventChatPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("チャット");
  const [loading, setLoading] = useState(true);
  // ?from=chats = ホームのチャット一覧から来たとき。戻るでその一覧へ帰します。
  // それ以外（日程調整の画面から来たとき）は、日程調整へ帰します
  const fromChats = useSearchParams().get("from") === "chats";
  const backHref = fromChats ? "/chats" : `/events/${rawId}`;
  // 日程の投票の集計（候補日ごとの〇△×の数）。チャットの上に小さく出します
  const [votes, setVotes] = useState<{ id: string; date: string; ok: number; maybe: number; ng: number }[]>([]);
  // 送れなかったときの知らせ。前はブラウザの alert でしたが、画面の中に出します
  const [errorText, setErrorText] = useState<string | null>(null);
  // 消すかどうかを確かめている、自分の発言の id（自分のふきだしを押すと出ます）
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const supabase = createClient();

  // ユーザーIDから表示名を取得するヘルパー関数
  const fetchUserName = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from("profiles")
      // 名前の列は display_name です（前は無い列を読んでいて、全員「メンバー」と出ていました）
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();

    return data?.display_name || "メンバー";
  };

  // ▼ 発言の取得。
  //   profiles(display_name) で、話した人の名前も一緒にもらいます（前は名前のためにもう1回取っていました）。
  //   多くなりすぎないよう、新しいものから200件までにして、画面では古い順に並べ直します
  const MESSAGE_LIMIT = 200;
  const loadMessages = (myId: string | null) =>
    supabase
      .from("messages")
      .select("id, event_id, user_id, content, created_at, profiles(display_name)")
      .eq("event_id", rawId)
      .order("created_at", { ascending: false })
      .limit(MESSAGE_LIMIT)
      .then(({ data, error }) => {
        if (error) {
          console.error("メッセージ取得エラー:", error.message);
          return;
        }
        const formatted = (data ?? [])
          .map((m) => ({
            id: m.id,
            event_id: m.event_id,
            user_id: m.user_id,
            content: m.content,
            created_at: m.created_at,
            user_name:
              m.user_id === myId
                ? "自分"
                : (m.profiles as unknown as { display_name: string | null } | null)?.display_name ||
                  "メンバー",
          }))
          .reverse();
        setMessages(formatted);
      });

  // ▼ useEffectEvent について（React 19.2 の機能）
  //   下の useEffect は「rawId が変わったときだけ」動かしたい処理です。
  //   ところが中で使う loadMessages などは、描き直すたびに作り直されるので、
  //   そのまま useEffect の依存に入れると、描き直すたびに読み直し・購読し直しになってしまいます。
  //   useEffectEvent で包んだ関数は依存に入れなくてよく、呼んだ時点の最新の中身で動きます。

  // 新しい発言が届いたとき（リアルタイム）に、名前を添えて一覧の最後に足します
  const handleNewMessage = useEffectEvent(async (newMsg: Message) => {
    const myId = currentUserIdRef.current;

    const senderName =
      newMsg.user_id === myId
        ? "自分"
        : await fetchUserName(newMsg.user_id);

    const msgWithName: Message = {
      ...newMsg,
      user_name: senderName,
    };

    setMessages((prev) => {
      if (prev.some((m) => m.id === msgWithName.id)) return prev;
      return [...prev, msgWithName];
    });
  });

  // 初期データ（ユーザー・イベント情報・過去ログ）の取得
  const initChat = useEffectEvent(async () => {
    if (!isUuid(rawId)) return;

    // ▼ 待ち時間を減らすため、お互いを必要としないものは同時に取ります。
    //   前は「本人確認 → イベント名 → 候補日 → 出欠 → 発言 → 名前」と6回続けて通信していました。
    //   本人確認（getClaims）は通信なしで済みます
    const { data: claims } = await supabase.auth.getClaims();
    const myId = claims?.claims.sub ?? null;
    setCurrentUserId(myId);
    currentUserIdRef.current = myId;

    const [{ data: eventData }, { data: options }, { data: responses }] = await Promise.all([
      supabase
        .from("events")
        // events の名前の列は name だけです（title という列は無く、前は読むのに失敗して「チャット」のままでした）
        .select("name")
        .eq("id", rawId)
        .maybeSingle(),
      supabase
        .from("event_date_options")
        .select("id, event_date")
        .eq("event_id", rawId)
        .order("event_date", { ascending: true }),
      // このイベントの候補日への答え（event_date_options!inner で、このイベントの分に絞ります）
      supabase
        .from("event_responses")
        .select("option_id, user_id, answer, event_date_options!inner(event_id)")
        .eq("event_date_options.event_id", rawId),
      // 発言は、答えを確かめているあいだに取り始めておきます
      loadMessages(myId),
    ]);

    if (eventData) {
      setEventTitle(eventData.name || "チャット");
    }

    // ▼ まだ日程の出欠に答えていない人は、先に答えてもらいます。
    //   候補日があって、自分の回答が1つも無いときだけ、答える画面へ移します（?answer=1）
    //   ついでに、候補日ごとの〇△×の数を数えて、チャットの上に出します
    if ((options ?? []).length > 0) {
      if (myId && !responses?.some((response) => response.user_id === myId)) {
        // from も一緒に渡して、答え終わって戻ってきたときにも、戻る先が変わらないようにします
        router.replace(`/events/${rawId}?answer=1${fromChats ? "&from=chats" : ""}`);
        return;
      }

      // answer は DB では yes / maybe / no で入っています
      const countOf = (optionId: string, answer: string) =>
        responses?.filter((r) => r.option_id === optionId && r.answer === answer).length ?? 0;
      setVotes(
        (options ?? []).map((option) => ({
          id: option.id,
          date: new Date(`${option.event_date}T00:00:00`).toLocaleDateString("ja-JP", {
            month: "numeric",
            day: "numeric",
            weekday: "short",
          }),
          ok: countOf(option.id, "yes"),
          maybe: countOf(option.id, "maybe"),
          ng: countOf(option.id, "no"),
        })),
      );
    }

    setLoading(false);
  });

  useEffect(() => {
    // id の形でなければ、問い合わせも購読もしません（lib/isUuid.ts）。
    // リアルタイムの絞り込み（filter）の文字にも埋め込むためです
    if (!isUuid(rawId)) return;

    // supabase の窓口は、ブラウザでは1つを使い回す作りなので、ここで呼んでも上の supabase と同じものです。
    // （上の supabase をそのまま使うと、useEffect の依存に入れる必要が出てくるため、ここで受け取り直しています）
    const client = createClient();

    // 1. チャンネル作成と購読を同期的に実行（非同期処理の待機による二重登録を回避）
    const channel = client
      .channel(`event_chat_${rawId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `event_id=eq.${rawId}`,
        },
        (payload) => {
          handleNewMessage(payload.new as Message);
        }
      )
      // ▼ 誰かが発言を消したら、こちらの画面からも消します。
      //   消えた行は id しか届かないので（中身は届きません）、絞り込みは付けずに id で探します
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          const removedId = (payload.old as { id?: string }).id;
          setMessages((prev) => prev.filter((message) => message.id !== removedId));
        }
      )
      .subscribe();

    // 2. 初期データの取得。
    //   async の関数を中で作って呼ぶ形にしているのは、
    //   取り終わってから画面を書き換える（=待ってから setState する）ことを React に伝えるためです
    const load = async () => {
      await initChat();
    };
    load();

    // 3. クリーンアップで確実にチャンネルを解除
    return () => {
      client.removeChannel(channel);
    };
  }, [rawId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 自分の発言を消します（DB の許可で、自分のもの以外は消えません）
  const handleDeleteMessage = async (messageId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .delete()
      .eq("id", messageId)
      .select("id");
    if (error || data?.length !== 1) {
      setErrorText("消せませんでした。もう一度お試しください");
      return;
    }
    setConfirmingId(null);
    setMessages((prev) => prev.filter((message) => message.id !== messageId));
  };

  // メッセージ送信処理
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !isUuid(rawId)) return;

    // getClaims = 本人確認。通信なしで済むので、送るまでの待ちが減ります
    const { data: claims } = await supabase.auth.getClaims();
    const senderId = claims?.claims.sub || currentUserId;

    if (!senderId) {
      setErrorText("ログインしてから、もう一度試してください");
      return;
    }

    const textToSend = inputText;
    setInputText("");

    const { data, error } = await supabase
      .from("messages")
      .insert({
        event_id: rawId,
        user_id: senderId,
        content: textToSend,
      })
      .select()
      .single();

    if (error) {
      console.error("メッセージ送信エラー:", error.message);
      setErrorText("送れませんでした");
      setInputText(textToSend);
    } else if (data) {
      setErrorText(null);
      const newMsgWithProfile: Message = {
        ...(data as Message),
        user_name: "自分",
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === newMsgWithProfile.id)) return prev;
        return [...prev, newMsgWithProfile];
      });
    }
  };

  // 読み込み中は、生成り色の無地だけにします（文字を出すと、一瞬だけ見えてちらつくため）
  if (loading) return <div className="h-full bg-[#faf9f6]" />;

  return (
    // h-full = 親の高さぴったり。この画面は下タブを出さないので（BottomNav.tsx）、
    // 入力欄を画面のいちばん下に置けます
    <div className="flex h-full flex-col bg-[#faf9f6]">
      {/* ▼ 上：戻る・イベント名 */}
      <header className="flex shrink-0 items-center gap-1 border-b border-kin/30 px-2 py-1">
        <Link href={backHref} aria-label="戻る" className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-stone-800">{eventTitle}</h1>
      </header>

      {/* ▼ 日程の投票を、ひと目で。候補日ごとの〇△×の数を横に並べます（多いときは横にスクロール）。
          右のカレンダーを押すと、答えるパネルが開いた日程調整の画面へ移ります */}
      {votes.length > 0 ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-kin/30 bg-white px-3 py-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
            {votes.map((vote) => (
              <span
                key={vote.id}
                className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#faf9f6] px-3 py-1 text-sm ring-1 ring-kin/30"
              >
                <span className="font-bold text-stone-700">{vote.date}</span>
                <span className="text-beni">〇{vote.ok}</span>
                <span className="text-kin">△{vote.maybe}</span>
                <span className="text-stone-400">×{vote.ng}</span>
              </span>
            ))}
          </div>
          <Link
            href={`/events/${rawId}?answer=1${fromChats ? "&from=chats" : ""}`}
            aria-label="投票する"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-beni text-white"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18" /><path d="M8 3v4" /><path d="M16 3v4" /></svg>
          </Link>
        </div>
      ) : null}

      {/* ▼ メッセージ */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messages.map((msg, index) => {
          const isMe = msg.user_id === currentUserId;

          // 日付が前のメッセージと変わったところに、日付の札を出します
          const currentDateStr = new Date(msg.created_at).toLocaleDateString("ja-JP", {
            month: "long",
            day: "numeric",
            weekday: "short",
          });
          const prevDateStr =
            index > 0
              ? new Date(messages[index - 1].created_at).toLocaleDateString("ja-JP", {
                  month: "long",
                  day: "numeric",
                  weekday: "short",
                })
              : null;
          const isNewDay = currentDateStr !== prevDateStr;

          return (
            <Fragment key={msg.id}>
              {isNewDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-full bg-white px-3 py-1 text-xs text-kin ring-1 ring-kin/40">
                    {currentDateStr}
                  </span>
                </div>
              )}

              <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                {!isMe && (
                  <span className="mb-1 ml-1 text-sm text-kin">{msg.user_name || "メンバー"}</span>
                )}
                {/* 自分のふきだしは紅、ほかの人は白に金のふち。
                    自分のふきだしを押すと、下に「消す」が出ます */}
                <div
                  onClick={isMe ? () => setConfirmingId(confirmingId === msg.id ? null : msg.id) : undefined}
                  className={`max-w-[78%] break-words rounded-2xl px-4 py-2 text-base ${
                    isMe
                      ? "cursor-pointer rounded-br-sm bg-beni text-white"
                      : "rounded-bl-sm bg-white text-stone-800 ring-1 ring-kin/30"
                  }`}
                >
                  {msg.content}
                </div>
                {isMe && confirmingId === msg.id ? (
                  <button
                    type="button"
                    onClick={() => handleDeleteMessage(msg.id)}
                    className="h-11 px-2 text-sm text-beni underline"
                  >
                    この発言を消す
                  </button>
                ) : null}
                <span className="mt-0.5 px-1 text-xs text-stone-400">
                  {new Date(msg.created_at).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </Fragment>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {errorText ? <p className="px-4 pb-1 text-center text-sm text-beni">{errorText}</p> : null}

      {/* ▼ 下：入力欄と送るボタン */}
      <form
        onSubmit={handleSendMessage}
        className="flex shrink-0 items-center gap-2 border-t border-kin/30 bg-white px-3 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
      >
        <input
          type="text"
          value={inputText}
          // 1回に送れるのは1,000文字まで（DB の上限と同じ。supabase/01_schema.sql の messages）
          maxLength={1000}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="メッセージ"
          className="h-11 min-w-0 flex-1 rounded-full bg-[#faf9f6] px-4 text-base ring-1 ring-kin/30 focus:outline-none focus:ring-kin"
        />
        {/* 送るボタンは紙飛行機の絵だけ。紅い丸で、押せる範囲は 44px */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          aria-label="送る"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-beni text-white disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-5 w-5"><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></svg>
        </button>
      </form>
    </div>
  );
}
