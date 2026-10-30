import { describe, expect, it } from 'vitest';
import { localizeLabel } from './labels';

describe('localizeLabel', () => {
  it('picks one side of a bilingual name', () => {
    expect(localizeLabel('গর্ভবতী (Pregnant)', 'bn')).toBe('গর্ভবতী');
    expect(localizeLabel('গর্ভবতী (Pregnant)', 'en')).toBe('Pregnant');
    expect(localizeLabel('অষ্টমী (Astami)', 'en')).toBe('Astami');
    expect(localizeLabel('কয়লা/কাঠ/কেরোসিন তেল (Coal/Wood/Kerosene)', 'en')).toBe('Coal/Wood/Kerosene');
  });

  it('translates the West Bengal holiday list to Bengali', () => {
    expect(localizeLabel('Durga Puja, Maha Astami', 'bn')).toBe('দুর্গাপূজা, মহা অষ্টমী');
    expect(localizeLabel('Durga Puja, Dasami', 'bn')).toBe('দুর্গাপূজা, মহা দশমী');
    expect(localizeLabel('Additional Day for Durga Puja', 'bn')).toBe('দুর্গাপূজার অতিরিক্ত দিন');
    expect(localizeLabel('Day before Id-Ud-Zoha (Bakrid)', 'bn')).toBe('ঈদ-উজ-জোহার (বকরি ঈদ) আগের দিন');
    expect(localizeLabel('Day after Bhratridwitiya', 'bn')).toBe('ভ্রাতৃদ্বিতীয়ার পরের দিন');
    expect(localizeLabel('Birthday of Swami Vivekananda', 'bn')).toBe('স্বামী বিবেকানন্দের জন্মদিন');
    expect(localizeLabel('Netaji’s Birthday / Saraswati Puja [Sree Panchami]', 'bn')).toBe('নেতাজির জন্মদিন / সরস্বতী পূজা (শ্রীপঞ্চমী)');
  });

  it('names the default child categories in English and leaves unknown text alone', () => {
    expect(localizeLabel('শিশু ৬ মাস - ৩ বছর', 'en')).toBe('Children 6 months – 3 years');
    expect(localizeLabel('শিশু ৬ মাস - ৩ বছর', 'bn')).toBe('শিশু ৬ মাস - ৩ বছর');
    expect(localizeLabel('Village fair', 'bn')).toBe('Village fair');
    expect(localizeLabel('Durga Puja, Maha Astami', 'en')).toBe('Durga Puja, Maha Astami');
  });
});
