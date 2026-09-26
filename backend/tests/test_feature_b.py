"""
backend/tests/test_feature_b.py — Automated Unit Tests for Feature B (Graph Exposure Scoring D-P-R)

Test Cases:
1. Hop Distance Decay (D): Direct 1-hop flagged connection yields higher risk contribution than 3-hop connection.
2. Percentage Exposure (P): Computed accurately as (tainted inbound value) / (total inbound value) * 100.
3. Repetition Multiplier (R): Incidental (< 3 interactions in 30d) receives 0.3x multiplier; Sustained (>= 3) receives 1.0x.
"""

import asyncio
import sys
import unittest
from pathlib import Path

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from intelligence.graph_engine.exposure_scorer import (
    GraphExposureScorer,
    DEFAULT_DECAY_FACTOR,
    REPETITION_INCIDENTAL_MULTIPLIER,
    REPETITION_SUSTAINED_MULTIPLIER,
)


class TestFeatureBGraphExposure(unittest.TestCase):

    def setUp(self):
        self.scorer = GraphExposureScorer(decay_factor=0.4)

    def test_case_1_distance_decay_1hop_vs_3hop(self):
        """
        Test 1: Distance Decay (D)
        A direct 1-hop malicious connection must contribute significantly more risk than a 3-hop connection.
        Formula: base_risk * (decay_factor ^ (hops - 1))
        For 1 hop: 0.90 * (0.4 ^ 0) = 0.90
        For 3 hops: 0.90 * (0.4 ^ 2) = 0.90 * 0.16 = 0.144
        """
        wallet_1hop = "0xDIRECT_1HOP_WALLET"
        custom_data_1hop = {
            "paths": [
                {
                    "flagged_address": "0xATTACKER_CLUSTER",
                    "flagged_risk_score": 0.90,
                    "hops": 1,
                    "direction": "inbound",
                    "amount_eth": 5.0,
                    "interaction_count_30d": 1,
                }
            ],
            "total_inbound_eth": 20.0,
        }

        wallet_3hop = "0xDISTANT_3HOP_WALLET"
        custom_data_3hop = {
            "paths": [
                {
                    "flagged_address": "0xATTACKER_CLUSTER",
                    "flagged_risk_score": 0.90,
                    "hops": 3,
                    "direction": "inbound",
                    "amount_eth": 5.0,
                    "interaction_count_30d": 1,
                }
            ],
            "total_inbound_eth": 20.0,
        }

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        score_1hop = loop.run_until_complete(
            self.scorer.compute_exposure_score(wallet_1hop, custom_graph_data=custom_data_1hop)
        )
        score_3hop = loop.run_until_complete(
            self.scorer.compute_exposure_score(wallet_3hop, custom_graph_data=custom_data_3hop)
        )

        self.assertEqual(score_1hop.primary_contributing_hop, 1)
        self.assertEqual(score_3hop.primary_contributing_hop, 3)

        # 1-hop path decayed contribution should be ~0.90, 3-hop should be ~0.144
        self.assertAlmostEqual(score_1hop.paths[0].decayed_contribution, 0.90, places=2)
        self.assertAlmostEqual(score_3hop.paths[0].decayed_contribution, 0.144, places=2)
        self.assertGreater(score_1hop.total_risk_contribution, score_3hop.total_risk_contribution)

        print(f"\n[Test 1 PASS] Hop Decay verified: 1-hop risk={score_1hop.paths[0].decayed_contribution:.3f} vs 3-hop risk={score_3hop.paths[0].decayed_contribution:.3f}")

    def test_case_2_percentage_exposure_calculation(self):
        """
        Test 2: Percentage Exposure (P)
        Wallet received 4 ETH from flagged cluster and 20 ETH total inbound.
        Expected exposure percentage = (4.0 / 20.0) * 100 = 20.0%
        """
        wallet = "0xPERCENT_EXPOSED_WALLET"
        custom_data = {
            "paths": [
                {
                    "flagged_address": "0xATTACKER_CLUSTER",
                    "flagged_risk_score": 0.85,
                    "hops": 2,
                    "direction": "inbound",
                    "amount_eth": 4.0,
                    "interaction_count_30d": 1,
                }
            ],
            "total_inbound_eth": 20.0,
        }

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        score = loop.run_until_complete(
            self.scorer.compute_exposure_score(wallet, custom_graph_data=custom_data)
        )

        self.assertEqual(score.exposure_percentage, 20.0)
        self.assertEqual(score.tainted_inbound_value_eth, 4.0)
        self.assertEqual(score.total_inbound_value_eth, 20.0)

        print(f"\n[Test 2 PASS] Percentage Exposure verified: {score.exposure_percentage}% ({score.tainted_inbound_value_eth} / {score.total_inbound_value_eth} ETH)")

    def test_case_3_repetition_multiplier_incidental_vs_sustained(self):
        """
        Test 3: Repetition Multiplier (R)
        Wallet A: 1 interaction in 30d -> Incidental (0.3x multiplier)
        Wallet B: 4 interactions in 30d -> Sustained (1.0x multiplier)
        """
        wallet_incidental = "0xINCIDENTAL_WALLET"
        custom_data_inc = {
            "paths": [
                {
                    "flagged_address": "0xEXPLOIT_CLUSTER",
                    "flagged_risk_score": 0.90,
                    "hops": 1,
                    "direction": "inbound",
                    "amount_eth": 2.0,
                    "interaction_count_30d": 1, # < 3 -> Incidental
                }
            ],
            "total_inbound_eth": 10.0,
        }

        wallet_sustained = "0xSUSTAINED_WALLET"
        custom_data_sus = {
            "paths": [
                {
                    "flagged_address": "0xEXPLOIT_CLUSTER",
                    "flagged_risk_score": 0.90,
                    "hops": 1,
                    "direction": "inbound",
                    "amount_eth": 2.0,
                    "interaction_count_30d": 4, # >= 3 -> Sustained
                }
            ],
            "total_inbound_eth": 10.0,
        }

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        score_inc = loop.run_until_complete(
            self.scorer.compute_exposure_score(wallet_incidental, custom_graph_data=custom_data_inc)
        )
        score_sus = loop.run_until_complete(
            self.scorer.compute_exposure_score(wallet_sustained, custom_graph_data=custom_data_sus)
        )

        self.assertFalse(score_inc.is_sustained_relationship)
        self.assertEqual(score_inc.paths[0].repetition_multiplier, REPETITION_INCIDENTAL_MULTIPLIER)

        self.assertTrue(score_sus.is_sustained_relationship)
        self.assertEqual(score_sus.paths[0].repetition_multiplier, REPETITION_SUSTAINED_MULTIPLIER)

        # Sustained effective risk should be > 3x higher than incidental
        self.assertGreater(score_sus.paths[0].effective_risk_score, score_inc.paths[0].effective_risk_score * 2.5)

        print(f"\n[Test 3 PASS] Repetition Multiplier: Incidental={score_inc.paths[0].effective_risk_score:.3f} (mult={score_inc.paths[0].repetition_multiplier}) vs Sustained={score_sus.paths[0].effective_risk_score:.3f} (mult={score_sus.paths[0].repetition_multiplier})")


if __name__ == "__main__":
    unittest.main(verbosity=2)
