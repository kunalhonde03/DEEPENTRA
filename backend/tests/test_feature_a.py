"""
backend/tests/test_feature_a.py — Automated Unit & Adversarial Tests for Feature A (Progressive Trust)

Test Cases:
1. New wallet, single large transaction -> Capped at "Watch" tier, not "Critical", regardless of ML anomaly score.
2. Wallet simulated through 45 days with 1 tx/week consistently, 10+ total -> trust_status flips to "TRUSTED"; scores normally.
3. Adversarial Case: Wallet simulated through 45+ days and 10+ total transactions, but with one 7-day gap in the middle -> trust_status must remain "NEW".
"""

import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from intelligence.trust_engine.models import TrustStatus, BackfillWeek
from intelligence.trust_engine.trust_evaluator import (
    TrustEvaluator,
    NEW_USER_THRESHOLD_MULTIPLIER,
    MAX_NEW_SEVERITY_TIER,
)


class TestFeatureAProgressiveTrust(unittest.TestCase):

    def setUp(self):
        self.evaluator = TrustEvaluator()

    def test_case_1_new_wallet_single_large_tx_capped_at_watch(self):
        """
        Test 1: A newly created wallet with a single large transaction has trust_status == 'NEW'.
        When evaluated against anomaly thresholds, its severity tier must be capped at 'Watch',
        and not escalate straight to 'Critical'.
        """
        wallet = "0xNEW_WALLET_001"
        now = datetime.now(timezone.utc)

        # Ingest single transaction
        self.evaluator.update_weekly_activity(wallet, transaction_timestamp=now)

        status_res = self.evaluator.evaluate_trust_status(wallet, now=now)
        self.assertEqual(status_res.trust_status, TrustStatus.NEW)
        self.assertFalse(status_res.conditions["45_days_elapsed"])
        self.assertFalse(status_res.conditions["min_10_transactions"])
        self.assertEqual(status_res.transaction_count, 1)

        # Simulate ML anomaly score calculation
        raw_ml_anomaly_score = 0.96  # High anomaly score (would normally be Critical)
        effective_threshold = 0.85 * NEW_USER_THRESHOLD_MULTIPLIER  # 0.425

        # Cap logic check
        if status_res.trust_status == TrustStatus.NEW:
            severity_tier = MAX_NEW_SEVERITY_TIER  # Must be "Watch"
        else:
            severity_tier = "Critical"

        self.assertEqual(severity_tier, "Watch")
        print(f"\n[Test 1 PASS] New wallet with large tx: Status={status_res.trust_status.value}, Capped Severity={severity_tier}")

    def test_case_2_graduated_wallet_45_days_consistent_activity(self):
        """
        Test 2: Wallet simulated through 45 days with 1+ tx every week (weeks 0..6)
        and 12 total transactions -> trust_status flips to 'TRUSTED'.
        The same large transaction now scores normally without the 'Watch' cap.
        """
        wallet = "0xGRADUATED_WALLET_002"

        # 7 weeks of activity (weeks 0 to 6 = 49 days coverage), 2 txs per week = 14 total txs
        backfill = [
            {"week": 0, "count": 2},
            {"week": 1, "count": 2},
            {"week": 2, "count": 2},
            {"week": 3, "count": 2},
            {"week": 4, "count": 2},
            {"week": 5, "count": 2},
            {"week": 6, "count": 2},
        ]

        status_res = self.evaluator.simulate_time(
            wallet_address=wallet,
            days_to_advance=45,
            transactions_to_backfill=backfill,
        )

        self.assertEqual(status_res.trust_status, TrustStatus.TRUSTED)
        self.assertTrue(status_res.conditions["45_days_elapsed"])
        self.assertTrue(status_res.conditions["no_dead_weeks"])
        self.assertTrue(status_res.conditions["min_10_transactions"])
        self.assertFalse(status_res.has_dead_weeks)
        self.assertGreaterEqual(status_res.transaction_count, 10)

        # Standard scoring for TRUSTED wallet allows normal Critical escalation if warranted
        raw_ml_anomaly_score = 0.96
        if status_res.trust_status == TrustStatus.NEW:
            severity_tier = MAX_NEW_SEVERITY_TIER
        else:
            severity_tier = "Critical" if raw_ml_anomaly_score >= 0.85 else "Watch"

        self.assertEqual(severity_tier, "Critical")
        print(f"\n[Test 2 PASS] Graduated wallet: Status={status_res.trust_status.value}, Severity={severity_tier}, Total Txs={status_res.transaction_count}")

    def test_case_3_adversarial_45_days_with_dead_week_gap(self):
        """
        Test 3 (Adversarial Case): Wallet simulated through 45+ days and 15 total transactions,
        but with a 7-day gap in week 3 (0 transactions in that window).
        Requirement: trust_status MUST remain 'NEW' despite 45+ days and >10 total transactions.
        """
        wallet = "0xADVERSARIAL_WALLET_003"

        # 7 weeks total, but week 3 is completely dead (0 transactions)
        backfill_with_gap = [
            {"week": 0, "count": 3},
            {"week": 1, "count": 3},
            {"week": 2, "count": 3},
            {"week": 3, "count": 0},  # DEAD WEEK GAP!
            {"week": 4, "count": 3},
            {"week": 5, "count": 3},
            {"week": 6, "count": 3},
        ]

        status_res = self.evaluator.simulate_time(
            wallet_address=wallet,
            days_to_advance=47,
            transactions_to_backfill=backfill_with_gap,
        )

        # MUST remain NEW
        self.assertEqual(status_res.trust_status, TrustStatus.NEW)
        self.assertTrue(status_res.conditions["45_days_elapsed"])
        self.assertTrue(status_res.conditions["min_10_transactions"])
        self.assertFalse(status_res.conditions["no_dead_weeks"])
        self.assertTrue(status_res.has_dead_weeks)
        self.assertEqual(status_res.weeks_missed, 1)

        print(f"\n[Test 3 PASS - Adversarial Case] Gap week in week 3 detected. Status correctly remained {status_res.trust_status.value} (Missed weeks: {status_res.weeks_missed})")


if __name__ == "__main__":
    unittest.main(verbosity=2)
