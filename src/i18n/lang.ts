import type { Language } from '../db/schema';
import strings, { type StringKey } from './strings';

const LANG_KEY = 'icds-language';

/** Language used before login; synced from the account setting once signed in. */
export const storedLanguage = (): Language => (localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'bn');
export const rememberLanguage = (lang: Language) => localStorage.setItem(LANG_KEY, lang);
export const translator = (lang: Language) => (key: StringKey) => strings[key][lang];
