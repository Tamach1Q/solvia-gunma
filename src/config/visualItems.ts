import type { VisualCategory, VisualItemDef } from '../types'

// JPEAガイドライン表4を最低限に絞った初期セット。iconは現場画面・報告書のイラスト（インラインSVG）のキー。
export const visualItems: VisualItemDef[] = [
  { itemId: 'AR-01', category: 'アレイ・架台', title: 'モジュール表面の汚れ・破損', criterion: '著しい汚れ、ガラスの割れ・変色がないこと', icon: 'module' },
  { itemId: 'AR-02', category: 'アレイ・架台', title: 'フレームの破損・変形', criterion: 'モジュールフレームに破損・変形がないこと', icon: 'frame' },
  { itemId: 'AR-03', category: 'アレイ・架台', title: '架台・基礎のさび・腐食・変形', criterion: '架台・基礎に著しいさび、腐食、変形がないこと', icon: 'mount' },
  { itemId: 'AR-04', category: 'アレイ・架台', title: 'ボルト・ナットの緩み', criterion: '架台の締結部に緩み・脱落がないこと', icon: 'bolt' },
  { itemId: 'AR-05', category: 'アレイ・架台', title: '接地線の状態', criterion: '接地線に損傷・外れがなく、確実に接続されていること', icon: 'ground' },
  { itemId: 'AR-06', category: 'アレイ・架台', title: '配線・コネクタの損傷', criterion: 'ケーブル・コネクタに損傷、垂れ下がり、外れがないこと', icon: 'cable' },
  { itemId: 'AR-07', category: 'アレイ・架台', title: '周囲の状況（雑草・影・鳥の巣）', criterion: '発電に影響する雑草・影、鳥の巣がないこと', icon: 'surroundings' },
  { itemId: 'JB-01', category: '接続箱', title: '外箱の腐食・破損', criterion: '外箱に腐食・破損がないこと', icon: 'box' },
  { itemId: 'JB-02', category: '接続箱', title: '内部の状態（雨水・虫・小動物の侵入）', criterion: '内部に雨水・虫・小動物の侵入跡がないこと', icon: 'box-inside' },
  { itemId: 'JB-03', category: '接続箱', title: '端子台のねじ緩み', criterion: '端子台のねじに緩み・変色がないこと', icon: 'terminal' },
  { itemId: 'JB-04', category: '接続箱', title: '開閉器の操作', criterion: '開閉器が正常に操作できること', icon: 'switch' },
  { itemId: 'JB-05', category: '接続箱', title: '避雷素子（SPD）の劣化', criterion: 'SPDの表示窓に劣化表示がないこと', icon: 'spd' },
  { itemId: 'PC-01', category: 'PCS', title: '外箱の腐食・破損', criterion: '外箱に腐食・破損がないこと', icon: 'pcs' },
  { itemId: 'PC-02', category: 'PCS', title: '通気孔・フィルタ', criterion: '通気孔がふさがれておらず、フィルタに目詰まりがないこと', icon: 'vent' },
  { itemId: 'PC-03', category: 'PCS', title: '異常音・振動・異臭', criterion: '運転中に異常音・振動・異臭がないこと', icon: 'noise' },
  { itemId: 'PC-04', category: 'PCS', title: '表示部・エラー履歴', criterion: '表示部が正常で、未対応のエラー履歴がないこと', icon: 'display' },
  { itemId: 'PC-05', category: 'PCS', title: '配線・接地線・端子の変色', criterion: '配線・接地線・端子に損傷・変色がないこと', icon: 'pcs-wire' },
  { itemId: 'OT-01', category: 'その他', title: '開閉器・漏電遮断器', criterion: '開閉器・漏電遮断器が正常に動作すること', icon: 'breaker' },
  { itemId: 'OT-02', category: 'その他', title: '電力量計', criterion: '電力量計の表示が正常であること', icon: 'meter' },
  { itemId: 'OT-03', category: 'その他', title: 'フェンス・門扉・標識', criterion: 'フェンス・門扉に破損がなく、標識が掲示されていること', icon: 'fence' },
]

export const visualCategories: VisualCategory[] = ['アレイ・架台', '接続箱', 'PCS', 'その他']

// ご提案文テンプレートの対象になる目視項目
export const visualItemIds = { panelDamage: 'AR-01', boltLoose: 'AR-04', weeds: 'AR-07' } as const
