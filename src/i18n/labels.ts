import type { Language } from '../db/schema';

/**
 * Display text for names that come from data rather than the app's strings: category and fuel-item
 * names typed in Settings, the centre's own holidays, and the English West Bengal holiday list.
 * Only what is shown on screen changes; the saved text and the printed registers stay as entered.
 */

const BENGALI = /[\u0980-\u09FF]/;
const LATIN = /[A-Za-z]/;

/** English holiday names (normalised by `key`) → Bengali. */
const HOLIDAYS_BN: Record<string, string> = {
  "new year's day": 'ইংরেজি নববর্ষ',
  'swami vivekananda': 'স্বামী বিবেকানন্দ',
  'saraswati puja': 'সরস্বতী পূজা',
  'saraswati puja [sree panchami]': 'সরস্বতী পূজা (শ্রীপঞ্চমী)',
  'saraswati puja (sree panchami)': 'সরস্বতী পূজা (শ্রীপঞ্চমী)',
  'sree panchami': 'শ্রীপঞ্চমী',
  "netaji's birthday": 'নেতাজির জন্মদিন',
  'netaji subhas chandra bose birthday': 'নেতাজির জন্মদিন',
  netaji: 'নেতাজি',
  'republic day': 'প্রজাতন্ত্র দিবস',
  'shab-e-barat': 'শব-ই-বরাত',
  'thakur panchanan barma': 'ঠাকুর পঞ্চানন বর্মা',
  shivaratri: 'শিবরাত্রি',
  'maha shivratri': 'শিবরাত্রি',
  doljatra: 'দোলযাত্রা',
  'holi (day after doljatra)': 'হোলি (দোলযাত্রার পরের দিন)',
  holi: 'হোলি',
  'shri shri harichand thakur': 'শ্রীশ্রী হরিচাঁদ ঠাকুর',
  'birth day of shri shri harichand thakur (madhu krishna troyodashi tithi)': 'শ্রীশ্রী হরিচাঁদ ঠাকুরের জন্মদিন (মধুকৃষ্ণা ত্রয়োদশী)',
  'eid-ul-fitr': 'ঈদ-উল-ফিতর',
  'id-ul-fitr': 'ঈদ-উল-ফিতর',
  'ram navami': 'রাম নবমী',
  'mahavir jayanti': 'মহাবীর জয়ন্তী',
  'good friday': 'গুড ফ্রাইডে',
  'dr. b. r. ambedkar': 'ড. বি. আর. আম্বেদকর',
  "bengali new year's day (nababarsha)": 'বাংলা নববর্ষ (পয়লা বৈশাখ)',
  'bengali new year (nababarsha)': 'বাংলা নববর্ষ (পয়লা বৈশাখ)',
  'may day': 'মে দিবস',
  'buddha purnima': 'বুদ্ধ পূর্ণিমা',
  'buddha pumima': 'বুদ্ধ পূর্ণিমা',
  'rabindranath tagore': 'রবীন্দ্রনাথ ঠাকুর',
  'id-ud-zoha (bakrid)': 'ঈদ-উজ-জোহা (বকরি ঈদ)',
  muharram: 'মহরম',
  rathayatra: 'রথযাত্রা',
  'independence day': 'স্বাধীনতা দিবস',
  'fateha-dwaz-daham': 'ফাতেহা-দোয়াজ-দহম',
  'rakhi bandhan': 'রাখী বন্ধন',
  janmastami: 'জন্মাষ্টমী',
  janmashtami: 'জন্মাষ্টমী',
  'viswakarma puja': 'বিশ্বকর্মা পূজা',
  gandhiji: 'গান্ধীজি',
  'birthday of gandhiji': 'গান্ধী জয়ন্তী',
  'mahatma gandhi jayanti': 'গান্ধী জয়ন্তী',
  mahalaya: 'মহালয়া',
  'durga puja': 'দুর্গাপূজা',
  'lakshmi puja': 'লক্ষ্মী পূজা',
  'kali puja': 'কালী পূজা',
  bhratridwitiya: 'ভ্রাতৃদ্বিতীয়া',
  'birsa munda': 'বিরসা মুন্ডা',
  'chhat puja': 'ছট পূজা',
  'guru nanak': 'গুরু নানক',
  'guru nanak jayanti': 'গুরু নানকের জন্মদিন',
  'christmas day': 'বড়দিন',
  'bir chilarai': 'বীর চিলারায়',
  'pandit raghunath murmu': 'পণ্ডিত রঘুনাথ মুর্মু',
  'karam puja': 'করম পূজা',
  'hul diwas': 'হুল দিবস',
  'poet bhanu bhakt': 'কবি ভানুভক্ত',
  'id-e-milad': 'ঈদ-ই-মিলাদ',
};

/** Days of Durga Puja after "Durga Puja, (Maha) …". */
const PUJA_DAYS_BN: Record<string, string> = {
  chaturthi: 'চতুর্থী',
  panchami: 'পঞ্চমী',
  shashthi: 'ষষ্ঠী',
  sasthi: 'ষষ্ঠী',
  saptami: 'সপ্তমী',
  astami: 'অষ্টমী',
  ashtami: 'অষ্টমী',
  nabami: 'নবমী',
  navami: 'নবমী',
  dasami: 'দশমী',
  dashami: 'দশমী',
  vijayadashami: 'বিজয়া দশমী',
};

/** Default category names, which are Bengali only, for the English screen. */
const CATEGORIES_EN: Record<string, string> = {
  'শিশু ০-৬ মাস': 'Children 0–6 months',
  'শিশু ৬ মাস - ৩ বছর': 'Children 6 months – 3 years',
  'শিশু ৩ - ৬ বছর': 'Children 3 – 6 years',
};

const key = (s: string) => s.replace(/[’‘`]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();

/** "দুর্গাপূজা" → "দুর্গাপূজার", "ঈদ-উল-ফিতর" → "ঈদ-উল-ফিতরের", "ঈদ-উজ-জোহা (বকরি ঈদ)" → "ঈদ-উজ-জোহার (বকরি ঈদ)". */
function genitive(word: string): string {
  const aside = /^(.*\S)(\s*\([^()]*\))$/.exec(word);
  if (aside) return `${genitive(aside[1])}${aside[2]}`;
  if (!BENGALI.test(word)) return `${word}-এর`;
  const last = word.at(-1) ?? '';
  return /[\u09BE-\u09CC\u0985-\u0994]/.test(last) ? `${word}র` : `${word}ের`;
}

function toBengali(text: string): string | null {
  const exact = HOLIDAYS_BN[key(text)];
  if (exact) return exact;

  const durga = /^durga puja\s*[,–-]\s*(?:maha\s+)?(.+)$/i.exec(text.trim());
  if (durga) {
    const day = PUJA_DAYS_BN[key(durga[1])];
    if (day) return `দুর্গাপূজা, ${day === 'বিজয়া দশমী' ? day : `মহা ${day}`}`;
  }

  const patterns: [RegExp, (x: string) => string][] = [
    [/^day before (.+)$/i, (x) => `${genitive(x)} আগের দিন`],
    [/^day after (.+)$/i, (x) => `${genitive(x)} পরের দিন`],
    [/^additional day for (.+)$/i, (x) => `${genitive(x)} অতিরিক্ত দিন`],
    [/^birth ?day of (.+)$/i, (x) => `${genitive(x)} জন্মদিন`],
    [/^(.+?)['’]s birthday$/i, (x) => `${genitive(x)} জন্মদিন`],
    [/^(.+) birthday$/i, (x) => `${genitive(x)} জন্মদিন`],
  ];
  for (const [re, build] of patterns) {
    const m = re.exec(text.trim());
    if (m) {
      const inner = toBengali(m[1]);
      if (inner) return build(inner);
    }
  }
  return null;
}

/** "বাংলা (English)" or "English (বাংলা)" → the part in `lang`. */
function bilingualPart(text: string, lang: Language): string | null {
  const m = /^(.*\S)\s*\(([^()]+)\)$/.exec(text.trim());
  if (!m) return null;
  const [, outer, inner] = m;
  const outerBn = BENGALI.test(outer) && !LATIN.test(outer);
  const innerBn = BENGALI.test(inner) && !LATIN.test(inner);
  if (outerBn && LATIN.test(inner) && !BENGALI.test(inner)) return lang === 'bn' ? outer : inner.trim();
  if (innerBn && LATIN.test(outer) && !BENGALI.test(outer)) return lang === 'bn' ? inner.trim() : outer;
  return null;
}

export function localizeLabel(text: string, lang: Language): string {
  if (!text) return text;
  const pair = bilingualPart(text, lang);
  if (pair) return pair;
  if (lang === 'en') return CATEGORIES_EN[text.trim()] ?? text;
  if (BENGALI.test(text)) return text;
  const whole = toBengali(text);
  if (whole) return whole;
  if (text.includes(' / ')) return text.split(' / ').map((part) => localizeLabel(part, lang)).join(' / ');
  return text;
}
