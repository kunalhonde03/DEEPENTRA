/**
 * archetypeHelper.ts — Universal Frontend Archetype Helper
 * Wraps nodeClassifier.ts to maintain backward compatibility across the app.
 */

import {
  classifyNode,
  NODE_KEYWORD_CONFIG,
  type NodeClassification,
  type WalletInputData,
} from "./nodeClassifier";

export interface WalletArchetype {
  id: string;
  keyword: string;
  icon: string;
  category: string;
  color: string;
  summary: string;
  badge: string;
  plainEnglishMeaning?: string;
}

export const ARCHETYPE_REGISTRY: WalletArchetype[] = Object.values(NODE_KEYWORD_CONFIG).map((def) => ({
  id: def.id.toLowerCase(),
  keyword: def.keyword,
  icon: def.icon,
  category: def.category,
  color: def.defaultColorHex,
  summary: def.plainEnglishMeaning,
  badge: def.badge,
  plainEnglishMeaning: def.plainEnglishMeaning,
}));

/**
 * Deterministically computes the exact archetype for any wallet address.
 */
export function getWalletArchetype(
  address: string,
  label?: string,
  riskScore: number = 0.15,
  txCount: number = 1,
  balanceEth: number = 0,
  flagged: boolean = false
): WalletArchetype {
  const result: NodeClassification = classifyNode({
    address,
    label,
    riskScore,
    txCount,
    balanceEth,
    flagged,
  });

  return {
    id: result.id.toLowerCase(),
    keyword: result.keyword,
    icon: result.icon,
    category: result.category,
    color: result.colorHex,
    summary: result.plainEnglishMeaning,
    badge: result.badge,
    plainEnglishMeaning: result.plainEnglishMeaning,
  };
}

export { classifyNode, NODE_KEYWORD_CONFIG };
export type { NodeClassification, WalletInputData };
