const BASE = '/api';

async function request(url: string, options?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(BASE + url, { credentials: 'include', ...options });
  } catch {
    throw new Error('Сервер недоступен');
  }

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
    const res = await request('/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return { user: res.user };
  },
  async login(username: string, password: string) {
    const res = await request('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    return { user: res.user };
  },
  async me() {
    return request('/auth/me');
  },
  async logout() {
    return request('/auth/logout', { method: 'POST' });
  },
  async changePassword(oldPassword: string, newPassword: string) {
    return request('/auth/change-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oldPassword, newPassword }) });
  },

  // Anime
  async getAnimeList() {
    const res = await request('/anime');
    return res.items || [];
  },
  async getAnime(id: number) {
    const res = await request(`/anime/${id}`);
    return res.anime;
  },
  async uploadAnime(data: { title: string; description?: string; year?: number; genres?: string; video: string; videoMime: string; poster?: string; posterMime?: string }) {
    return request('/anime/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  },
  async deleteAnime(id: number) {
    return request(`/admin/anime/${id}`, { method: 'DELETE' });
  },
  getPosterUrl(id: number) {
    return `${BASE}/files/anime/${id}/poster`;
  },
  getVideoUrl(episodeId: number) {
    return `${BASE}/files/episode/${episodeId}/video`;
  },

  // Comments
  async getComments(animeId: number) {
    const res = await request(`/anime/${animeId}/comments`);
    return res.comments || [];
  },
  async addComment(animeId: number, text: string, episodeId?: number) {
    return request(`/anime/${animeId}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, episodeId }) });
  },
  async deleteComment(id: number) {
    return request(`/admin/comments/${id}`, { method: 'DELETE' });
  },

  // Votes
  async getVotes(animeId: number) {
    return request(`/anime/${animeId}/votes`);
  },
  async vote(animeId: number, vote: 0 | 1 | -1) {
    return request(`/anime/${animeId}/vote`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ vote }) });
  },

  // Ratings
  async getRating(animeId: number) {
    return request(`/anime/${animeId}/rating`);
  },
  async rate(animeId: number, score: number) {
    return request(`/anime/${animeId}/rate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ score }) });
  },

  // Views
  async addView(episodeId: number, watchedSeconds: number = 0) {
    return request(`/history/${episodeId}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ watchedSeconds }) });
  },

  // Admin
  async getUsers() {
    const res = await request('/admin/users');
    return res.users || [];
  },
  async setAdmin(userId: number, isAdmin: boolean) {
    return request(`/admin/users/${userId}/admin`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isAdmin }) });
  },
  async setUpload(userId: number, canUpload: boolean) {
    return request(`/admin/users/${userId}/upload-permission`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canUpload }) });
  },
};
