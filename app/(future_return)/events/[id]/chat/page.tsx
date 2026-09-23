"use client";

import { useEffect, useState, useRef, Fragment } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
  // 送れなかったときの知らせ。前はブラウザの alert でしたが、画面の中に出します
  const [errorText, setErrorText] = useState<string | null>(null);
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

  // メッセージ取得用関数
  const fetchMessages = async (myId: string | null) => {
    if (!rawId) return;

    const { data: msgData, error } = await supabase
      .from("messages")
      .select("*")
      .eq("event_id", rawId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("メッセージ取得エラー:", error.message);
      return;
    }

    if (msgData && msgData.length > 0) {
      const userIds = Array.from(new Set(msgData.map((m: Message) => m.user_id)));
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", userIds);

      const profileMap = new Map<string, string>(
        (profilesData || []).map((p) => [p.id, p.display_name || "メンバー"])
      );

      const formatted = msgData.map((m: Message) => ({
        ...m,
        user_name: m.user_id === myId ? "自分" : profileMap.get(m.user_id) || "メンバー",
      }));

      setMessages(formatted);
    } else {
      setMessages([]);
    }
  };

  useEffect(() => {
    if (!rawId) return;

    // 1. チャンネル作成と購読を同期的に実行（非同期処理の待機による二重登録を回避）
    const channel = supabase
      .channel(`event_chat_${rawId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `event_id=eq.${rawId}`,
        },
        async (payload) => {
          const newMsg = payload.new as Message;
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
        }
      )
      .subscribe();

    // 2. 初期データ（ユーザー・イベント情報・過去ログ）の取得
    const initChat = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const myId = user?.id || null;
      setCurrentUserId(myId);
      currentUserIdRef.current = myId;

      const { data: eventData } = await supabase
        .from("events")
        // events の名前の列は name だけです（title という列は無く、前は読むのに失敗して「チャット」のままでした）
        .select("name")
        .eq("id", rawId)
        .maybeSingle();

      if (eventData) {
        setEventTitle(eventData.name || "チャット");
      }

      // ▼ まだ日程の出欠に答えていない人は、先に答えてもらいます。
      //   候補日があって、自分の回答が1つも無いときだけ、答える画面へ移します（?answer=1）
      if (myId) {
        const { data: options } = await supabase
          .from("event_date_options")
          .select("id")
          .eq("event_id", rawId);
        const optionIds = options?.map((option) => option.id) ?? [];
        if (optionIds.length > 0) {
          const { count } = await supabase
            .from("event_responses")
            .select("option_id", { count: "exact", head: true })
            .eq("user_id", myId)
            .in("option_id", optionIds);
          if (count === 0) {
            router.replace(`/events/${rawId}?answer=1`);
            return;
          }
        }
      }

      await fetchMessages(myId);
      setLoading(false);
    };

    initChat();

    // 3. クリーンアップで確実にチャンネルを解除
    return () => {
      supabase.removeChannel(channel);
    };
  }, [rawId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // メッセージ送信処理
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !rawId) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const senderId = user?.id || currentUserId;

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
        <Link href={`/events/${rawId}`} aria-label="戻る" className="flex h-11 w-11 shrink-0 items-center justify-center text-stone-700">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-7 w-7"><path d="M15 5l-7 7 7 7" /></svg>
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-lg font-bold text-stone-800">{eventTitle}</h1>
      </header>

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
                {/* 自分のふきだしは紅、ほかの人は白に金のふち */}
                <div
                  className={`max-w-[78%] break-words rounded-2xl px-4 py-2 text-base ${
                    isMe
                      ? "rounded-br-sm bg-beni text-white"
                      : "rounded-bl-sm bg-white text-stone-800 ring-1 ring-kin/30"
                  }`}
                >
                  {msg.content}
                </div>
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
