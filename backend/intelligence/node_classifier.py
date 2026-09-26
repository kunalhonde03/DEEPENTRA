"""
backend/intelligence/node_classifier.py — Rakshak Node Keyword Classification System

Single source of truth for the 16 on-chain archetypes, color legend mapping,
and deterministic wallet classification logic.
"""

from typing import Dict, Any, Optional, List
import hashlib


# ── Single Source of Truth Archetype Definitions ──────────────────────────
NODE_KEYWORD_CONFIG: Dict[str, Dict[str, Any]] = {
    # ── 🔴 Threat / High Risk (Score > 65%) ─────────────────────────────────
    "RAPID_EXFILTRATOR": {
        "id": "RAPID_EXFILTRATOR",
        "keyword": "RAPID EXFILTRATOR",
        "icon": "⚡",
        "risk_tier": "THREAT",
        "default_color_hex": "#EF4444",
        "category": "Exploit Cluster",
        "plain_english_meaning": "Fast fund draining across many addresses — classic hack/exploit pattern emptying a victim wallet.",
        "badge": "⚡ RAPID EXFILTRATOR",
    },
    "TORNADO_MIXER_RELAY": {
        "id": "TORNADO_MIXER_RELAY",
        "keyword": "TORNADO MIXER RELAY",
        "icon": "🌪️",
        "risk_tier": "THREAT",
        "default_color_hex": "#F97316",
        "category": "Obfuscation",
        "plain_english_meaning": "Routes funds through privacy mixers (like Tornado Cash) to sever on-chain provenance and launder funds.",
        "badge": "🌪️ TORNADO MIXER RELAY",
    },
    "CIRCULAR_WASHTRADER": {
        "id": "CIRCULAR_WASHTRADER",
        "keyword": "CIRCULAR WASHTRADER",
        "icon": "🔄",
        "risk_tier": "THREAT",
        "default_color_hex": "#F43F5E",
        "category": "Market Manipulation",
        "plain_english_meaning": "Circular A→B→C→A transfers across closed wallet rings to fabricate artificial trading volume.",
        "badge": "🔄 CIRCULAR WASHTRADER",
    },
    "WHALE_DUMP_LIQUIDATOR": {
        "id": "WHALE_DUMP_LIQUIDATOR",
        "keyword": "WHALE DUMP LIQUIDATOR",
        "icon": "🐋",
        "risk_tier": "THREAT",
        "default_color_hex": "#DC2626",
        "category": "Whale Risk",
        "plain_english_meaning": "Sudden massive sell-off by a concentrated high-balance holder causing severe market slippage.",
        "badge": "🐋 WHALE DUMP LIQUIDATOR",
    },
    "MEV_SANDWICH_BOT": {
        "id": "MEV_SANDWICH_BOT",
        "keyword": "MEV SANDWICH BOT",
        "icon": "🤖",
        "risk_tier": "THREAT",
        "default_color_hex": "#EC4899",
        "category": "Automated Bot",
        "plain_english_meaning": "Frontrunning trades via gas bidding — sneaks transactions in front of users to extract profit.",
        "badge": "🤖 MEV SANDWICH BOT",
    },
    "SYBIL_AIRDROP_OPERATOR": {
        "id": "SYBIL_AIRDROP_OPERATOR",
        "keyword": "SYBIL AIRDROP OPERATOR",
        "icon": "📦",
        "risk_tier": "THREAT",
        "default_color_hex": "#FB7185",
        "category": "Coordinated Activity",
        "plain_english_meaning": "Many coordinated fake wallets scripted by one entity to exploit airdrops and protocol incentives.",
        "badge": "📦 SYBIL AIRDROP OPERATOR",
    },
    "TAINTED_GRAPH_RELAY": {
        "id": "TAINTED_GRAPH_RELAY",
        "keyword": "TAINTED GRAPH RELAY",
        "icon": "🕸️",
        "risk_tier": "THREAT",
        "default_color_hex": "#FBBF24",
        "category": "Graph Proximity",
        "plain_english_meaning": "Connected to flagged wallets (guilt by association) — multi-hop proximity without direct execution.",
        "badge": "🕸️ TAINTED GRAPH RELAY",
    },

    # ── 🟡 Medium / Watch (Score 25–65%) ───────────────────────────────────
    "FLASH_LOAN_OPERATOR": {
        "id": "FLASH_LOAN_OPERATOR",
        "keyword": "FLASH LOAN OPERATOR",
        "icon": "⚡",
        "risk_tier": "MEDIUM",
        "default_color_hex": "#EAB308",
        "category": "MEV / Arbitrage",
        "plain_english_meaning": "Large uncollateralized instant loans in a single block — frequently used in complex DeFi exploits.",
        "badge": "⚡ FLASH LOAN OPERATOR",
    },
    "INSTITUTIONAL_GATEWAY": {
        "id": "INSTITUTIONAL_GATEWAY",
        "keyword": "INSTITUTIONAL GATEWAY",
        "icon": "🏛️",
        "risk_tier": "MEDIUM",
        "default_color_hex": "#8B5CF6",
        "category": "Exchange Infrastructure",
        "plain_english_meaning": "High-volume CEX or institutional clearing hub facilitating bulk deposits and bridge settlements.",
        "badge": "🏛️ INSTITUTIONAL GATEWAY",
    },
    "NFT_HIGH_VELOCITY_TRADER": {
        "id": "NFT_HIGH_VELOCITY_TRADER",
        "keyword": "NFT HIGH-VELOCITY TRADER",
        "icon": "🎨",
        "risk_tier": "MEDIUM",
        "default_color_hex": "#A855F7",
        "category": "Market Participant",
        "plain_english_meaning": "Rapid NFT flipping and high-cadence floor sweeping — potential wash trading to inflate floor prices.",
        "badge": "🎨 NFT HIGH-VELOCITY TRADER",
    },

    # ── 🔵 Safe / Trusted (Score < 25%) ─────────────────────────────────────
    "GRADUATED_SENTINEL_USER": {
        "id": "GRADUATED_SENTINEL_USER",
        "keyword": "GRADUATED SENTINEL USER",
        "icon": "🛡️",
        "risk_tier": "SAFE",
        "default_color_hex": "#10B981",
        "category": "Verified Trusted",
        "plain_english_meaning": "45+ days clean history with continuous weekly activity — fully passed Rakshak graduation checks.",
        "badge": "🛡️ GRADUATED SENTINEL USER",
    },
    "NEW_ON_RAMP_WALLET": {
        "id": "NEW_ON_RAMP_WALLET",
        "keyword": "NEW ON-RAMP WALLET",
        "icon": "🌱",
        "risk_tier": "SAFE",
        "default_color_hex": "#34D399",
        "category": "Protected On-Ramp",
        "plain_english_meaning": "New wallet under protective monitoring — progressive trust safeguards prevent false positive quarantine.",
        "badge": "🌱 NEW ON-RAMP WALLET",
    },
    "BLUE_CHIP_YIELD_FARMER": {
        "id": "BLUE_CHIP_YIELD_FARMER",
        "keyword": "BLUE-CHIP YIELD FARMER",
        "icon": "🌾",
        "risk_tier": "SAFE",
        "default_color_hex": "#14B8A6",
        "category": "DeFi Protocol",
        "plain_english_meaning": "Liquidity provider on audited protocols (Uniswap, Aave, Compound) with normal staking patterns.",
        "badge": "🌾 BLUE-CHIP YIELD FARMER",
    },
    "CROSS_CHAIN_BRIDGE_RELAY": {
        "id": "CROSS_CHAIN_BRIDGE_RELAY",
        "keyword": "CROSS-CHAIN BRIDGE RELAY",
        "icon": "🌉",
        "risk_tier": "SAFE",
        "default_color_hex": "#0284C7",
        "category": "Bridge Settlement",
        "plain_english_meaning": "Normal cross-chain transfers transmitting liquidity across Layer-2 rollups via cryptographic proofs.",
        "badge": "🌉 CROSS-CHAIN BRIDGE RELAY",
    },
    "COLD_STORAGE_WHALE_VAULT": {
        "id": "COLD_STORAGE_WHALE_VAULT",
        "keyword": "COLD STORAGE WHALE VAULT",
        "icon": "🏦",
        "risk_tier": "SAFE",
        "default_color_hex": "#38BDF8",
        "category": "Treasury Reserve",
        "plain_english_meaning": "Large, dormant, long-term holder accumulating and holding native liquidity with patient dormancy.",
        "badge": "🏦 COLD STORAGE WHALE VAULT",
    },
    "DEFI_AMM_ARBITRAGEUR": {
        "id": "DEFI_AMM_ARBITRAGEUR",
        "keyword": "DEFI AMM ARBITRAGEUR",
        "icon": "⚙️",
        "risk_tier": "SAFE",
        "default_color_hex": "#06B6D4",
        "category": "Liquidity Maker",
        "plain_english_meaning": "Automated price-balancing bot rebalancing liquidity pool discrepancies across decentralized exchanges.",
        "badge": "⚙️ DEFI AMM ARBITRAGEUR",
    },
}


def get_color_by_risk_score(score_100: float) -> tuple[str, str]:
    """
    Color Legend Mapping based on exact prompt specifications:
    - Red (>85%): Critical — auto-block (#EF4444)
    - Orange (65–85%): Elevated — needs human review (#F97316)
    - Amber (25–65%): Watch — monitor (#F59E0B)
    - Blue (<25%): Low — normal/trusted (#38BDF8)
    - Green (<10%): Clear — graduated trusted wallet (#10B981)
    """
    if score_100 > 85:
        return "#EF4444", "CRITICAL"
    elif score_100 > 65:
        return "#F97316", "ELEVATED"
    elif score_100 >= 25:
        return "#F59E0B", "WATCH"
    elif score_100 >= 10:
        return "#38BDF8", "LOW"
    else:
        return "#10B981", "CLEAR"


def classify_node(
    address: str,
    risk_score: float = 0.15,
    tx_count: int = 1,
    balance_eth: float = 0.0,
    label: str = "unknown",
    flagged: bool = False,
    exposure_percentage: float = 0.0,
    trust_status: str = "NEW",
    days_active: int = 0,
    behavioral_flags: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """
    Deterministically classifies any wallet into one of the 16 archetypes.
    Guarantees that the same wallet address produces the exact same classification.
    """
    addr_clean = (address or "0x0000000000000000000000000000000000000000").lower()
    addr_hash = int(hashlib.sha256(addr_clean.encode()).hexdigest(), 16)

    # Normalize score to 0–100 scale
    score_100 = risk_score * 100.0 if (0.0 < risk_score <= 1.0) else float(risk_score)
    score_100 = max(0.0, min(100.0, score_100))

    lbl = (label or "unknown").lower()
    is_flagged = flagged or (lbl == "attacker")
    flags = behavioral_flags or []

    # 🔴 Tier 1: Threat / High Risk (> 65% or explicitly flagged)
    if score_100 > 65 or is_flagged:
        if score_100 <= 65:
            score_100 = 88.0

        if "mixer" in flags or "privacy_pool" in flags:
            key = "TORNADO_MIXER_RELAY"
        elif "cycle" in flags or "washtrade" in flags:
            key = "CIRCULAR_WASHTRADER"
        elif "whale_dump" in flags or (balance_eth >= 40.0 and score_100 >= 75):
            key = "WHALE_DUMP_LIQUIDATOR"
        elif "mev" in flags or "sandwich" in flags:
            key = "MEV_SANDWICH_BOT"
        elif "sybil" in flags:
            key = "SYBIL_AIRDROP_OPERATOR"
        elif "tainted_exposure" in flags:
            key = "TAINTED_GRAPH_RELAY"
        elif "rapid_drain" in flags:
            key = "RAPID_EXFILTRATOR"
        else:
            threat_slot = addr_hash % 7
            if threat_slot == 1:
                key = "TORNADO_MIXER_RELAY"
            elif threat_slot == 2:
                key = "CIRCULAR_WASHTRADER"
            elif threat_slot == 3:
                key = "WHALE_DUMP_LIQUIDATOR"
            elif threat_slot == 4:
                key = "MEV_SANDWICH_BOT"
            elif threat_slot == 5:
                key = "SYBIL_AIRDROP_OPERATOR"
            elif threat_slot == 6:
                key = "TAINTED_GRAPH_RELAY"
            else:
                key = "RAPID_EXFILTRATOR"

    # 🟡 Tier 2: Medium / Watch (25–65%)
    elif 25.0 <= score_100 <= 65.0:
        if "flash_loan" in flags:
            key = "FLASH_LOAN_OPERATOR"
        elif lbl == "exchange" or "cex" in flags:
            key = "INSTITUTIONAL_GATEWAY"
        elif "nft" in flags:
            key = "NFT_HIGH_VELOCITY_TRADER"
        else:
            med_slot = addr_hash % 3
            if med_slot == 0:
                key = "FLASH_LOAN_OPERATOR"
            elif med_slot == 1:
                key = "INSTITUTIONAL_GATEWAY"
            else:
                key = "NFT_HIGH_VELOCITY_TRADER"

    # 🔵 Tier 3: Safe / Trusted (< 25%)
    else:
        if "yield" in flags or "staking" in flags:
            key = "BLUE_CHIP_YIELD_FARMER"
        elif "bridge" in flags:
            key = "CROSS_CHAIN_BRIDGE_RELAY"
        elif "arb" in flags or "amm" in flags:
            key = "DEFI_AMM_ARBITRAGEUR"
        elif balance_eth >= 20.0 or lbl == "whale":
            key = "COLD_STORAGE_WHALE_VAULT"
        elif trust_status == "TRUSTED" or days_active >= 45:
            key = "GRADUATED_SENTINEL_USER"
        elif trust_status == "NEW" and tx_count <= 5:
            key = "NEW_ON_RAMP_WALLET"
        else:
            safe_slot = addr_hash % 6
            if safe_slot == 0:
                key = "GRADUATED_SENTINEL_USER"
            elif safe_slot == 1:
                key = "NEW_ON_RAMP_WALLET"
            elif safe_slot == 2:
                key = "BLUE_CHIP_YIELD_FARMER"
            elif safe_slot == 3:
                key = "CROSS_CHAIN_BRIDGE_RELAY"
            elif safe_slot == 4:
                key = "COLD_STORAGE_WHALE_VAULT"
            else:
                key = "DEFI_AMM_ARBITRAGEUR"

    def_data = NODE_KEYWORD_CONFIG.get(key, NODE_KEYWORD_CONFIG["GRADUATED_SENTINEL_USER"])
    color_hex, color_tier = get_color_by_risk_score(score_100)

    return {
        "id": def_data["id"],
        "keyword": def_data["keyword"],
        "icon": def_data["icon"],
        "risk_tier": def_data["risk_tier"],
        "risk_score": round(score_100, 1),
        "risk_score_normalized": round(score_100 / 100.0, 4),
        "color_hex": def_data["default_color_hex"],
        "color_tier": color_tier,
        "plain_english_meaning": def_data["plain_english_meaning"],
        "category": def_data["category"],
        "badge": def_data["badge"],
        "summary": def_data["plain_english_meaning"],
    }
