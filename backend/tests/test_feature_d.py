"""
backend/tests/test_feature_d.py — Automated Unit Tests for Feature D (Hybrid Enforcement & Audit Trail)

Test Cases:
1. Critical + High Confidence -> routes to 'auto_block' (Autonomous on-chain block).
2. Critical + Low Confidence  -> routes to 'human_review' (Dashboard review alert).
3. Elevated (any confidence)  -> routes to 'human_review' (Operator recommendation).
4. Watch / Low                -> routes to 'log_only' (Audit trail only).
5. Audit Trail Logging        -> Immutable decision records logged with signals, confidence, and action.
"""

import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from intelligence.risk_engine.corroboration_gate import SeverityResult
from intelligence.risk_engine.enforcement_router import route_enforcement
from intelligence.audit_manager import AuditTrailManager


class TestFeatureDHybridEnforcement(unittest.TestCase):

    def setUp(self):
        self.temp_audit_path = Path(__file__).parent / "test_audit_temp.json"
        self.audit_mgr = AuditTrailManager(log_path=self.temp_audit_path)

    def tearDown(self):
        if self.temp_audit_path.exists():
            try:
                self.temp_audit_path.unlink()
            except Exception:
                pass

    def test_case_1_critical_high_confidence_auto_block(self):
        """
        Test 1: Critical + High Confidence
        Wallet with >= 20 txs and 2 corroborating signals -> routes directly to 'auto_block'.
        """
        sev = SeverityResult(
            wallet_address="0xCRITICAL_HIGH_CONF_WALLET",
            severity_tier="Critical",
            composite_risk_score=92.0,
            signals_triggered=["amount_velocity_anomaly", "graph_exposure"],
            signals_count=2,
            confidence_level="High",
            trust_status="TRUSTED",
            tier_capped_by_trust=False,
        )

        decision = route_enforcement(sev)
        self.assertEqual(decision.action, "auto_block")
        self.assertTrue(decision.requires_dashboard_alert)
        self.assertTrue(decision.quarantine_eligible)

        print(f"\n[Test 1 PASS] Critical + High Confidence -> Action: '{decision.action}', Quarantine Eligible={decision.quarantine_eligible}")

    def test_case_2_critical_low_confidence_human_review(self):
        """
        Test 2: Critical + Low Confidence
        Wallet with low historical tx density (or thin data) -> routes to 'human_review' instead of auto block.
        """
        sev = SeverityResult(
            wallet_address="0xCRITICAL_LOW_CONF_WALLET",
            severity_tier="Critical",
            composite_risk_score=85.0,
            signals_triggered=["amount_velocity_anomaly", "graph_exposure"],
            signals_count=2,
            confidence_level="Low",  # Low data density
            trust_status="TRUSTED",
            tier_capped_by_trust=False,
        )

        decision = route_enforcement(sev)
        self.assertEqual(decision.action, "human_review")
        self.assertTrue(decision.requires_dashboard_alert)

        print(f"\n[Test 2 PASS] Critical + Low Confidence -> Action: '{decision.action}' (Prevents premature automated blocking)")

    def test_case_3_elevated_routes_to_human_review(self):
        """
        Test 3: Elevated Severity
        Wallet with 1 corroborating signal -> routes to 'human_review'.
        """
        sev = SeverityResult(
            wallet_address="0xELEVATED_WALLET",
            severity_tier="Elevated",
            composite_risk_score=55.0,
            signals_triggered=["amount_velocity_anomaly"],
            signals_count=1,
            confidence_level="High",
            trust_status="TRUSTED",
            tier_capped_by_trust=False,
        )

        decision = route_enforcement(sev)
        self.assertEqual(decision.action, "human_review")
        self.assertTrue(decision.requires_dashboard_alert)

        print(f"\n[Test 3 PASS] Elevated Severity -> Action: '{decision.action}' (Recommends human review)")

    def test_case_4_watch_and_low_routes_to_log_only(self):
        """
        Test 4: Watch / Low Severity
        Wallet with clean or minor status -> routes to 'log_only'.
        """
        sev = SeverityResult(
            wallet_address="0xCLEAN_WALLET",
            severity_tier="Watch",
            composite_risk_score=15.0,
            signals_triggered=[],
            signals_count=0,
            confidence_level="Low",
            trust_status="NEW",
            tier_capped_by_trust=True,
        )

        decision = route_enforcement(sev)
        self.assertEqual(decision.action, "log_only")
        self.assertFalse(decision.requires_dashboard_alert)

        print(f"\n[Test 4 PASS] Watch/Low Severity -> Action: '{decision.action}' (No disruption, audit logged only)")

    def test_case_5_audit_trail_logging_and_retrieval(self):
        """
        Test 5: Cross-Cutting Audit Trail
        Verifies that decisions are logged with full signal metadata, confidence level, and retrieved per wallet.
        """
        wallet = "0xAUDIT_TEST_WALLET_99"
        entry = self.audit_mgr.log_decision(
            wallet_address=wallet,
            severity_tier="Critical",
            confidence_level="High",
            signals_triggered=["amount_velocity_anomaly", "graph_exposure"],
            action_taken="auto_block",
            decided_by="system",
            tx_hash="0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e",
            reason="Autonomous quarantine executed per 2 corroborating signals",
        )

        self.assertEqual(entry.action_taken, "auto_block")
        self.assertEqual(entry.decided_by, "system")

        # Retrieve per wallet
        trail = self.audit_mgr.get_audit_trail_for_wallet(wallet)
        self.assertEqual(len(trail), 1)
        self.assertEqual(trail[0]["wallet_address"], wallet.lower())
        self.assertEqual(trail[0]["severity_tier"], "Critical")
        self.assertEqual(trail[0]["confidence_level"], "High")

        print(f"\n[Test 5 PASS] Decision Audit Trail verified: Logged action '{trail[0]['action_taken']}' for wallet {wallet}")


if __name__ == "__main__":
    unittest.main(verbosity=2)
