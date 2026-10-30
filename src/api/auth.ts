import type { CenterInfo, Language } from '../db/schema';
import { api } from './http';

export interface User {
  id: string;
  login: string;
  name: string;
}

export const authApi = {
  me: () => api<{ user: User | null }>('GET', '/api/auth/me'),
  login: (login: string, password: string) => api<{ user: User }>('POST', '/api/auth/login', { login, password }),
  register: (input: { login: string; password: string; name: string; center: Partial<CenterInfo>; language: Language }) =>
    api<{ user: User }>('POST', '/api/auth/register', input),
  logout: () => api<{ ok: true }>('POST', '/api/auth/logout'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api<{ ok: true }>('POST', '/api/auth/password', { currentPassword, newPassword }),
};
