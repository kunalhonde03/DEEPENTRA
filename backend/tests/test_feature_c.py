"""
backend/tests/test_feature_c.py — Automated Unit Tests for Feature C (Multi-Signal Corroboration Gate)

Test Cases:
1. Single Signal Alone: Even an extreme ML anomaly score of 0.98 NEVER triggers Critical (must be 'Elevated').
2. Two Independent Signals: ML Anomaly (0.90) + Graph Exposure (22.5%) triggers 'Critical' for a TRUSTED wallet.
3. Trust Cap Rule: The same 2-signal critical payload on a 'NEW' wallet is strictly capped at 'Watch' severity.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from intelligence.graph_engine.exposure_scorer import ExposureScore
from intelligence.risk_engine.corroboration_gate import determine_severity_tier
from intelligence.trust_engine.models import TrustStatus


class TestFeatureCMultiSignalGate(unittest.TestCase):

    def test_case_1_single_signal_alone_never_critical(self):
        """
        Test 1: Single Signal Gate
        Wallet has a high ML anomaly score (0.98) but clean graph exposure (0%) and no behavioral flags.
        Requirement: Must yield 'Elevated' (1 signal triggered), NEVER 'Critical'.
        """
        wallet = "0xSINGLE_SIGNAL_WALLET"
        clean_exposure = ExposureScore(
            wallet_address=wallet,
            exposure_percentage=0.0,
            primary_contributing_hop=-1,
            is_sustained_relationship=False,
            direction="clean",
            total_risk_contribution=0.0,
            tainted_inbound_value_eth=0.0,
            total_inbound_value_eth=50.0,
            interaction_count_30d=0,
            relationship_label="Clean",
            paths=[],
        )

        res = determine_severity_tier(
            wallet_address=wallet,
            amount_velocity_score=0.98,  # Extreme anomaly
            exposure_score=clean_exposure,
            behavioral_flags=[],
            trust_status=TrustStatus.TRUSTED,
            historical_tx_count=25,
        )

        self.assertEqual(res.signals_count, 1)
        self.assertEqual(res.signals_triggered, ["amount_velocity_anomaly"])
        self.assertEqual(res.severity_tier, "Elevated")
        self.assertNotEqual(res.severity_tier, "Critical")

        print(f"\n[Test 1 PASS] Single signal (ML=0.98 alone) yielded '{res.severity_tier}' (1 signal fired). NOT Critical.")

    def test_case_2_two_independent_signals_trigger_critical_for_trusted(self):
        """
        Test 2: Two Independent Signals Corroboration
        Wallet has:
        1. ML amount/velocity anomaly (0.85 >= 0.70 threshold)
        2. Graph exposure (22.5% >= 15.0% threshold)
        For a TRUSTED wallet -> severity tier MUST be 'Critical'.
        """
        wallet = "0xCORROBORATED_CRITICAL_WALLET"
        tainted_exposure = ExposureScore(
            wallet_address=wallet,
            exposure_percentage=22.5,   # > 15% threshold -> triggers Signal 2
            primary_contributing_hop=2,
            is_sustained_relationship=False,
            direction="inbound",
            total_risk_contribution=0.65,
            tainted_inbound_value_eth=4.5,
            total_inbound_value_eth=20.0,
            interaction_count_30d=1,
            relationship_label="Incidental (1 interaction)",
            paths=[],
        )

        res = determine_severity_tier(
            wallet_address=wallet,
            amount_velocity_score=0.85,
            exposure_score=tainted_exposure,
            behavioral_flags=[],
            trust_status=TrustStatus.TRUSTED,
            historical_tx_count=35,
        )

        self.assertEqual(res.signals_count, 2)
        self.assertIn("amount_velocity_anomaly", res.signals_triggered)
        self.assertIn("graph_exposure", res.signals_triggered)
        self.assertEqual(res.severity_tier, "Critical")
        self.assertEqual(res.confidence_level, "High")

        print(f"\n[Test 2 PASS] 2 independent signals on TRUSTED wallet -> Severity='{res.severity_tier}', Confidence='{res.confidence_level}'")

    def test_case_3_two_signals_on_new_wallet_capped_at_watch(self):
        """
        Test 3: Progressive Trust Cap Integration
        Same 2 corroborating signals (ML=0.85 + Exposure=22.5%) applied to a 'NEW' wallet.
        Requirement: Severity tier MUST be capped at 'Watch', preventing auto-block on new users.
        """
        wallet = "0xNEW_USER_CORROBORATED_WALLET"
        tainted_exposure = ExposureScore(
            wallet_address=wallet,
            exposure_percentage=22.5,
            primary_contributing_hop=2,
            is_sustained_relationship=False,
            direction="inbound",
            total_risk_contribution=0.65,
            tainted_inbound_value_eth=4.5,
            total_inbound_value_eth=20.0,
            interaction_count_30d=1,
            relationship_label="Incidental (1 interaction)",
            paths=[],
        )

        res = determine_severity_tier(
            wallet_address=wallet,
            amount_velocity_score=0.85,
            exposure_score=tainted_exposure,
            behavioral_flags=[],
            trust_status=TrustStatus.NEW,  # NEW wallet!
            historical_tx_count=2,
        )

        self.assertEqual(res.signals_count, 2)
        self.assertTrue(res.tier_capped_by_trust)
        self.assertEqual(res.severity_tier, "Watch")
        self.assertNotEqual(res.severity_tier, "Critical")

        print(f"\n[Test 3 PASS] 2 signals on NEW wallet strictly capped by Trust Layer -> Severity='{res.severity_tier}' (Capped=True)")


if __name__ == "__main__":
    unittest.main(verbosity=2)
