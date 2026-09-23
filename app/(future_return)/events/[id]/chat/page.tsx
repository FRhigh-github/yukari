"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
  const rawId = params.id as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [eventTitle, setEventTitle] = useState<string>("チャット");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const supabase = createClient();

  // ユーザーIDから表示名を取得するヘルパー関数
  const fetchUserName = async (userId: string): Promise<string> => {
    const { data } = await supabase
      .from("profiles")
      .select("name, username")
      .eq("id", userId)
      .maybeSingle();

    return data?.name || data?.username || "メンバー";
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
      const userIds = Array.from(new Set(msgData.map((m: any) => m.user_id)));
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", userIds);

      const profileMap = new Map<string, string>(
        (profilesData || []).map((p) => [p.id, p.name || p.username || "メンバー"])
      );

      const formatted = msgData.map((m: any) => ({
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
        .select("title, name")
        .eq("id", rawId)
        .maybeSingle();

      if (eventData) {
        setEventTitle(eventData.title || eventData.name || "イベントチャット");
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
      alert("ログイン情報が確認できません。再度ログインしてください。");
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
      alert(`メッセージの送信に失敗しました: ${error.message}`);
      setInputText(textToSend);
    } else if (data) {
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] p-4 flex items-center justify-center max-w-sm mx-auto text-xs text-gray-500 font-sans">
        チャットを読み込み中...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFBF7] max-w-sm mx-auto font-sans flex flex-col h-screen border-x border-gray-100">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <Link href={`/events/${rawId}`} className="text-xs text-gray-500 font-bold hover:underline">
          ＜ イベント詳細
        </Link>
        <h1 className="text-xs font-bold text-gray-800 truncate max-w-[180px]">
          💬 {eventTitle}
        </h1>
        <div className="w-12"></div>
      </div>

      {/* メッセージ表示領域 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-xs text-gray-400 py-10">
            まだメッセージはありません。<br />最初のメッセージを送ってみましょう！
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.user_id === currentUserId;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                {!isMe && (
                  <span className="text-[10px] text-gray-500 mb-1 ml-1 font-medium">
                    {msg.user_name || "メンバー"}
                  </span>
                )}
                <div
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-xs break-words ${
                    isMe
                      ? "bg-amber-600 text-white rounded-br-none"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-none shadow-sm"
                  }`}
                >
                  {msg.content}
                </div>
                <span className="text-[9px] text-gray-400 mt-0.5 px-1">
                  {new Date(msg.created_at).toLocaleTimeString("ja-JP", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 送信フォーム */}
      <form onSubmit={handleSendMessage} className="p-3 bg-white border-t flex gap-2 items-center mb-16">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 bg-gray-100 text-xs px-3 py-2 rounded-full focus:outline-none focus:ring-1 focus:ring-amber-500"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-full disabled:opacity-40 transition"
        >
          送信
        </button>
      </form>
    </div>
  );
}