import { api } from './http';

export const POSHAN_LOGIN_URL = 'https://poshanabhiyaan.gov.in/login';
/** The portal sends signed-out visitors to its login page first. */
export const POSHAN_SUBMIT_URL = 'https://poshanabhiyaan.gov.in/addactivityparticipation';

export interface PortalLogin {
  username: string;
  password: string;
}

export interface PortalLoginState {
  /** False when the server has no PORTAL_SECRET, so logins cannot be saved. */
  available: boolean;
  login: PortalLogin | null;
}

export const portalLoginApi = {
  get: () => api<PortalLoginState>('GET', '/api/portal-login'),
  save: (login: PortalLogin) => api<void>('PUT', '/api/portal-login', login),
  remove: () => api<void>('DELETE', '/api/portal-login'),
};
