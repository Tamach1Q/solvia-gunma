// 出典：JPEA「太陽光発電システム保守点検ガイドライン【10kW以上の一般用電気工作物】」表4（定期点検要領）、表2の注
export const thresholdSource = 'JPEA 太陽光発電システム保守点検ガイドライン【10kW以上の一般用電気工作物】表4・表2注'

export const thresholds = {
  dcInsulation: {
    highVoltageBoundaryV: 300,
    minMOhmAboveBoundary: 0.4,
    minMOhmAtOrBelowBoundary: 0.2,
    dropFromPreviousRatio: 0.5,
    belowPeerMedianRatio: 0.1,
  },
  acInsulation: { minMOhm: 1 },
  openVoltage: { cautionDeviation: 0.05, failDeviation: 0.1 },
  gridVoltage: {
    単相3線: { nominalV: 101, toleranceV: 6 },
    三相3線: { nominalV: 202, toleranceV: 20 },
  },
  grounding: { D: { maxOhm: 100, relaxedMaxOhm: 500 }, C: { maxOhm: 10 } },
} as const

// 点検準備の「今回の確認ポイント」。絶縁抵抗は湿度でぶれるので、1回の低下では拾わず、連続低下と初回比の両方で判断する。
export const checkpointRules = {
  nearThresholdFactor: 3,
  trendMinInspections: 3,
  trendMinDropRatio: 0.3,
} as const

export const measurementUnits = {
  DC開放電圧: 'V', DC絶縁抵抗: 'MΩ', AC絶縁抵抗: 'MΩ', 系統電圧UO: 'V', 系統電圧WO: 'V', 接地抵抗_架台: 'Ω', 接地抵抗_PCS: 'Ω',
} as const

export const measurementLabels = {
  DC開放電圧: '開放電圧', DC絶縁抵抗: '絶縁抵抗（DC）', AC絶縁抵抗: '絶縁抵抗（AC）', 系統電圧UO: '系統電圧 U-O', 系統電圧WO: '系統電圧 W-O', 接地抵抗_架台: '接地抵抗（架台）', 接地抵抗_PCS: '接地抵抗（PCS）',
} as const

export const rainCaution = '雨後測定の注意：接地抵抗は雨の後に測定しないでください'
