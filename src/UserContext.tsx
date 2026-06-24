import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { useNotify } from './NotifyContext';
import { api } from './api';

export type User = {
  id: number;
  nickname: string;
  color: string;
  isAdmin: boolean;
  canUpload: boolean;
};

type UserContextType = {
  user: User | null;
  users: User[];
  login: (nickname: string, password: string) => Promise<boolean>;
  logout: () => void;
  changePassword: (oldPass: string, newPass: string) => boolean;
  getUserLikes: (animeId: number) => Set<number>;
  setUserLikes: (animeId: number, ids: Set<number>) => void;
  toggleAdmin: (userId: number) => Promise<void>;
  toggleUpload: (userId: number) => Promise<void>;
  deleteUser: (userId: number) => Promise<void>;
  refreshUsers: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const UserContext = createContext<UserContextType | null>(null);
const userLikesStore = new Map<number, Map<number, Set<number>>>();

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [authChecked, setAuthChecked] = useState(false);
  const notify = useNotify();

  const checkAuth = useCallback(async () => {
    try {
      const data = await api.me();
      if (data.user) setUser(data.user);
    } catch {}
    setAuthChecked(true);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  const refreshUsers = useCallback(async () => {
    try { const data = await api.getUsers(); setUsers(data); } catch {}
  }, []);

  const login = useCallback(async (nickname: string, password: string): Promise<boolean> => {
    try {
      const data = await api.register(nickname.trim(), password);
      setUser(data.user);
      notify.success(`Добро пожаловать, ${data.user.nickname}!${data.user.isAdmin ? ' (Админ)' : ''}`);
      return true;
    } catch (err: any) {
      // Если регистрация не удалась (username занят) — пробуем логин
      try {
        const data = await api.login(nickname.trim(), password);
        setUser(data.user);
        notify.success(`С возвращением, ${data.user.nickname}!`);
        return true;
      } catch (loginErr: any) {
        notify.error(loginErr.message || 'Ошибка входа');
        return false;
      }
    }
  }, [notify]);

  const logout = useCallback(() => {
    api.logout().catch(() => {});
    setUser(null);
    notify.info('Вы вышли из аккаунта');
  }, [notify]);

  const changePassword = useCallback((_oldPass: string, _newPass: string): boolean => {
    notify.error('Смена пароля временно недоступна через API');
    return false;
  }, [notify]);

  const getUserLikes = useCallback((animeId: number): Set<number> => {
    if (!user) return new Set();
    return userLikesStore.get(user.id)?.get(animeId) || new Set();
  }, [user]);

  const setUserLikes = useCallback((animeId: number, ids: Set<number>) => {
    if (!user) return;
    let userMap = userLikesStore.get(user.id);
    if (!userMap) { userMap = new Map(); userLikesStore.set(user.id, userMap); }
    userMap.set(animeId, ids);
  }, [user]);

  const toggleAdmin = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    await api.setAdmin(userId, !target.isAdmin);
    await refreshUsers();
    notify.success(`${target.nickname}: ${!target.isAdmin ? 'админ' : 'права админа сняты'}`);
  }, [users, refreshUsers, notify]);

  const toggleUpload = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    await api.setUpload(userId, !target.canUpload);
    await refreshUsers();
    notify.success(`${target.nickname}: загрузка ${!target.canUpload ? 'включена' : 'отключена'}`);
  }, [users, refreshUsers, notify]);

  const deleteUser = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target || target.isAdmin) { notify.error('Нельзя удалить админа'); return; }
    await api.deleteUser(userId);
    await refreshUsers();
    notify.success(`Пользователь ${target.nickname} удалён`);
  }, [users, refreshUsers, notify]);

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>;
  }

  return (
    <UserContext.Provider value={{ user, users, login, logout, changePassword, getUserLikes, setUserLikes, toggleAdmin, toggleUpload, deleteUser, refreshUsers, checkAuth }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
}
