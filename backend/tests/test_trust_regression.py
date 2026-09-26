"""
backend/tests/test_trust_regression.py — Regression Tests for Trust Status Inconsistencies & Reset-On-Read

Tests:
1. Ingestion of 3 transactions across 2 separate weeks.
2. Consecutive /trust-status reads without intermediate activity returning 100% IDENTICAL payloads (No Reset-On-Read).
3. Sum of weekly_activity.transaction_count_this_week strictly equals transaction_count (No Aggregation Drift).
4. Address normalization (Mixed-case address produces identical match to lowercase address).
"""

import sys
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from intelligence.trust_engine.models import TrustStatus
from intelligence.trust_engine.trust_evaluator import (
    TrustEvaluator,
    normalize_address,
)


class TestTrustRegression(unittest.TestCase):

    def setUp(self):
        self.evaluator = TrustEvaluator()

    def test_regression_no_reset_on_read_and_aggregation_consistency(self):
        """
        Regression Test:
        - Ingest 3 transactions for a wallet across 2 separate weeks.
        - First tx at Day 0 (Week 0)
        - Second tx at Day 2 (Week 0)
        - Third tx at Day 10 (Week 1)
        - Call evaluate_trust_status twice in a row.
        - Verify:
          1. Call 1 and Call 2 return identical days_since_creation and transaction_count (No reset to 0).
          2. transaction_count == 3 in both reads.
          3. transaction_count == sum(weekly_activity tx counts).
        """
        wallet_raw = "0x16B77F66cA7DB5D589cDEA18bc50f1Bef439594D"  # Mixed case
        t0 = datetime(2026, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
        t1 = t0 + timedelta(days=2)   # Week 0
        t2 = t0 + timedelta(days=10)  # Week 1
        t_eval = t0 + timedelta(days=12)

        # Ingest tx 1
        self.evaluator.update_weekly_activity(wallet_raw, transaction_timestamp=t0)
        # Ingest tx 2
        self.evaluator.update_weekly_activity(wallet_raw, transaction_timestamp=t1)
        # Ingest tx 3
        self.evaluator.update_weekly_activity(wallet_raw, transaction_timestamp=t2)

        # Read 1
        read_1 = self.evaluator.evaluate_trust_status(wallet_raw, now=t_eval)

        # Read 2 (Immediately after, with lowercase address)
        wallet_lower = wallet_raw.lower()
        read_2 = self.evaluator.evaluate_trust_status(wallet_lower, now=t_eval)

        # ── Assertions ──────────────────────────────────────────────────
        # 1. No Reset-on-Read: both reads must be identical
        self.assertEqual(read_1.transaction_count, read_2.transaction_count)
        self.assertEqual(read_1.days_since_creation, read_2.days_since_creation)
        self.assertEqual(read_1.weeks_completed, read_2.weeks_completed)
        self.assertEqual(read_1.trust_status, read_2.trust_status)

        # 2. Correct transaction count and days elapsed
        self.assertEqual(read_1.transaction_count, 3)
        self.assertEqual(read_1.days_since_creation, 12)
        self.assertGreater(read_1.days_since_creation, 0)

        # 3. Sum of weekly_activity equals transaction_count
        sum_weekly_txs = sum(w.transaction_count_this_week for w in read_1.weekly_activity)
        self.assertEqual(sum_weekly_txs, read_1.transaction_count)
        self.assertEqual(sum_weekly_txs, 3)

        # 4. Weekly breakdown verification: Week 0 has 2 txs, Week 1 has 1 tx
        self.assertEqual(read_1.weekly_activity[0].transaction_count_this_week, 2)
        self.assertTrue(read_1.weekly_activity[0].has_transaction)
        self.assertEqual(read_1.weekly_activity[1].transaction_count_this_week, 1)
        self.assertTrue(read_1.weekly_activity[1].has_transaction)

        print("\n" + "=" * 60)
        print(" [REGRESSION TEST PASS] No Reset-On-Read & Aggregation Validated")
        print(f" Wallet:             {read_1.wallet_address}")
        print(f" Days Since Incept:  {read_1.days_since_creation}d (Non-zero)")
        print(f" Transaction Count:  {read_1.transaction_count} txs (Matches weekly sum: {sum_weekly_txs})")
        print(f" Week 0 count:       {read_1.weekly_activity[0].transaction_count_this_week} tx")
        print(f" Week 1 count:       {read_1.weekly_activity[1].transaction_count_this_week} tx")
        print("=" * 60 + "\n")

    def test_normalize_address_utility(self):
        """Validates normalize_address handles mixed case, missing 0x prefix, and whitespace."""
        self.assertEqual(normalize_address("0x16B77F66cA7DB5D589cDEA18bc50f1Bef439594D"), "0x16b77f66ca7db5d589cdea18bc50f1bef439594d")
        self.assertEqual(normalize_address("  0XABCDEF  "), "0xabcdef")
        self.assertEqual(normalize_address("1234567890abcdef1234567890abcdef12345678"), "0x1234567890abcdef1234567890abcdef12345678")


if __name__ == "__main__":
    unittest.main(verbosity=2)
