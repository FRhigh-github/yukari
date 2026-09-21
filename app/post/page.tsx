"use client";

<<<<<<< Updated upstream
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Community = {
  id: string;
  name: string;
};

=======
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DUMMY_COMMUNITY_ID = "00000000-0000-0000-0000-000000000000";

// 表示で使う投稿データの型（C言語の構造体のようなものです）
>>>>>>> Stashed changes
type PostItem = {
  id: string;
  title: string;
  body: string | null;
<<<<<<< Updated upstream
  imageUrl: string | null;
=======
  imageUrl: string | null; // 署名付きURLを入れる変数
>>>>>>> Stashed changes
};

export default function PostPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
<<<<<<< Updated upstream
  const [posts, setPosts] = useState<PostItem[]>([]);

  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState<string>("");

  useEffect(() => {
    fetchCommunities();
    fetchPosts();
  }, []);

  const fetchCommunities = async () => {
    const supabase = createClient();
    const { data, error } = await supabase.from("communities").select("id, name");
    if (error || !data) return;

    setCommunities(data);
    if (data.length > 0) {
      setSelectedCommunityId(data[0].id);
    }
  };

  const fetchPosts = async () => {
    const supabase = createClient();
=======

  // 取得した投稿一覧を覚えておく配列
  const [posts, setPosts] = useState<PostItem[]>([]);

  // 投稿一覧を取得する関数
  const fetchPosts = async () => {
    const supabase = createClient();

    // 1. posts テーブルから投稿データを取得
>>>>>>> Stashed changes
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false });

<<<<<<< Updated upstream
    if (error || !data) return;

    const postList: PostItem[] = [];
    for (const post of data) {
      let signedUrl: string | null = null;
      if (post.image_url) {
        const { data: urlData } = await supabase.storage
          .from("posts")
          .createSignedUrl(post.image_url, 3600);
        if (urlData) signedUrl = urlData.signedUrl;
      }
=======
    if (error || !data) {
      alert("投稿の取得に失敗しました: " + error?.message);
      return;
    }

    // 2. 各投稿の画像に対して「署名付きURL」を発行する
    const postList: PostItem[] = [];

    for (const post of data) {
      let signedUrl: string | null = null;

      // 画像パス（image_url）が保存されていれば、閲覧用URLを発行する
      if (post.image_url) {
        const { data: urlData } = await supabase.storage
          .from("posts")
          .createSignedUrl(post.image_url, 3600); // 3600秒（1時間）有効

        if (urlData) {
          signedUrl = urlData.signedUrl;
        }
      }

>>>>>>> Stashed changes
      postList.push({
        id: post.id,
        title: post.title,
        body: post.body,
        imageUrl: signedUrl,
      });
    }
<<<<<<< Updated upstream
    setPosts(postList);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommunityId) {
      alert("投稿先のコミュニティを選択してください");
      return;
    }

    const supabase = createClient();
=======

    setPosts(postList);
  };

  // 送信処理
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabase = createClient();

>>>>>>> Stashed changes
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert("ログインしていません");
      return;
    }

    let imagePath: string | null = null;
<<<<<<< Updated upstream
=======

>>>>>>> Stashed changes
    if (imageFile) {
      const filePath = `${Date.now()}_${imageFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("posts")
        .upload(filePath, imageFile);

      if (uploadError) {
        alert("画像のアップロードに失敗しました: " + uploadError.message);
        return;
      }
      imagePath = uploadData.path;
    }

    const { error: insertError } = await supabase.from("posts").insert({
      title: title,
      body: body,
      image_url: imagePath,
      author_id: user.id,
<<<<<<< Updated upstream
      community_id: selectedCommunityId,
=======
      community_id: DUMMY_COMMUNITY_ID,
>>>>>>> Stashed changes
    });

    if (insertError) {
      alert("投稿の保存に失敗しました: " + insertError.message);
      return;
    }

    alert("投稿が完了しました！");
    setTitle("");
    setBody("");
    setImageFile(null);
<<<<<<< Updated upstream
=======

    // 投稿成功後、最新の一覧を取得して更新する
>>>>>>> Stashed changes
    fetchPosts();
  };

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen bg-gray-300 p-4 pb-20 max-w-sm mx-auto flex flex-col justify-between">
      <form onSubmit={handleSubmit} className="space-y-3">
        
        {/* 1. コミュニティ選択プルダウン（グレーのカプセル型） */}
        <div className="relative">
          <select
            className="w-full bg-gray-500 text-white font-medium py-2.5 px-4 rounded-full text-center appearance-none cursor-pointer focus:outline-none"
            value={selectedCommunityId}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
          >
            {communities.length === 0 && (
              <option value="">報告するコミュニティーを選択</option>
            )}
            {communities.map((c) => (
              <option key={c.id} value={c.id} className="text-black">
                {c.name}
              </option>
            ))}
          </select>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white pointer-events-none text-xs">
            ▼
          </span>
        </div>

        {/* 2. 画像添付エリア（大きな白いカード） */}
        <label className="block w-full bg-white rounded-3xl h-64 flex flex-col items-center justify-center cursor-pointer shadow-sm relative overflow-hidden">
          <input
            type="file"
            accept="image/*"
            className="hidden"
=======
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">新しい報告を投稿する</h1>

      {/* 投稿フォーム */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル</label>
          <input
            type="text"
            className="w-full border p-2 rounded"
            placeholder="例：今日の進捗"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">本文</label>
          <textarea
            className="w-full border p-2 rounded h-24"
            placeholder="報告内容を入力してください"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">画像</label>
          <input
            type="file"
            accept="image/*"
>>>>>>> Stashed changes
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setImageFile(e.target.files[0]);
              }
            }}
          />
<<<<<<< Updated upstream
          {imageFile ? (
            /* 選択済み画像のプレビュー表示 */
            <img
              src={URL.createObjectURL(imageFile)}
              alt="Preview"
              className="w-full h-full object-cover"
            />
          ) : (
            /* 未選択時の「＋ 画像を添付」アイコン */
            <div className="flex flex-col items-center text-gray-800 space-y-2">
              <div className="w-12 h-12 rounded-full border-2 border-black flex items-center justify-center text-2xl font-light">
                ＋
              </div>
              <span className="text-sm font-medium">画像を添付</span>
            </div>
          )}
        </label>

        {/* 3. タイトル入力欄 */}
        <input
          type="text"
          className="w-full bg-white rounded-2xl py-3.5 px-4 text-center text-gray-700 placeholder-gray-400 focus:outline-none shadow-sm"
          placeholder="タイトルを入力"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        {/* 4. 本文入力欄 */}
        <textarea
          className="w-full bg-white rounded-2xl p-4 text-center text-gray-700 placeholder-gray-400 focus:outline-none shadow-sm h-28 resize-none"
          placeholder="本文を入力"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />

        {/* 5. 送信ボタン（右下の黒カプセル型） */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="bg-neutral-800 text-white font-bold py-2.5 px-6 rounded-full flex items-center space-x-2 shadow-md hover:bg-black transition-colors"
          >
            <span>ご報告</span>
            <svg
              className="w-4 h-4 transform rotate-45"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </div>
      </form>

      
      
=======
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded font-bold"
        >
          送信する
        </button>
      </form>

      <hr className="my-6" />

      {/* 一覧読み込みボタン */}
      <button
        onClick={fetchPosts}
        className="w-full bg-gray-200 text-gray-800 py-2 rounded font-medium"
      >
        投稿一覧を読み込む / 更新
      </button>

      {/* 投稿一覧の表示（.map を使用） */}
      <div className="space-y-4">
        {posts.map((post) => (
          <div key={post.id} className="border p-4 rounded shadow-sm space-y-2">
            <h2 className="font-bold text-lg">{post.title}</h2>
            {post.body && <p className="text-gray-700">{post.body}</p>}
            {post.imageUrl && (
              <img
                src={post.imageUrl}
                alt={post.title}
                className="w-full h-auto rounded border"
              />
            )}
          </div>
        ))}
      </div>
>>>>>>> Stashed changes
    </div>
  );
}