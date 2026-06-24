import { useState, useRef } from 'react';
import { Eye, EyeOff, X, LogOut, Search as SearchIcon } from 'lucide-react';
import { useUser } from './UserContext';
import { useNotify } from './NotifyContext';
import UploadPage from './UploadPage';
import AdminPage from './AdminPage';

function LoginModal({ onClose, onSwitchToRegister }: { onClose: () => void; onSwitchToRegister: () => void }) {
  const { login } = useUser();
  const notify = useNotify();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!nickname.trim() || !password.trim()) { notify.error('Заполните никнейм и пароль'); return; }
    const ok = await login(nickname.trim(), password);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        <h2 className="text-lg font-bold text-zinc-900">Войти</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Войдите в существующий аккаунт</p>
        <div className="mt-4 space-y-3">
          <div><label className="text-xs font-medium text-zinc-600">Никнейм</label><input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Введите никнейм" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" /></div>
          <div><label className="text-xs font-medium text-zinc-600">Пароль</label><div className="relative mt-1"><input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        </div>
        <button onClick={handleLogin} disabled={!nickname.trim() || !password.trim()} className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">Войти</button>
        <p className="mt-3 text-center text-xs text-zinc-400">Нет аккаунта? <button onClick={onSwitchToRegister} className="text-zinc-900 font-semibold hover:underline">Зарегистрироваться</button></p>
      </div>
    </div>
  );
}

function RegisterModal({ onClose, onSwitchToLogin }: { onClose: () => void; onSwitchToLogin: () => void }) {
  const { login } = useUser();
  const notify = useNotify();
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleRegister = async () => {
    if (!nickname.trim() || !password.trim()) { notify.error('Заполните никнейм и пароль'); return; }
    if (password.trim().length < 3) { notify.error('Пароль должен быть минимум 3 символа'); return; }
    const ok = await login(nickname.trim(), password);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        <h2 className="text-lg font-bold text-zinc-900">Регистрация</h2>
        <p className="text-xs text-zinc-500 mt-0.5">Придумайте никнейм и пароль</p>
        <div className="mt-4 space-y-3">
          <div><label className="text-xs font-medium text-zinc-600">Никнейм</label><input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="Введите никнейм" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm outline-none focus:border-zinc-400" /></div>
          <div><label className="text-xs font-medium text-zinc-600">Пароль</label><div className="relative mt-1"><input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Введите пароль" className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" /><button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        </div>
        <button onClick={handleRegister} disabled={!nickname.trim() || !password.trim()} className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">Создать аккаунт</button>
        <p className="mt-3 text-center text-xs text-zinc-400">Уже есть аккаунт? <button onClick={onSwitchToLogin} className="text-zinc-900 font-semibold hover:underline">Войти</button></p>
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const { user, changePassword } = useUser();
  const [oldPass, setOldPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChange = async () => {
    if (!oldPass.trim() || !newPass.trim()) return;
    const ok = await changePassword(oldPass, newPass);
    if (ok) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-scale-in">
        <button onClick={onClose} className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100"><X className="h-4 w-4" /></button>
        <h2 className="text-lg font-bold text-zinc-900">Настройки</h2>
        <p className="text-xs text-zinc-500 mt-0.5">{user?.nickname} — ID#{user?.id}{user?.isAdmin ? ' (Админ)' : ''}</p>
        <div className="mt-4 space-y-3">
          <div><label className="text-xs font-medium text-zinc-600">Старый пароль</label><div className="relative mt-1"><input type={showOld ? 'text' : 'password'} value={oldPass} onChange={(e) => setOldPass(e.target.value)} placeholder="Введите старый пароль" className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" /><button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
          <div><label className="text-xs font-medium text-zinc-600">Новый пароль</label><div className="relative mt-1"><input type={showNew ? 'text' : 'password'} value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Введите новый пароль" className="w-full rounded-lg border border-zinc-200 px-3 py-2 pr-9 text-sm outline-none focus:border-zinc-400" /><button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600">{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>
        </div>
        <button onClick={handleChange} disabled={!oldPass.trim() || !newPass.trim()} className="mt-5 w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-40">Сменить пароль</button>
      </div>
    </div>
  );
}

export default function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const { user, logout } = useUser();
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = user?.isAdmin === true;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim() && onSearch) {
      onSearch(searchQuery.trim());
    }
  };

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-zinc-200 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-2 sm:px-6 gap-3">
          <a href="/" className="flex items-center gap-2 flex-shrink-0">
            <img src="/images/logov.png" alt="AnimeWorld" className="h-8 w-8" onError={(e) => { (e.target as HTMLImageElement).src = '/images/logov.svg'; }} />
            <span className="text-lg font-bold text-zinc-900 tracking-tight hidden sm:inline">AnimeWorld</span>
          </a>

          <form onSubmit={handleSearch} className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input ref={searchInputRef} type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Поиск..." className="w-full rounded-full border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-1.5 text-xs outline-none focus:border-zinc-400 focus:bg-white transition-colors" />
            </div>
          </form>

          {user ? (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="relative">
                <button onClick={() => setMenuOpen(!menuOpen)} className="flex items-center gap-2 rounded-full border border-zinc-200 bg-transparent pl-1.5 pr-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ backgroundColor: user.color }}>
                    {user.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{user.nickname}</span>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-zinc-200 bg-white py-1 shadow-xl animate-scale-in">
                      <div className="px-3 py-2 border-b border-zinc-100">
                        <p className="text-xs font-semibold text-zinc-800">{user.nickname} <span className="text-zinc-400 font-normal">ID#{user.id}</span>{isAdmin ? <span className="text-pink-500 font-semibold ml-1">Админ</span> : ''}</p>
                      </div>
                      <button onClick={() => { setMenuOpen(false); setShowSettings(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">Настройки</button>
                      {isAdmin && (
                        <button onClick={() => { setMenuOpen(false); setShowUpload(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">Загрузить</button>
                      )}
                      {isAdmin && (
                        <button onClick={() => { setMenuOpen(false); setShowAdmin(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-600 hover:bg-zinc-50">Админ меню</button>
                      )}
                    </div>
                  </>
                )}
              </div>
              <button onClick={() => { logout(); setMenuOpen(false); }} className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 hover:text-red-500 hover:bg-red-50" title="Выйти">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-shrink-0">
              <button onClick={() => setShowLogin(true)} className="rounded-full border border-zinc-200 bg-transparent px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900">Войти</button>
              <button onClick={() => setShowRegister(true)} className="rounded-full bg-zinc-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800">Регистрация</button>
            </div>
          )}
        </div>
      </header>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSwitchToRegister={() => { setShowLogin(false); setShowRegister(true); }} />}
      {showRegister && <RegisterModal onClose={() => setShowRegister(false)} onSwitchToLogin={() => { setShowRegister(false); setShowLogin(true); }} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-12 pb-12">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl mx-4 my-auto">
            <UploadPage onClose={() => setShowUpload(false)} />
          </div>
        </div>
      )}
      {showAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-12 pb-12">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl mx-4 my-auto">
            <AdminPage onClose={() => setShowAdmin(false)} />
          </div>
        </div>
      )}
    </>
  );
}
