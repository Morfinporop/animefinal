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
  changePassword: (oldPass: string, newPass: string) => Promise<boolean>;
  toggleAdmin: (userId: number) => Promise<void>;
  toggleUpload: (userId: number) => Promise<void>;
  refreshUsers: () => Promise<void>;
  checkAuth: () => Promise<void>;
};

const UserContext = createContext<UserContextType | null>(null);

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
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      // Не админ — пустой массив
      setUsers([]);
    }
  }, []);

  const login = useCallback(async (nickname: string, password: string): Promise<boolean> => {
    try {
      const data = await api.register(nickname.trim(), password);
      setUser(data.user);
      notify.success(`Добро пожаловать, ${data.user.nickname}!${data.user.isAdmin ? ' (Админ)' : ''}`);
      return true;
    } catch (err: any) {
      // Если регистрация не удалась — пробуем логин
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
    setUsers([]);
    notify.info('Вы вышли из аккаунта');
  }, [notify]);

  const changePassword = useCallback(async (oldPass: string, newPass: string): Promise<boolean> => {
    try {
      await api.changePassword(oldPass, newPass);
      notify.success('Пароль изменён');
      return true;
    } catch (err: any) {
      notify.error(err.message || 'Ошибка смены пароля');
      return false;
    }
  }, [notify]);

  const toggleAdmin = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await api.setAdmin(userId, !target.isAdmin);
      await refreshUsers();
      notify.success(`${target.nickname}: ${!target.isAdmin ? 'админ' : 'права сняты'}`);
    } catch (err: any) { notify.error(err.message); }
  }, [users, refreshUsers, notify]);

  const toggleUpload = useCallback(async (userId: number) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;
    try {
      await api.setUpload(userId, !target.canUpload);
      await refreshUsers();
      notify.success(`${target.nickname}: загрузка ${!target.canUpload ? 'включена' : 'отключена'}`);
    } catch (err: any) { notify.error(err.message); }
  }, [users, refreshUsers, notify]);

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900" /></div>;
  }

  return (
    <UserContext.Provider value={{ user, users, login, logout, changePassword, toggleAdmin, toggleUpload, refreshUsers, checkAuth }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be inside UserProvider');
  return ctx;
}
