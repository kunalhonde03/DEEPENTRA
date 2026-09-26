"""
backend/intelligence/risk-engine/enforcement_router.py — Confidence-Aware Hybrid Enforcement Routing

Routing Table:
- Critical + High Confidence -> auto_block (Smart contract fires immediately, reversible via appeal)
- Critical + Low Confidence  -> human_review (Dashboard alert, user/admin decides)
- Elevated (any confidence)  -> human_review (Recommend but do not force action)
- Watch / Low                -> log_only (Audit trail only, visible in dashboard history)
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional

from intelligence.risk_engine.corroboration_gate import SeverityResult

logger = logging.getLogger("Rakshak.enforcement_router")


@dataclass
class EnforcementDecision:
    wallet_address: str
    action: str                                  # "auto_block" | "human_review" | "log_only"
    requires_dashboard_alert: bool
    quarantine_eligible: bool
    recommended_action: str
    severity_tier: str
    confidence_level: str
    signals_triggered: List[str]
    composite_risk_score: float
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def route_enforcement(severity_result: SeverityResult) -> EnforcementDecision:
    """
    Implements the Rakshak Confidence-Aware Hybrid Enforcement Routing Matrix.
    """
    tier = severity_result.severity_tier
    conf = severity_result.confidence_level

    # 1. Critical + High Confidence -> Autonomous Block / Quarantine
    if tier == "Critical" and conf == "High":
        action = "auto_block"
        requires_alert = True
        quarantine_eligible = True
        rec = "Execute autonomous smart contract quarantine/block immediately (reversible on appeal)."

    # 2. Critical + Low Confidence -> Route to Human Review
    elif tier == "Critical" and conf == "Low":
        action = "human_review"
        requires_alert = True
        quarantine_eligible = True
        rec = "Critical score with low historical data density. Operator human review required before blocking."

    # 3. Elevated (any confidence) -> Route to Human Review
    elif tier == "Elevated":
        action = "human_review"
        requires_alert = True
        quarantine_eligible = False
        rec = "Elevated risk detected from single corroborated signal. Human review recommended."

    # 4. Watch or Low -> Log Only
    else:
        action = "log_only"
        requires_alert = False
        quarantine_eligible = False
        rec = "Activity logged in audit trail. No enforcement action required."

    return EnforcementDecision(
        wallet_address=severity_result.wallet_address,
        action=action,
        requires_dashboard_alert=requires_alert,
        quarantine_eligible=quarantine_eligible,
        recommended_action=rec,
        severity_tier=tier,
        confidence_level=conf,
        signals_triggered=severity_result.signals_triggered,
        composite_risk_score=severity_result.composite_risk_score,
    )
