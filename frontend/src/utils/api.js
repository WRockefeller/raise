const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function getToken() {
  return localStorage.getItem('raise_token');
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.errors?.[0]?.msg || 'Request failed');
  }
  return data;
}

export const api = {
  signup: (email, password) =>
    request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) }),

  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),

  getProfile: () => request('/user/profile'),

  setNiche: (niche) =>
    request('/user/niche', { method: 'POST', body: JSON.stringify({ niche }) }),

  getVideos: ({ niche, sort, time }) => {
    const params = new URLSearchParams();
    if (niche) params.set('niche', niche);
    if (sort) params.set('sort', sort);
    if (time) params.set('time', time);
    return request(`/videos?${params}`);
  },
};
