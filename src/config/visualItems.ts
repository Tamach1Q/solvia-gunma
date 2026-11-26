import type { VisualCategory, VisualItemDef } from '../types'

// 群馬用の様式A・Bで共通の点検項目。番号は帳票と写真の対応に使う。
export const visualItems: VisualItemDef[] = [
  { itemId: '1-1', category: '敷地・周辺', title: '発電所全景', criterion: '全体の外観に異常がないこと', icon: 'module' },
  { itemId: '1-2', category: '敷地・周辺', title: 'フェンス・門扉', criterion: '破損・隙間がなく、施錠されていること', icon: 'fence' },
  { itemId: '1-3', category: '敷地・周辺', title: '標識', criterion: '標識が設置され、記載内容が読めること', icon: 'display' },
  { itemId: '1-4', category: '敷地・周辺', title: '除草状況', criterion: '雑草が繁茂せず、パネルに影がかかっていないこと', icon: 'surroundings' },
  { itemId: '1-5', category: '敷地・周辺', title: '排水・地盤', criterion: '水たまり・土の流出・陥没がないこと', icon: 'ground' },
  { itemId: '1-6', category: '敷地・周辺', title: '周囲の影・障害物', criterion: '樹木や建物による発電への影響がないこと', icon: 'surroundings' },
  { itemId: '2-1', category: '太陽電池アレイ', title: 'パネル表面の汚れ', criterion: '鳥の糞・土・落ち葉などの著しい汚れがないこと', icon: 'module' },
  { itemId: '2-2', category: '太陽電池アレイ', title: 'パネルの破損', criterion: '割れ・ひび・変色がないこと', icon: 'module' },
  { itemId: '2-3', category: '太陽電池アレイ', title: 'パネル固定金具', criterion: '緩み・脱落がないこと', icon: 'frame' },
  { itemId: '3-1', category: '架台・基礎', title: '架台の腐食', criterion: '著しい錆・塗装のはがれがないこと', icon: 'mount' },
  { itemId: '3-2', category: '架台・基礎', title: 'ボルト・ナット', criterion: '緩み・脱落がないこと', icon: 'bolt' },
  { itemId: '3-3', category: '架台・基礎', title: '基礎', criterion: '沈下・傾き・ひびがないこと', icon: 'mount' },
  { itemId: '4-1', category: '配線', title: 'ケーブルの固定', criterion: 'たるみ・結束の外れがないこと', icon: 'cable' },
  { itemId: '4-2', category: '配線', title: 'ケーブル被覆', criterion: '傷・小動物によるかじり跡がないこと', icon: 'cable' },
  { itemId: '4-3', category: '配線', title: 'コネクタ', criterion: '外れ・変色・焦げがないこと', icon: 'terminal' },
  { itemId: '5-1', category: 'パワコン', title: '外観', criterion: '破損・錆・著しい汚れがないこと', icon: 'pcs' },
  { itemId: '5-2', category: 'パワコン', title: '運転状態', criterion: '運転ランプ・エラー表示に異常がないこと', icon: 'display' },
  { itemId: '5-3', category: 'パワコン', title: '異音・異臭・発熱', criterion: '普段と違う音・におい・熱がないこと', icon: 'noise' },
  { itemId: '5-4', category: 'パワコン', title: '通気口', criterion: 'ふさがり・虫の巣がないこと', icon: 'vent' },
  { itemId: '6-1', category: '監視装置・盤', title: '遠隔監視装置', criterion: '通信ランプ・電源に異常がないこと', icon: 'meter' },
  { itemId: '6-2', category: '監視装置・盤', title: '分電盤・ブレーカー', criterion: 'ブレーカーの落ち・破損がなく、施錠されていること', icon: 'breaker' },
]

export const visualCategories: VisualCategory[] = ['敷地・周辺', '太陽電池アレイ', '架台・基礎', '配線', 'パワコン', '監視装置・盤']

export const visualItemIds = { panelDamage: '2-2', boltLoose: '3-2', weeds: '1-4' } as const
