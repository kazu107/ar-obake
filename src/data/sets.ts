export const SETS = {
  one: { label: '1枚', description: 'H01のみ。最初の動作確認に。', ids: ['H01'] },
  four: { label: '4枚', description: 'H01・H02・H03・ANSWER。小さなセットで確認。', ids: ['H01', 'H02', 'H03', 'ANSWER'] },
  nine: { label: '9枚', description: 'H01〜H08・ANSWER。本番想定の負荷で確認。', ids: ['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER'] },
} as const;
export type SetId = keyof typeof SETS;
export function isSetId(value: unknown): value is SetId { return typeof value === 'string' && Object.hasOwnProperty.call(SETS, value); }
export const APP_VERSION = '0.1.0';
export const ASSET_VERSION = 'calibration-v1';
