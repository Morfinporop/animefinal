import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Card, { CardRow, type CardData } from './Card';
import PlayPage from './PlayPage';
import Header from './Header';
import type { AnimeData, CommentData } from './types';
import { api } from './api';

const ALL_GENRES = ['all', 'Фэнтези', 'Драма', 'Боевик', 'Комедия'];

export default function HomePage() {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';

  const [genre, setGenre] = useState('all');
  const [view, setView] = useState<'grid' | 'rows'>('grid');
  const [selectedAnime, setSelectedAnime] = useState<AnimeData | null>(null);
  const [animeList, setAnimeList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const loadAnime = useCallback(async () => {
    try {
      const data = await api.getAnimeList();
      setAnimeList(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { loadAnime(); }, [loadAnime]);

  // Клик вне поиска — закрыть результаты
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSearchResults(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Загружаем аниме по id из роута
  useEffect(() => {
    if (routeId) {
      const id = parseInt(routeId, 10);
      if (!isNaN(id)) {
        api.getAnime(id).then((a) => {
          if (a) handleCardClick(buildCardFromAnime(a));
        }).catch(() => {});
      }
    } else {
      setSelectedAnime(null);
    }
  }, [routeId]);

  const buildCardFromAnime = (a: any): CardData => ({
    id: a.id || 0,
    title: a.title || 'Без названия',
    description: a.description || '',
    image: a.id ? api.getPosterUrl(a.id) : '',
    views: a.viewsCount || 0,
    rating: a.rating || 0,
    genres: Array.isArray(a.genres) ? a.genres : [],
  });

  const handleCardClick = useCallback((card: CardData) => {
    const animeData: AnimeData = {
      id: card.id || 0,
      title: card.title || 'Без названия',
      description: card.description || '',
      fullDescription: card.description || '',
      image: card.image || '',
      views: card.views || 0,
      rating: card.rating || 0,
      genres: Array.isArray(card.genres) ? card.genres : [],
      year: 2024,
      videoSrc: card.id ? api.getVideoUrl(card.id) : '',
      qualitySources: {},
      voiceovers: ['Оригинал'],
      comments: [],
    };
    setSelectedAnime(animeData);
    if (card.id) navigate(`/video/${card.id}`);
  }, [navigate]);

  const handleBack = useCallback(() => {
    setSelectedAnime(null);
    navigate('/');
    loadAnime();
  }, [navigate, loadAnime]);

  const handleUpdateRating = useCallback(async (animeId: number, rating: number) => {
    try { await api.rate(animeId, rating); } catch {}
  }, []);

  const handleAddView = useCallback(async () => {
    try { await api.addView(selectedAnime?.id || 0); } catch {}
  }, [selectedAnime]);

  const handleUpdateComments = useCallback((_animeId: number, _comments: CommentData[]) => {}, []);

  // Обработка поиска через URL (но без перезагрузки главной)
  const handleSearch = useCallback((query: string) => {
    if (query.trim()) {
      navigate(`/?q=${encodeURIComponent(query.trim())}`);
      setShowSearchResults(true);
    } else {
      navigate('/');
      setShowSearchResults(false);
    }
  }, [navigate]);

  const isSearching = searchQuery.trim().length > 0;
  const searchResults: CardData[] = isSearching ? animeList
    .filter((a: any) => {
      const q = searchQuery.toLowerCase();
      return a.title.toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q);
    })
    .map(buildCardFromAnime) : [];

  const displayList: CardData[] = isSearching ? searchResults : animeList.map(buildCardFromAnime).filter((c) => {
    if (genre === 'all') return true;
    return c.genres && c.genres.includes(genre);
  });

  if (selectedAnime) {
    return (
      <PlayPage
        data={selectedAnime}
        onBack={handleBack}
        onUpdateRating={(r) => handleUpdateRating(selectedAnime.id, r)}
        onAddView={handleAddView}
        onUpdateComments={(c) => handleUpdateComments(selectedAnime.id, c)}
      />
    );
  }

  return (
    <div>
      <Header onSearch={handleSearch} />

      <section className="relative overflow-hidden border-b border-zinc-200">
        <img src="https://avatanplus.com/files/resources/original/5cc1631bacf9316a536b243d.png" alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
        <div className="absolute inset-0 bg-black/50" />
        <div className="relative mx-auto max-w-[1400px] px-5 py-10 sm:px-8 sm:py-16">
          <h1 className="text-6xl font-bold text-white drop-shadow-lg sm:text-7xl lg:text-8xl">Аниме</h1>
          <p className="mt-3 max-w-xl text-sm text-white/90 sm:text-base leading-relaxed">Добро пожаловать в мир, где можно смотреть аниме любого жанра, типа и года. Мы создали этот большой, удобный, детально проработанный сборник, чтобы каждый зритель легко находил новые релизы, популярные многосерийные тайтлы и редкие ретро-картины для идеального вечернего просмотра.</p>
        </div>
      </section>

      {/* Результаты поиска — выпадающий список */}
      {isSearching && showSearchResults && (
        <div ref={searchRef} className="mx-auto max-w-[1400px] px-5 pt-4">
          <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-zinc-500">Найдено: {searchResults.length}</p>
              <button onClick={() => { navigate('/'); setShowSearchResults(false); }} className="text-xs text-zinc-500 hover:text-zinc-900">Закрыть поиск</button>
            </div>
            {searchResults.length === 0 ? (
              <p className="text-sm text-zinc-400 text-center py-4">Ничего не найдено</p>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {searchResults.map((c) => (
                  <div key={c.id} onClick={() => { handleCardClick(c); setShowSearchResults(false); }} className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-50 cursor-pointer">
                    <img src={c.image} alt="" className="h-14 w-10 object-cover rounded bg-zinc-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">{c.title}</p>
                      <p className="text-[11px] text-zinc-500 truncate">{c.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <section className="mx-auto max-w-[1400px] px-5 pb-12 sm:px-8 sm:pb-16">
        {!isSearching && (
          <div className="sticky top-12 z-20 mb-5 border-b border-zinc-200 bg-white/90 py-3 backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-2">
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 text-xs font-medium text-zinc-700">
                {ALL_GENRES.map((g) => <option key={g} value={g}>{g === 'all' ? 'Все жанры' : g}</option>)}
              </select>
              <div className="flex-1" />
              <div className="flex items-center gap-1 rounded-full border border-zinc-200 bg-white p-1">
                <button onClick={() => setView('grid')} className={`rounded-full p-1.5 ${view === 'grid' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`} aria-label="Карточки">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
                  </svg>
                </button>
                <button onClick={() => setView('rows')} className={`rounded-full p-1.5 ${view === 'rows' ? 'bg-zinc-900 text-white' : 'text-zinc-500'}`} aria-label="Полоски">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>
        ) : displayList.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-400 text-lg">{isSearching ? 'Ничего не найдено' : 'Пока ничего нет'}</p>
            <p className="text-zinc-400 text-sm mt-1">{isSearching ? 'Попробуйте другой запрос' : 'Администратор загрузит видео и оно появится'}</p>
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {displayList.map((v) => (
              <div key={v.id} onClick={() => handleCardClick(v)} className="cursor-pointer">
                <Card data={v} />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {displayList.map((v) => (
              <div key={v.id} onClick={() => handleCardClick(v)} className="cursor-pointer">
                <CardRow data={v} />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
