"""
backend/intelligence/risk_engine/corroboration_gate.py — Multi-Signal Corroboration Gate
"""

from dataclasses import dataclass, field, asdict
import logging
from typing import Any, Dict, List, Optional

from intelligence.graph_engine.exposure_scorer import ExposureScore
from intelligence.trust_engine.models import TrustStatus

logger = logging.getLogger("Rakshak.corroboration_gate")

AMOUNT_VELOCITY_ANOMALY_THRESHOLD = 0.70
GRAPH_EXPOSURE_PERCENTAGE_THRESHOLD = 15.0


@dataclass
class SignalDetail:
    category: str
    name: str
    triggered: bool
    score: float
    threshold: float
    description: str
    weight: int


@dataclass
class SeverityResult:
    wallet_address: str
    severity_tier: str                           # "Critical" | "Elevated" | "Watch" | "Low"
    composite_risk_score: float                  # 0.0 to 100.0 (or 0.0 to 1.0)
    signals_triggered: List[str]                 # Names of signals that independently passed threshold
    signals_count: int
    confidence_level: str                        # "High" | "Low" (Feature D)
    trust_status: str                            # "NEW" | "TRUSTED"
    tier_capped_by_trust: bool
    signal_breakdown: List[SignalDetail] = field(default_factory=list)
    recommendation: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def determine_severity_tier(
    wallet_address: str,
    amount_velocity_score: float,
    exposure_score: ExposureScore,
    behavioral_flags: List[str],
    trust_status: str | TrustStatus = TrustStatus.NEW,
    historical_tx_count: int = 0,
) -> SeverityResult:
    status_str = trust_status.value if isinstance(trust_status, TrustStatus) else str(trust_status).upper()
    is_new = status_str == "NEW"

    eff_ml_threshold = AMOUNT_VELOCITY_ANOMALY_THRESHOLD

    # 1. Signal Category 1: Amount / Velocity Anomaly
    sig1_triggered = amount_velocity_score >= eff_ml_threshold
    sig1_detail = SignalDetail(
        category="Amount / Velocity Anomaly",
        name="amount_velocity_anomaly",
        triggered=sig1_triggered,
        score=round(amount_velocity_score, 4),
        threshold=eff_ml_threshold,
        description=f"Isolation Forest anomaly score: {amount_velocity_score:.2f} (threshold: {eff_ml_threshold:.2f})",
        weight=35,
    )

    # 2. Signal Category 2: Graph Exposure (D-P-R)
    exp_pct = exposure_score.exposure_percentage
    is_sustained = exposure_score.is_sustained_relationship
    sig2_triggered = (exp_pct >= GRAPH_EXPOSURE_PERCENTAGE_THRESHOLD) or is_sustained
    sig2_detail = SignalDetail(
        category="Graph Exposure (D-P-R)",
        name="graph_exposure",
        triggered=sig2_triggered,
        score=round(exp_pct, 2),
        threshold=GRAPH_EXPOSURE_PERCENTAGE_THRESHOLD,
        description=f"Graph tainted exposure: {exp_pct:.1f}% | Relationship: {exposure_score.relationship_label}",
        weight=30,
    )

    # 3. Signal Category 3: Behavioral Pattern Match
    known_threat_heuristics = [
        "rapid_fund_movement_post_receipt",
        "known_mixer_interaction",
        "structuring_chain_detected",
        "flash_loan_exploit_pattern",
        "reentrancy_cycle",
        "sandwich_attack",
    ]
    matched_behaviors = [
        f for f in behavioral_flags
        if any(h in f.lower().replace("-", "_").replace(" ", "_") for h in known_threat_heuristics)
    ]
    sig3_triggered = len(matched_behaviors) > 0
    sig3_detail = SignalDetail(
        category="Behavioral Pattern Match",
        name="behavioral_pattern_match",
        triggered=sig3_triggered,
        score=float(len(matched_behaviors)),
        threshold=1.0,
        description=f"Matched signatures: {', '.join(matched_behaviors) if matched_behaviors else 'None'}",
        weight=35,
    )

    signals = [sig1_detail, sig2_detail, sig3_detail]
    triggered_names = [s.name for s in signals if s.triggered]
    signals_count = len(triggered_names)

    if signals_count >= 2:
        raw_tier = "Critical"
    elif signals_count == 1:
        raw_tier = "Elevated"
    else:
        if amount_velocity_score > 0.40 or exp_pct > 5.0 or len(behavioral_flags) > 0:
            raw_tier = "Watch"
        else:
            raw_tier = "Low"

    tier_capped = False
    if is_new and raw_tier in ("Critical", "Elevated"):
        effective_tier = "Watch"
        tier_capped = True
    else:
        effective_tier = raw_tier

    total_txs = max(historical_tx_count, int(exposure_score.total_inbound_value_eth))
    is_high_confidence = (total_txs >= 20) and (signals_count >= 2)
    confidence_level = "High" if is_high_confidence else "Low"

    score_from_signals = sum(s.weight for s in signals if s.triggered)
    composite_score = min(99.0, max(5.0, score_from_signals + (amount_velocity_score * 15.0)))

    if effective_tier == "Critical":
        recommendation = "Immediate autonomous quarantine/block required — corroborated by 2+ independent signals."
    elif effective_tier == "Elevated":
        recommendation = "Review before acting — elevated risk from single corroborating signal category."
    elif tier_capped:
        recommendation = "Protected by Progressive Trust — severity capped at 'Watch' for new wallet."
    elif effective_tier == "Watch":
        recommendation = "Log and monitor — within acceptable tolerance for single anomaly."
    else:
        recommendation = "Clean transaction profile — safe."

    return SeverityResult(
        wallet_address=wallet_address.lower(),
        severity_tier=effective_tier,
        composite_risk_score=round(composite_score, 1),
        signals_triggered=triggered_names,
        signals_count=signals_count,
        confidence_level=confidence_level,
        trust_status=status_str,
        tier_capped_by_trust=tier_capped,
        signal_breakdown=signals,
        recommendation=recommendation,
    )
