"""
backend/intelligence/archetype_engine.py — Unique Keyword & Instant Summary Engine
Wraps node_classifier.py as the central classification pipeline.
"""

from typing import Dict, Any, Optional
from intelligence.node_classifier import classify_node, NODE_KEYWORD_CONFIG

ARCHETYPE_RULES = list(NODE_KEYWORD_CONFIG.values())


def determine_wallet_keyword_and_summary(
    address: str,
    label: str = "unknown",
    risk_score: float = 0.15,
    tx_count: int = 1,
    balance_eth: float = 0.0,
    flagged: bool = False,
    exposure_percentage: float = 0.0,
    trust_status: str = "NEW",
    behavioral_flags: Optional[list] = None,
    days_active: int = 0,
) -> Dict[str, Any]:
    """
    Evaluates wallet metrics and assigns a unique, distinct 2-3 word keyword and matching summary.
    Uses deterministic address hashing to guarantee diverse, stable archetype distribution across nodes.
    """
    res = classify_node(
        address=address,
        risk_score=risk_score,
        tx_count=tx_count,
        balance_eth=balance_eth,
        label=label,
        flagged=flagged,
        exposure_percentage=exposure_percentage,
        trust_status=trust_status,
        days_active=days_active,
        behavioral_flags=behavioral_flags,
    )
    return {
        "id": res["id"].lower(),
        "keyword": res["keyword"],
        "icon": res["icon"],
        "badge": res["badge"],
        "summary": res["plain_english_meaning"],
        "plain_english_meaning": res["plain_english_meaning"],
        "category": res["category"],
        "color": res["color_hex"],
        "risk_tier": res["risk_tier"],
        "risk_score": res["risk_score"],
    }
