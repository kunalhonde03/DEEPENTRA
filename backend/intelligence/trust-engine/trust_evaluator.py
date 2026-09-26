"""
backend/intelligence/trust-engine/trust_evaluator.py
"""
import sys
from pathlib import Path

# Forward to trust_engine implementation
from intelligence.trust_engine.trust_evaluator import (
    normalize_address,
    TrustEvaluator,
    get_trust_evaluator,
    evaluate_trust_status,
    update_weekly_activity,
    simulate_time,
    NEW_USER_THRESHOLD_MULTIPLIER,
    MAX_NEW_SEVERITY_TIER,
    REQUIRED_AGE_DAYS,
    REQUIRED_TOTAL_TXS,
)

__all__ = [
    "normalize_address",
    "TrustEvaluator",
    "get_trust_evaluator",
    "evaluate_trust_status",
    "update_weekly_activity",
    "simulate_time",
    "NEW_USER_THRESHOLD_MULTIPLIER",
    "MAX_NEW_SEVERITY_TIER",
    "REQUIRED_AGE_DAYS",
    "REQUIRED_TOTAL_TXS",
]
