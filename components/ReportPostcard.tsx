// 「ご報告のはがき」1枚ぶんの見た目です。
//
// 結婚や出産の報告は、もともとはがきや手紙の文化なので、ご報告はこの形で見せます。
// 同じ見た目を、次の3か所で使います（どこで見ても同じはがきに見えるように）。
//   ・ご報告を見る画面（StoryViewer）……… size="full"
//   ・ご報告を書くときのお試し（PostForm）… size="full"
//   ・プロフィールなどの一覧（PostGrid / MemberPosts）… size="tile"（小さい1枚）
//
// 押す・スワイプなどの操作は持っていません。見た目だけの部品です。

type ReportPostcardProps = {
  title: string;
  body?: string | null;
  // いつのご報告か。書いている途中（まだ無い）ときは null で、今日の日付を出します
  createdAt: string | null;
  imageUrl: string | null;
  // 右下に「〇〇より」と出す名前。一覧（tile）では出しません
  authorName?: string | null;
  size: "full" | "tile";
};

// 「2026年9月18日」の形。はがきらしく、数字だけの形（2026/9/18）は使いません
function formatDate(createdAt: string | null) {
  return new Date(createdAt ?? Date.now()).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    // サーバーで描いても日本の日付にするため（サーバーの時計は世界標準時）
    timeZone: "Asia/Tokyo",
  });
}

export default function ReportPostcard({
  title,
  body,
  createdAt,
  imageUrl,
  authorName,
  size,
}: ReportPostcardProps) {
  // ▼ 一覧の1枚（小さいはがき）。写真・タイトル・日付だけにします
  if (size === "tile") {
    return (
      <div className="h-full rounded-sm bg-white p-2 pb-3 shadow-sm ring-1 ring-kin/40">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            draggable={false}
            loading="lazy"
            className="aspect-[4/5] w-full rounded-sm object-cover"
          />
        ) : (
          // 写真の無いご報告は、タイトルを紙の真ん中に大きく置きます
          <div className="flex aspect-[4/5] w-full items-center justify-center rounded-sm bg-[#fdfbf5] p-3">
            <p className="line-clamp-4 text-center text-lg font-bold text-stone-800">{title}</p>
          </div>
        )}
        {imageUrl ? (
          <p className="mt-2 line-clamp-2 text-base font-bold leading-snug text-stone-800">
            {title}
          </p>
        ) : null}
        <p className="mt-1 text-xs text-kin">{formatDate(createdAt)}</p>
      </div>
    );
  }

  // ▼ 大きいはがき。親の高さいっぱいに広がり、写真が余った場所を全部使います。
  //   文字は削らず、はがきが画面に収まらないときは写真のほうを縮めます
  return (
    <article className="flex h-full w-full flex-col overflow-hidden rounded-sm bg-white p-5 shadow-lg ring-1 ring-kin/50">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          draggable={false}
          fetchPriority="high"
          // flex-1 + min-h-0 = 文字を置いたあとの残りの高さを、写真が全部使います
          className="mb-4 min-h-0 w-full flex-1 rounded-sm object-cover"
        />
      ) : null}

      {/* 写真の無いご報告は、文字だけのはがきとして、紙の真ん中に大きく置きます */}
      <div className={imageUrl ? "shrink-0" : "flex flex-1 flex-col justify-center text-center"}>
        <h2 className={`font-bold text-stone-800 ${imageUrl ? "text-3xl" : "text-4xl"}`}>
          {title || "タイトル"}
        </h2>
        <p className="mt-1 text-base text-kin">{formatDate(createdAt)}</p>
        {body ? (
          <p
            className={`mt-4 whitespace-pre-wrap text-lg leading-loose text-stone-700 ${
              imageUrl ? "line-clamp-6" : ""
            }`}
          >
            {body}
          </p>
        ) : null}
      </div>

      {/* 右下に、書いた人の名前を「〇〇より」と添えます */}
      {authorName ? (
        <p className="mt-4 shrink-0 text-right text-base text-stone-500">{authorName}より</p>
      ) : null}
    </article>
  );
}
