export const SETS = {
  one: { label: '1枚', description: 'H01のみ。最初の動作確認に。', ids: ['H01'] },
  four: { label: '4枚', description: 'H01・H02・H03・ANSWER。小さなセットで確認。', ids: ['H01', 'H02', 'H03', 'ANSWER'] },
  nine: { label: '9枚', description: 'H01〜H08・ANSWER。本番想定の負荷で確認。', ids: ['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER'] },
  ten: { label: '10枚', description: '練習・H01〜H08・ANSWER。チュートリアルを含むゲーム用。', ids: ['H01','H02','H03','H04','H05','H06','H07','H08','ANSWER','TUTORIAL'] },
} as const;
export type SetId = keyof typeof SETS;
export function isSetId(value: unknown): value is SetId { return typeof value === 'string' && Object.hasOwnProperty.call(SETS, value); }
export const APP_VERSION = '0.8.0';
export const ASSET_VERSION = 'halloween-hiragana-v1';
