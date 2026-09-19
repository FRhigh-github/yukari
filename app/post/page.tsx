'use client'  // ブラウザ側で動く宣言。クリックや入力を扱うなら必要

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// 本来は画面で選ばせる。今は動作確認のため固定
const COMMUNITY_ID = 'dfda40cd-2953-45b0-8620-26f03b9d7c58'

export default function PostPage() {
  // [今の値, 変える関数] = useState(初期値)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')

  // ボタンが押されたら実行される
  const handleSubmit = async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // posts に1行追加。左が列名、右が入れる値
    await supabase.from('posts').insert({
      title: title,
      body: text,
      author_id: user.id,
      community_id: COMMUNITY_ID,
    })
  }

  return (
    <main className="p-6">
      {/* value と onChange はセット。片方だけだと打てない */}
      <input value={title} onChange={(e) => setTitle(e.target.value)} />
      <textarea value={text} onChange={(e) => setText(e.target.value)} />

      {/* handleSubmit() と書かない。開いた瞬間に実行されてしまう */}
      <button onClick={handleSubmit}>報告する</button>
    </main>
  )
}