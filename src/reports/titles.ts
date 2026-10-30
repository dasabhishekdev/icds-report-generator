export const REPORT_IDS = ['fuel', 'voucher', 'snp', 'stock'] as const;
export type ReportId = (typeof REPORT_IDS)[number];

export const REPORT_TITLES: Record<ReportId, string> = {
  fuel: 'জ্বালানী ও মশলা খরচ (Fuel & Spices)',
  voucher: 'পুষ্টি ভাউচার (Nutrition Voucher)',
  snp: 'সবজী ও ডিম রেজিস্টার (SNP)',
  stock: 'মজুত ও খরচ রেজিস্টার (Stock)',
};
