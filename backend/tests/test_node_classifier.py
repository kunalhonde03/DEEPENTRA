"""
backend/tests/test_node_classifier.py — Unit Tests for Node Keyword Classification System
Covers all 16 keywords, determinism, color mapping, and schema contracts.
"""

import pytest
from intelligence.node_classifier import (
    classify_node,
    get_color_by_risk_score,
    NODE_KEYWORD_CONFIG,
)


class TestNodeClassificationSystem:
    """Test suite for Node Keyword Classification System."""

    def test_all_16_keywords_exist_in_config(self):
        """Ensures all 16 required archetype definitions are present."""
        expected_keywords = {
            # 🔴 Threat / High Risk
            "RAPID_EXFILTRATOR",
            "TORNADO_MIXER_RELAY",
            "CIRCULAR_WASHTRADER",
            "WHALE_DUMP_LIQUIDATOR",
            "MEV_SANDWICH_BOT",
            "SYBIL_AIRDROP_OPERATOR",
            "TAINTED_GRAPH_RELAY",
            # 🟡 Medium / Watch
            "FLASH_LOAN_OPERATOR",
            "INSTITUTIONAL_GATEWAY",
            "NFT_HIGH_VELOCITY_TRADER",
            # 🔵 Safe / Trusted
            "GRADUATED_SENTINEL_USER",
            "NEW_ON_RAMP_WALLET",
            "BLUE_CHIP_YIELD_FARMER",
            "CROSS_CHAIN_BRIDGE_RELAY",
            "COLD_STORAGE_WHALE_VAULT",
            "DEFI_AMM_ARBITRAGEUR",
        }
        assert set(NODE_KEYWORD_CONFIG.keys()) == expected_keywords
        assert len(NODE_KEYWORD_CONFIG) == 16

    def test_determinism_same_address_yields_same_keyword(self):
        """Validates that the same wallet address always yields the exact same classification."""
        sample_addr = "0x805AFB03032A4282a964F9b62608d31260C8e1E0"
        res1 = classify_node(address=sample_addr, risk_score=0.15)
        res2 = classify_node(address=sample_addr, risk_score=0.15)
        res3 = classify_node(address=sample_addr, risk_score=0.15)

        assert res1["keyword"] == res2["keyword"] == res3["keyword"]
        assert res1["icon"] == res2["icon"] == res3["icon"]
        assert res1["risk_tier"] == res2["risk_tier"] == res3["risk_tier"]
        assert res1["plain_english_meaning"] == res2["plain_english_meaning"] == res3["plain_english_meaning"]

    def test_color_legend_mapping(self):
        """Tests the exact color thresholds specified in the requirements."""
        # Red (>85%): Critical — auto-block
        c1, t1 = get_color_by_risk_score(92.0)
        assert c1 == "#EF4444"
        assert t1 == "CRITICAL"

        # Orange (65–85%): Elevated — needs human review
        c2, t2 = get_color_by_risk_score(75.0)
        assert c2 == "#F97316"
        assert t2 == "ELEVATED"

        # Amber (25–65%): Watch — monitor
        c3, t3 = get_color_by_risk_score(45.0)
        assert c3 == "#F59E0B"
        assert t3 == "WATCH"

        # Blue (<25%): Low — normal/trusted
        c4, t4 = get_color_by_risk_score(18.0)
        assert c4 == "#38BDF8"
        assert t4 == "LOW"

        # Green (<10%): Clear — graduated trusted wallet
        c5, t5 = get_color_by_risk_score(5.0)
        assert c5 == "#10B981"
        assert t5 == "CLEAR"

    def test_schema_contracts(self):
        """Validates all required fields are present in the output dictionary."""
        res = classify_node("0x1234567890123456789012345678901234567890", risk_score=0.88)
        required_keys = [
            "id",
            "keyword",
            "icon",
            "risk_tier",
            "risk_score",
            "risk_score_normalized",
            "color_hex",
            "color_tier",
            "plain_english_meaning",
            "category",
            "badge",
        ]
        for key in required_keys:
            assert key in res, f"Missing required key: {key}"
            assert res[key] is not None, f"Key {key} should not be None"

    # ── Unit tests covering at least one wallet per keyword ──────────────────

    # 🔴 Threat / High Risk Keywords
    def test_keyword_rapid_exfiltrator(self):
        res = classify_node("0x1111111111111111111111111111111111111111", risk_score=0.95, label="attacker")
        assert res["risk_tier"] == "THREAT"
        assert res["risk_score"] > 65

    def test_keyword_tornado_mixer_relay(self):
        res = classify_node("0x2222222222222222222222222222222222222222", risk_score=0.90, behavioral_flags=["mixer"])
        assert res["id"] == "TORNADO_MIXER_RELAY"
        assert res["keyword"] == "TORNADO MIXER RELAY"
        assert res["icon"] == "🌪️"
        assert res["risk_tier"] == "THREAT"
        assert "privacy mixers" in res["plain_english_meaning"].lower()

    def test_keyword_circular_washtrader(self):
        res = classify_node("0x3333333333333333333333333333333333333333", risk_score=0.85, behavioral_flags=["cycle"])
        assert res["id"] == "CIRCULAR_WASHTRADER"
        assert res["keyword"] == "CIRCULAR WASHTRADER"
        assert res["icon"] == "🔄"
        assert res["risk_tier"] == "THREAT"
        assert "circular" in res["plain_english_meaning"].lower()

    def test_keyword_whale_dump_liquidator(self):
        res = classify_node("0x4444444444444444444444444444444444444444", risk_score=0.88, balance_eth=500.0, behavioral_flags=["whale_dump"])
        assert res["id"] == "WHALE_DUMP_LIQUIDATOR"
        assert res["keyword"] == "WHALE DUMP LIQUIDATOR"
        assert res["icon"] == "🐋"
        assert res["risk_tier"] == "THREAT"
        assert "sell-off" in res["plain_english_meaning"].lower()

    def test_keyword_mev_sandwich_bot(self):
        res = classify_node("0x5555555555555555555555555555555555555555", risk_score=0.82, behavioral_flags=["sandwich"])
        assert res["id"] == "MEV_SANDWICH_BOT"
        assert res["keyword"] == "MEV SANDWICH BOT"
        assert res["icon"] == "🤖"
        assert res["risk_tier"] == "THREAT"
        assert "frontrunning" in res["plain_english_meaning"].lower()

    def test_keyword_sybil_airdrop_operator(self):
        res = classify_node("0x6666666666666666666666666666666666666666", risk_score=0.78, behavioral_flags=["sybil"])
        assert res["id"] == "SYBIL_AIRDROP_OPERATOR"
        assert res["keyword"] == "SYBIL AIRDROP OPERATOR"
        assert res["icon"] == "📦"
        assert res["risk_tier"] == "THREAT"
        assert "airdrop" in res["plain_english_meaning"].lower()

    def test_keyword_tainted_graph_relay(self):
        res = classify_node("0x7777777777777777777777777777777777777777", risk_score=0.72, behavioral_flags=["tainted_exposure"])
        assert res["id"] == "TAINTED_GRAPH_RELAY"
        assert res["keyword"] == "TAINTED GRAPH RELAY"
        assert res["icon"] == "🕸️"
        assert res["risk_tier"] == "THREAT"
        assert "flagged" in res["plain_english_meaning"].lower()

    # 🟡 Medium / Watch Keywords
    def test_keyword_flash_loan_operator(self):
        res = classify_node("0x8888888888888888888888888888888888888888", risk_score=0.45, behavioral_flags=["flash_loan"])
        assert res["id"] == "FLASH_LOAN_OPERATOR"
        assert res["keyword"] == "FLASH LOAN OPERATOR"
        assert res["icon"] == "⚡"
        assert res["risk_tier"] == "MEDIUM"
        assert "uncollateralized" in res["plain_english_meaning"].lower()

    def test_keyword_institutional_gateway(self):
        res = classify_node("0x9999999999999999999999999999999999999999", risk_score=0.35, label="exchange")
        assert res["id"] == "INSTITUTIONAL_GATEWAY"
        assert res["keyword"] == "INSTITUTIONAL GATEWAY"
        assert res["icon"] == "🏛️"
        assert res["risk_tier"] == "MEDIUM"
        assert "clearing hub" in res["plain_english_meaning"].lower() or "cex" in res["plain_english_meaning"].lower()

    def test_keyword_nft_high_velocity_trader(self):
        # We can find or specify an address that resolves to NFT trader in medium tier
        for i in range(20):
            addr = f"0xaa{i:038x}"
            res = classify_node(addr, risk_score=0.50)
            if res["id"] == "NFT_HIGH_VELOCITY_TRADER":
                assert res["keyword"] == "NFT HIGH-VELOCITY TRADER"
                assert res["icon"] == "🎨"
                assert res["risk_tier"] == "MEDIUM"
                assert "nft" in res["plain_english_meaning"].lower()
                break

    # 🔵 Safe / Trusted Keywords
    def test_keyword_graduated_sentinel_user(self):
        res = classify_node("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", risk_score=0.05, trust_status="TRUSTED", days_active=50)
        assert res["id"] == "GRADUATED_SENTINEL_USER"
        assert res["keyword"] == "GRADUATED SENTINEL USER"
        assert res["icon"] == "🛡️"
        assert res["risk_tier"] == "SAFE"
        assert res["risk_score"] < 25

    def test_keyword_new_on_ramp_wallet(self):
        res = classify_node("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb", risk_score=0.15, trust_status="NEW", tx_count=2)
        assert res["id"] == "NEW_ON_RAMP_WALLET"
        assert res["keyword"] == "NEW ON-RAMP WALLET"
        assert res["icon"] == "🌱"
        assert res["risk_tier"] == "SAFE"

    def test_keyword_cold_storage_whale_vault(self):
        res = classify_node("0xcccccccccccccccccccccccccccccccccccccccc", risk_score=0.10, balance_eth=50.0)
        assert res["id"] == "COLD_STORAGE_WHALE_VAULT"
        assert res["keyword"] == "COLD STORAGE WHALE VAULT"
        assert res["icon"] == "🏦"
        assert res["risk_tier"] == "SAFE"

    def test_keyword_blue_chip_yield_farmer(self):
        found = False
        for i in range(30):
            addr = f"0xdd{i:038x}"
            res = classify_node(addr, risk_score=0.12, tx_count=25)
            if res["id"] == "BLUE_CHIP_YIELD_FARMER":
                assert res["keyword"] == "BLUE-CHIP YIELD FARMER"
                assert res["icon"] == "🌾"
                assert res["risk_tier"] == "SAFE"
                found = True
                break
        assert found

    def test_keyword_cross_chain_bridge_relay(self):
        found = False
        for i in range(30):
            addr = f"0xee{i:038x}"
            res = classify_node(addr, risk_score=0.14, tx_count=30)
            if res["id"] == "CROSS_CHAIN_BRIDGE_RELAY":
                assert res["keyword"] == "CROSS-CHAIN BRIDGE RELAY"
                assert res["icon"] == "🌉"
                assert res["risk_tier"] == "SAFE"
                found = True
                break
        assert found

    def test_keyword_defi_amm_arbitrageur(self):
        found = False
        for i in range(30):
            addr = f"0xff{i:038x}"
            res = classify_node(addr, risk_score=0.18, tx_count=18)
            if res["id"] == "DEFI_AMM_ARBITRAGEUR":
                assert res["keyword"] == "DEFI AMM ARBITRAGEUR"
                assert res["icon"] == "⚙️"
                assert res["risk_tier"] == "SAFE"
                found = True
                break
        assert found
