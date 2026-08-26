import axios from 'axios';
import { resolveBaseUrl } from './baseUrl';

const baseURL = resolveBaseUrl(import.meta.env);
const TOKEN_KEY = 'prosperity_token';

export const apiClient = axios.create({
  baseURL,
});

export function getAuthToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setAuthToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);
