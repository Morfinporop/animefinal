const BASE = '/api';

async function request(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(BASE + url, { credentials: 'include', ...options });
  } catch {
    throw new Error('Сервер недоступен');
  }

  // Безопасный парсинг JSON
  let data: any;
  try {
    const text = await res.text();
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Ошибка сервера: неверный ответ');
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Ошибка ${res.status}`);
  }

  return data;
}

export const api = {
  // Auth
  async register(username: string, password: string) {
    return request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  },
  async login(username: string, password: string) {
    return request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  },
  async me() {
    return request('/auth/me');
  },
  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },

  // Anime
  async getAnimeList() {
    return request('/anime');
  },
  async uploadAnime(formData: FormData) {
    return request('/anime', { method: 'POST', body: formData });
  },
  async deleteAnime(id: number) {
    return request(`/anime/${id}`, { method: 'DELETE' });
  },

  // Comments
  async getComments(animeId: number) {
    return request(`/anime/${animeId}/comments`);
  },
  async addComment(animeId: number, text: string, parentId?: number) {
    return request(`/anime/${animeId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, parentId }) });
  },
  async deleteComment(id: number) {
    return request(`/comments/${id}`, { method: 'DELETE' });
  },
  async likeComment(id: number) {
    return request(`/comments/${id}/like`, { method: 'POST' });
  },

  // Ratings
  async rateAnime(animeId: number, score: number) {
    return request(`/anime/${animeId}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) });
  },

  // Views
  async addView(animeId: number) {
    return request(`/anime/${animeId}/view`, { method: 'POST' });
  },

  // Admin
  async getUsers() {
    return request('/admin/users');
  },
  async setAdmin(userId: number, isAdmin: boolean) {
    return request(`/admin/users/${userId}/admin`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin }) });
  },
  async setUpload(userId: number, canUpload: boolean) {
    return request(`/admin/users/${userId}/upload`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canUpload }) });
  },
  async deleteUser(userId: number) {
    return request(`/admin/users/${userId}`, { method: 'DELETE' });
  },
};
