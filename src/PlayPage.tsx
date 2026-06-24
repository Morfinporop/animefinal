import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, Send, Star, Trash2 } from 'lucide-react';
import VideoPlayer from './VideoPlayer';
import Header from './Header';
import type { AnimeData, CommentData } from './types';
import { useUser } from './UserContext';
import { useNotify } from './NotifyContext';
import { api } from './api';

const formatViews = (n: number) => {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M просмотров';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K просмотров';
  return n + ' просмотров';
};

function UserRating({ rating, onRate, disabled }: { rating: number | null; onRate: (r: number) => void; disabled: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center gap-0.5" onMouseLeave={() => setHovered(0)}>
      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
        const filled = hovered ? n <= hovered : rating ? n <= rating : false;
        return (
          <button key={n} onClick={() => { if (!disabled) onRate(n); }} onMouseEnter={() => { if (!disabled) setHovered(n); }} className={`transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
            <Star className={`h-5 w-5 sm:h-6 sm:w-6 ${filled ? 'fill-yellow-400 text-yellow-400' : 'text-zinc-300 hover:text-yellow-300'}`} />
          </button>
        );
      })}
      <span className="ml-1.5 text-sm font-semibold text-zinc-500">{hovered ? `${hovered}/10` : rating ? `${rating}/10` : ''}</span>
    </div>
  );
}

function CommentItem({ comment, onDelete, canDelete }: { comment: CommentData; onDelete: (id: number) => void; canDelete: boolean }) {
  return (
    <div className="border-b border-zinc-100 pb-3 last:border-0">
      <div className="flex items-start gap-2">
        <div className="h-9 w-9 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: comment.avatarColor || '#d4d4d8' }}>
          {comment.author?.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-zinc-800">{comment.author}</span>
            <span className="text-[11px] text-zinc-400">{comment.date}</span>
            {canDelete && (
              <button onClick={() => onDelete(comment.id)} className="ml-auto text-zinc-300 hover:text-red-500 transition-colors" title="Удалить">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-sm text-zinc-600">{comment.text}</p>
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: AnimeData;
  onBack: () => void;
  onUpdateRating: (r: number) => void;
  onAddView: () => void;
  onUpdateComments: (comments: CommentData[]) => void;
}

export default function PlayPage({ data, onAddView }: Props) {
  const { user } = useUser();
  const notify = useNotify();
  const loggedIn = !!user;

  const [showFullDescription, setShowFullDescription] = useState(false);
  const [userRating, setUserRating] = useState<number | null>(null);
  const [displayRating, setDisplayRating] = useState(0);
  const [likesCount, setLikesCount] = useState(0);
  const [dislikesCount, setDislikesCount] = useState(0);
  const [userVote, setUserVote] = useState<0 | 1 | -1>(0);
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  // Загружаем данные при входе/смене anime
  useEffect(() => {
    let cancelled = false;
    setUserRating(null);
    setUserVote(0);
    setLikesCount(0);
    setDislikesCount(0);
    setDisplayRating(0);

    api.getComments(data.id).then(c => { if (!cancelled) setComments(c); }).catch(() => {});

    if (loggedIn && user) {
      api.getVotes(data.id).then(v => {
        if (cancelled) return;
        setLikesCount(v.likes || 0);
        setDislikesCount(v.dislikes || 0);
        setUserVote((v.userVote as 0 | 1 | -1) || 0);
      }).catch(() => {});
      api.getRating(data.id).then(r => {
        if (cancelled) return;
        if (r.userScore) setUserRating(r.userScore);
        if (r.average) setDisplayRating(Number(r.average.toFixed(1)));
      }).catch(() => {});
    }
    return () => { cancelled = true; };
  }, [data.id, loggedIn, user]);

  // Сброс при выходе
  useEffect(() => {
    if (!user) { setUserRating(null); setUserVote(0); }
  }, [user]);

  const shortDesc = data.description.length > 150 ? data.description.slice(0, 150) + '...' : data.description;

  const handleRate = async (r: number) => {
    if (!loggedIn) { notify.error('Войдите чтобы оценить'); return; }
    setUserRating(r); setDisplayRating(r);
    try {
      const res = await api.rate(data.id, r);
      if (res.average) setDisplayRating(Number(res.average.toFixed(1)));
      notify.success('Оценка сохранена');
    } catch (err: any) { notify.error(err.message); }
  };

  const handleVote = async (newVote: 1 | -1) => {
    if (!loggedIn) { notify.error('Войдите чтобы оценить'); return; }
    const finalVote = userVote === newVote ? 0 : newVote;
    // Оптимистичное обновление UI
    setUserVote(finalVote);
    setLikesCount(prev => {
      if (finalVote === 1 && userVote !== 1) return prev + 1;
      if (userVote === 1 && finalVote !== 1) return prev - 1;
      return prev;
    });
    setDislikesCount(prev => {
      if (finalVote === -1 && userVote !== -1) return prev + 1;
      if (userVote === -1 && finalVote !== -1) return prev - 1;
      return prev;
    });
    try {
      const res = await api.vote(data.id, finalVote);
      setLikesCount(res.likes || 0);
      setDislikesCount(res.dislikes || 0);
    } catch (err: any) { notify.error(err.message); }
  };

  const handleAddComment = async () => {
    if (!loggedIn) { notify.error('Войдите чтобы комментировать'); return; }
    if (!newCommentText.trim()) return;
    try {
      const newComment = await api.addComment(data.id, newCommentText.trim());
      setComments((prev) => [newComment, ...prev]);
      setNewCommentText('');
      notify.success('Комментарий добавлен');
    } catch (err: any) { notify.error(err.message || 'Ошибка'); }
  };

  const handleDeleteComment = async (id: number) => {
    try {
      await api.deleteComment(id);
      setComments((prev) => prev.filter(c => c.id !== id));
      notify.success('Комментарий удалён');
    } catch (err: any) { notify.error(err.message); }
  };

  return (
    <div className="min-h-screen bg-zinc-50">
      <Header />

      <div className="mx-auto max-w-[1600px]">
        <VideoPlayer videoSrc={data.videoSrc} poster={data.image} title={data.title} onEnded={onAddView} />

        <div className="px-4 pb-12 sm:px-6">
          <div className="mt-4">
            <h1 className="text-2xl font-bold text-zinc-900 sm:text-3xl">{data.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.genres?.map((g) => (
                <span key={g} className="rounded-full bg-zinc-200/70 px-2.5 py-0.5 text-xs font-medium text-zinc-700">{g}</span>
              ))}
              <span className="text-sm text-zinc-500">{formatViews(data.views || 0)}</span>
              <span className="text-sm font-semibold text-zinc-800">★ {displayRating > 0 ? `${displayRating}/10` : '—'}</span>
            </div>

            {data.description && (
              <div className="mt-4">
                <p className="text-sm text-zinc-600 leading-relaxed">{showFullDescription ? data.description : shortDesc}</p>
                {data.description.length > 150 && (
                  <button onClick={() => setShowFullDescription(!showFullDescription)} className="mt-1 text-sm font-medium text-zinc-500 hover:text-zinc-800">
                    {showFullDescription ? 'Скрыть' : 'Показать полностью'}
                  </button>
                )}
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-zinc-800 mb-2">Ваша оценка</h3>
                <UserRating rating={userRating} onRate={handleRate} disabled={!loggedIn} />
                {!loggedIn && <p className="text-[11px] text-zinc-400 mt-1">Войдите чтобы оценить</p>}
              </div>
              <div className="rounded-xl border border-zinc-200 bg-white p-4">
                <h3 className="text-sm font-semibold text-zinc-800 mb-2">Лайк / Дизлайк</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleVote(1)} disabled={!loggedIn} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${userVote === 1 ? 'bg-emerald-500 text-white' : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                    <ThumbsUp className={`h-3.5 w-3.5 ${userVote === 1 ? 'fill-white' : ''}`} />
                    {likesCount}
                  </button>
                  <button onClick={() => handleVote(-1)} disabled={!loggedIn} className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${userVote === -1 ? 'bg-red-500 text-white' : 'border border-zinc-200 text-zinc-700 hover:bg-zinc-50'}`}>
                    <ThumbsDown className={`h-3.5 w-3.5 ${userVote === -1 ? 'fill-white' : ''}`} />
                    {dislikesCount}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <h2 className="text-lg font-bold text-zinc-900">Комментарии ({comments.length})</h2>
            <div className="mt-3 flex items-center gap-2">
              <input type="text" value={newCommentText} onChange={(e) => setNewCommentText(e.target.value)} placeholder={loggedIn ? 'Оставить комментарий...' : 'Войдите чтобы комментировать'} disabled={!loggedIn} className="flex-1 rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm outline-none focus:border-zinc-400 disabled:opacity-50" onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment(); }} />
              <button onClick={handleAddComment} disabled={!loggedIn || !newCommentText.trim()} className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-40"><Send className="h-4 w-4" /></button>
            </div>

            <div className="mt-4 space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
              {comments.length === 0 ? (
                <p className="text-sm text-zinc-400 text-center py-4">Пока нет комментариев</p>
              ) : (
                comments.map((c) => <CommentItem key={c.id} comment={c} onDelete={handleDeleteComment} canDelete={!!user?.isAdmin} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
