import type { Circuit, Site } from '../types'

export const siteCircuits = (site: Site): Circuit[] => site.pcs.flatMap(pcs => pcs.circuits)

export const findCircuit = (site: Site, circuitId?: string) => siteCircuits(site).find(circuit => circuit.circuitId === circuitId)

// パネル（アレイ・段）を担当する回路。異常箇所のパネルから回路番号を引くのに使う。
export const circuitForPanel = (site: Site, arrayId: string, row: number) => siteCircuits(site).find(circuit => circuit.arrayId === arrayId && circuit.rows.includes(row))

export const pcsRatedKw = (site: Site) => site.pcs.reduce((sum, pcs) => sum + pcs.ratedKw, 0)

export const panelKw = (site: Site) => site.module.count * site.module.pmaxW / 1000
