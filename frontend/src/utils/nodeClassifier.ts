/**
 * nodeClassifier.ts — Rakshak Node Keyword Classification System
 * 
 * Single source of truth for the 16 on-chain archetypes, color legend mapping,
 * and deterministic wallet classification logic.
 */

export type RiskTier = "THREAT" | "MEDIUM" | "SAFE";
export type ColorTier = "CRITICAL" | "ELEVATED" | "WATCH" | "LOW" | "CLEAR";

export interface ArchetypeDefinition {
  id: string;
  keyword: string;
  icon: string;
  riskTier: RiskTier;
  defaultColorHex: string;
  category: string;
  plainEnglishMeaning: string;
  badge: string;
}

export interface WalletInputData {
  address: string;
  riskScore?: number;        // Either 0-100 or 0.0-1.0
  txCount?: number;
  balanceEth?: number;
  label?: string;
  flagged?: boolean;
  exposurePercentage?: number;
  trustStatus?: "NEW" | "TRUSTED" | string;
  daysActive?: number;
  behavioralFlags?: string[];
}

export interface NodeClassification {
  id: string;
  keyword: string;
  icon: string;
  riskTier: RiskTier;
  riskScore: number;         // 0–100 scale
  riskScoreNormalized: number; // 0.0–1.0 scale
  colorHex: string;
  colorTier: ColorTier;
  plainEnglishMeaning: string;
  category: string;
  badge: string;
  summary: string;
}

/**
 * Single source of truth: 16 Rakshak Archetype Definitions from manual.
 */
export const NODE_KEYWORD_CONFIG: Record<string, ArchetypeDefinition> = {
  // ── 🔴 Threat / High Risk (Score > 65%) ─────────────────────────────────────
  RAPID_EXFILTRATOR: {
    id: "RAPID_EXFILTRATOR",
    keyword: "RAPID EXFILTRATOR",
    icon: "⚡",
    riskTier: "THREAT",
    defaultColorHex: "#EF4444",
    category: "Exploit Cluster",
    plainEnglishMeaning: "Fast fund draining across many addresses — classic hack/exploit pattern emptying a victim wallet.",
    badge: "⚡ RAPID EXFILTRATOR",
  },
  TORNADO_MIXER_RELAY: {
    id: "TORNADO_MIXER_RELAY",
    keyword: "TORNADO MIXER RELAY",
    icon: "🌪️",
    riskTier: "THREAT",
    defaultColorHex: "#F97316",
    category: "Obfuscation",
    plainEnglishMeaning: "Routes funds through privacy mixers (like Tornado Cash) to sever on-chain provenance and launder funds.",
    badge: "🌪️ TORNADO MIXER RELAY",
  },
  CIRCULAR_WASHTRADER: {
    id: "CIRCULAR_WASHTRADER",
    keyword: "CIRCULAR WASHTRADER",
    icon: "🔄",
    riskTier: "THREAT",
    defaultColorHex: "#F43F5E",
    category: "Market Manipulation",
    plainEnglishMeaning: "Circular A→B→C→A transfers across closed wallet rings to fabricate artificial trading volume.",
    badge: "🔄 CIRCULAR WASHTRADER",
  },
  WHALE_DUMP_LIQUIDATOR: {
    id: "WHALE_DUMP_LIQUIDATOR",
    keyword: "WHALE DUMP LIQUIDATOR",
    icon: "🐋",
    riskTier: "THREAT",
    defaultColorHex: "#DC2626",
    category: "Whale Risk",
    plainEnglishMeaning: "Sudden massive sell-off by a concentrated high-balance holder causing severe market slippage.",
    badge: "🐋 WHALE DUMP LIQUIDATOR",
  },
  MEV_SANDWICH_BOT: {
    id: "MEV_SANDWICH_BOT",
    keyword: "MEV SANDWICH BOT",
    icon: "🤖",
    riskTier: "THREAT",
    defaultColorHex: "#EC4899",
    category: "Automated Bot",
    plainEnglishMeaning: "Frontrunning trades via gas bidding — sneaks transactions in front of users to extract profit.",
    badge: "🤖 MEV SANDWICH BOT",
  },
  SYBIL_AIRDROP_OPERATOR: {
    id: "SYBIL_AIRDROP_OPERATOR",
    keyword: "SYBIL AIRDROP OPERATOR",
    icon: "📦",
    riskTier: "THREAT",
    defaultColorHex: "#FB7185",
    category: "Coordinated Activity",
    plainEnglishMeaning: "Many coordinated fake wallets scripted by one entity to exploit airdrops and protocol incentives.",
    badge: "📦 SYBIL AIRDROP OPERATOR",
  },
  TAINTED_GRAPH_RELAY: {
    id: "TAINTED_GRAPH_RELAY",
    keyword: "TAINTED GRAPH RELAY",
    icon: "🕸️",
    riskTier: "THREAT",
    defaultColorHex: "#FBBF24",
    category: "Graph Proximity",
    plainEnglishMeaning: "Connected to flagged wallets (guilt by association) — multi-hop proximity without direct execution.",
    badge: "🕸️ TAINTED GRAPH RELAY",
  },

  // ── 🟡 Medium / Watch (Score 25–65%) ───────────────────────────────────────
  FLASH_LOAN_OPERATOR: {
    id: "FLASH_LOAN_OPERATOR",
    keyword: "FLASH LOAN OPERATOR",
    icon: "⚡",
    riskTier: "MEDIUM",
    defaultColorHex: "#EAB308",
    category: "MEV / Arbitrage",
    plainEnglishMeaning: "Large uncollateralized instant loans in a single block — frequently used in complex DeFi exploits.",
    badge: "⚡ FLASH LOAN OPERATOR",
  },
  INSTITUTIONAL_GATEWAY: {
    id: "INSTITUTIONAL_GATEWAY",
    keyword: "INSTITUTIONAL GATEWAY",
    icon: "🏛️",
    riskTier: "MEDIUM",
    defaultColorHex: "#8B5CF6",
    category: "Exchange Infrastructure",
    plainEnglishMeaning: "High-volume CEX or institutional clearing hub facilitating bulk deposits and bridge settlements.",
    badge: "🏛️ INSTITUTIONAL GATEWAY",
  },
  NFT_HIGH_VELOCITY_TRADER: {
    id: "NFT_HIGH_VELOCITY_TRADER",
    keyword: "NFT HIGH-VELOCITY TRADER",
    icon: "🎨",
    riskTier: "MEDIUM",
    defaultColorHex: "#A855F7",
    category: "Market Participant",
    plainEnglishMeaning: "Rapid NFT flipping and high-cadence floor sweeping — potential wash trading to inflate floor prices.",
    badge: "🎨 NFT HIGH-VELOCITY TRADER",
  },

  // ── 🔵 Safe / Trusted (Score < 25%) ─────────────────────────────────────────
  GRADUATED_SENTINEL_USER: {
    id: "GRADUATED_SENTINEL_USER",
    keyword: "GRADUATED SENTINEL USER",
    icon: "🛡️",
    riskTier: "SAFE",
    defaultColorHex: "#10B981",
    category: "Verified Trusted",
    plainEnglishMeaning: "45+ days clean history with continuous weekly activity — fully passed Rakshak graduation checks.",
    badge: "🛡️ GRADUATED SENTINEL USER",
  },
  NEW_ON_RAMP_WALLET: {
    id: "NEW_ON_RAMP_WALLET",
    keyword: "NEW ON-RAMP WALLET",
    icon: "🌱",
    riskTier: "SAFE",
    defaultColorHex: "#34D399",
    category: "Protected On-Ramp",
    plainEnglishMeaning: "New wallet under protective monitoring — progressive trust safeguards prevent false positive quarantine.",
    badge: "🌱 NEW ON-RAMP WALLET",
  },
  BLUE_CHIP_YIELD_FARMER: {
    id: "BLUE_CHIP_YIELD_FARMER",
    keyword: "BLUE-CHIP YIELD FARMER",
    icon: "🌾",
    riskTier: "SAFE",
    defaultColorHex: "#14B8A6",
    category: "DeFi Protocol",
    plainEnglishMeaning: "Liquidity provider on audited protocols (Uniswap, Aave, Compound) with normal staking patterns.",
    badge: "🌾 BLUE-CHIP YIELD FARMER",
  },
  CROSS_CHAIN_BRIDGE_RELAY: {
    id: "CROSS_CHAIN_BRIDGE_RELAY",
    keyword: "CROSS-CHAIN BRIDGE RELAY",
    icon: "🌉",
    riskTier: "SAFE",
    defaultColorHex: "#0284C7",
    category: "Bridge Settlement",
    plainEnglishMeaning: "Normal cross-chain transfers transmitting liquidity across Layer-2 rollups via cryptographic proofs.",
    badge: "🌉 CROSS-CHAIN BRIDGE RELAY",
  },
  COLD_STORAGE_WHALE_VAULT: {
    id: "COLD_STORAGE_WHALE_VAULT",
    keyword: "COLD STORAGE WHALE VAULT",
    icon: "🏦",
    riskTier: "SAFE",
    defaultColorHex: "#38BDF8",
    category: "Treasury Reserve",
    plainEnglishMeaning: "Large, dormant, long-term holder accumulating and holding native liquidity with patient dormancy.",
    badge: "🏦 COLD STORAGE WHALE VAULT",
  },
  DEFI_AMM_ARBITRAGEUR: {
    id: "DEFI_AMM_ARBITRAGEUR",
    keyword: "DEFI AMM ARBITRAGEUR",
    icon: "⚙️",
    riskTier: "SAFE",
    defaultColorHex: "#06B6D4",
    category: "Liquidity Maker",
    plainEnglishMeaning: "Automated price-balancing bot rebalancing liquidity pool discrepancies across decentralized exchanges.",
    badge: "⚙️ DEFI AMM ARBITRAGEUR",
  },
};

/**
 * Computes deterministic integer hash from a wallet address string.
 */
export function getAddressDeterministicHash(address: string): number {
  const clean = (address || "0x0000000000000000000000000000000000000000").toLowerCase();
  let h = 0;
  for (let i = 0; i < clean.length; i++) {
    h = (Math.imul(31, h) + clean.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * 2. Color Legend Mapping based on exact prompt specifications:
 * - Red (>85%): Critical — auto-block (#EF4444)
 * - Orange (65–85%): Elevated — needs human review (#F97316)
 * - Amber (25–65%): Watch — monitor (#F59E0B)
 * - Blue (<25%): Low — normal/trusted (#38BDF8)
 * - Green (<10%): Clear — graduated trusted wallet (#10B981)
 */
export function getColorByRiskScore(score100: number): { colorHex: string; colorTier: ColorTier } {
  if (score100 > 85) {
    return { colorHex: "#EF4444", colorTier: "CRITICAL" };
  } else if (score100 > 65) {
    return { colorHex: "#F97316", colorTier: "ELEVATED" };
  } else if (score100 >= 25) {
    return { colorHex: "#F59E0B", colorTier: "WATCH" };
  } else if (score100 >= 10) {
    return { colorHex: "#38BDF8", colorTier: "LOW" };
  } else {
    return { colorHex: "#10B981", colorTier: "CLEAR" };
  }
}

/**
 * 1. Classification Logic
 * Deterministically assigns each wallet a riskScore (0–100) and maps it to one
 * keyword archetype from the 3 tiers.
 */
export function classifyNode(walletData: WalletInputData): NodeClassification {
  const addr = (walletData.address || "0x0").toLowerCase();
  const hash = getAddressDeterministicHash(addr);

  // Normalize risk score to 0–100
  let rawScore = walletData.riskScore ?? 15;
  if (rawScore > 0 && rawScore <= 1.0) {
    rawScore = rawScore * 100;
  }
  let score100 = Math.max(0, Math.min(100, rawScore));

  const lbl = (walletData.label || "unknown").toLowerCase();
  const isFlagged = Boolean(walletData.flagged || lbl === "attacker");
  const balance = walletData.balanceEth ?? 0;
  const txCount = walletData.txCount ?? 1;
  const flags = walletData.behavioralFlags || [];
  const trustStatus = walletData.trustStatus || "NEW";

  let key: keyof typeof NODE_KEYWORD_CONFIG;

  // 🔴 Tier 1: Threat / High Risk (> 65% or explicitly flagged/attacker)
  if (score100 > 65 || isFlagged) {
    if (score100 <= 65) score100 = 88; // Elevate score if explicitly flagged

    if (flags.includes("mixer") || flags.includes("privacy_pool")) {
      key = "TORNADO_MIXER_RELAY";
    } else if (flags.includes("cycle") || flags.includes("washtrade")) {
      key = "CIRCULAR_WASHTRADER";
    } else if (flags.includes("whale_dump") || (balance >= 40 && score100 >= 75)) {
      key = "WHALE_DUMP_LIQUIDATOR";
    } else if (flags.includes("mev") || flags.includes("sandwich")) {
      key = "MEV_SANDWICH_BOT";
    } else if (flags.includes("sybil")) {
      key = "SYBIL_AIRDROP_OPERATOR";
    } else if (flags.includes("tainted_exposure")) {
      key = "TAINTED_GRAPH_RELAY";
    } else if (flags.includes("rapid_drain")) {
      key = "RAPID_EXFILTRATOR";
    } else {
      const threatSlot = hash % 7;
      if (threatSlot === 1) {
        key = "TORNADO_MIXER_RELAY";
      } else if (threatSlot === 2) {
        key = "CIRCULAR_WASHTRADER";
      } else if (threatSlot === 3) {
        key = "WHALE_DUMP_LIQUIDATOR";
      } else if (threatSlot === 4) {
        key = "MEV_SANDWICH_BOT";
      } else if (threatSlot === 5) {
        key = "SYBIL_AIRDROP_OPERATOR";
      } else if (threatSlot === 6) {
        key = "TAINTED_GRAPH_RELAY";
      } else {
        key = "RAPID_EXFILTRATOR";
      }
    }
  }
  // 🟡 Tier 2: Medium / Watch (25–65%)
  else if (score100 >= 25 && score100 <= 65) {
    if (flags.includes("flash_loan")) {
      key = "FLASH_LOAN_OPERATOR";
    } else if (lbl === "exchange" || flags.includes("cex")) {
      key = "INSTITUTIONAL_GATEWAY";
    } else if (flags.includes("nft")) {
      key = "NFT_HIGH_VELOCITY_TRADER";
    } else {
      const medSlot = hash % 3;
      if (medSlot === 0) {
        key = "FLASH_LOAN_OPERATOR";
      } else if (medSlot === 1) {
        key = "INSTITUTIONAL_GATEWAY";
      } else {
        key = "NFT_HIGH_VELOCITY_TRADER";
      }
    }
  }
  // 🔵 Tier 3: Safe / Trusted (< 25%)
  else {
    if (flags.includes("yield") || flags.includes("staking")) {
      key = "BLUE_CHIP_YIELD_FARMER";
    } else if (flags.includes("bridge")) {
      key = "CROSS_CHAIN_BRIDGE_RELAY";
    } else if (flags.includes("arb") || flags.includes("amm")) {
      key = "DEFI_AMM_ARBITRAGEUR";
    } else if (balance >= 20 || lbl === "whale") {
      key = "COLD_STORAGE_WHALE_VAULT";
    } else if (trustStatus === "TRUSTED" || (walletData.daysActive ?? 0) >= 45) {
      key = "GRADUATED_SENTINEL_USER";
    } else if (trustStatus === "NEW" && txCount <= 5) {
      key = "NEW_ON_RAMP_WALLET";
    } else {
      const safeSlot = hash % 6;
      if (safeSlot === 0) {
        key = "GRADUATED_SENTINEL_USER";
      } else if (safeSlot === 1) {
        key = "NEW_ON_RAMP_WALLET";
      } else if (safeSlot === 2) {
        key = "BLUE_CHIP_YIELD_FARMER";
      } else if (safeSlot === 3) {
        key = "CROSS_CHAIN_BRIDGE_RELAY";
      } else if (safeSlot === 4) {
        key = "COLD_STORAGE_WHALE_VAULT";
      } else {
        key = "DEFI_AMM_ARBITRAGEUR";
      }
    }
  }

  const def = NODE_KEYWORD_CONFIG[key] || NODE_KEYWORD_CONFIG.GRADUATED_SENTINEL_USER;
  const { colorHex, colorTier } = getColorByRiskScore(score100);

  return {
    id: def.id,
    keyword: def.keyword,
    icon: def.icon,
    riskTier: def.riskTier,
    riskScore: Math.round(score100),
    riskScoreNormalized: Number((score100 / 100).toFixed(4)),
    colorHex: def.defaultColorHex || colorHex,
    colorTier: colorTier,
    plainEnglishMeaning: def.plainEnglishMeaning,
    category: def.category,
    badge: def.badge,
    summary: def.plainEnglishMeaning,
  };
}

/**
 * Returns all 16 archetype definitions for manual, UI filters, and docs.
 */
export function getAllArchetypes(): ArchetypeDefinition[] {
  return Object.values(NODE_KEYWORD_CONFIG);
}
