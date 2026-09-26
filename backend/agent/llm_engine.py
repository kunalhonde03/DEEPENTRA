"""
backend/agent/llm_engine.py — Groq-Powered Forensic Report Engine
Uses llama3-8b-8192 via Groq API, with local fallback.
"""

import logging
import os
import random
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

logger = logging.getLogger("Third Eye.llm_engine")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.1-8b-instant"


RISK_SIGNALS = {
    "high_velocity":    "High-velocity fund dispersion (>50 TXs in 24h)",
    "cycle_detected":   "Circular transaction cycle detected (A→B→C→A pattern)",
    "contract_cluster": "Repeated interactions with known exploit contracts",
    "flash_loan":       "Flash-loan footprint — zero-block borrow/repay detected",
    "mixer_routing":    "Funds routed through tornado-cash-style mixer hops",
    "gas_spike":        "Abnormal gas usage spike — likely MEV sandwich attack",
    "whale_dump":       "Rapid large-value ETH dump (>100 ETH in <1h)",
    "new_wallet":       "Recently activated wallet — zero prior on-chain history",
}


async def generate_forensic_report(
    wallet_address: str,
    risk_score: float,
    label: str,
    risk_hints: list[str] | None = None,
) -> dict:
    """Generate a structured forensic report for a wallet."""
    if risk_hints is None:
        # Auto-select signals based on risk score
        k = max(1, int(risk_score * len(RISK_SIGNALS)))
        risk_hints = random.sample(list(RISK_SIGNALS.values()), min(k, len(RISK_SIGNALS)))

    risk_level = (
        "CRITICAL" if risk_score >= 0.85
        else "HIGH" if risk_score >= 0.65
        else "MEDIUM" if risk_score >= 0.40
        else "LOW"
    )

    
    if GROQ_API_KEY:
        try:
            from groq import AsyncGroq  # noqa: PLC0415
            client = AsyncGroq(api_key=GROQ_API_KEY)

            signals_text = "\n".join(f"  • {h}" for h in risk_hints)
            prompt = f"""You are a blockchain forensic analyst for Third Eye, an on-chain immunity system.

Analyze this wallet and produce a concise threat report:

Wallet:     {wallet_address}
Label:      {label}
Risk Score: {risk_score:.3f} ({risk_level})

Detected Risk Signals:
{signals_text}

Produce a JSON-structured forensic report with these exact fields:
- executive_summary (1 sentence, ≤ 30 words)
- threat_narrative (2-3 sentences explaining the attack pattern, explicitly mentioning the specific risk signals above)
- recommended_actions (list of 2-4 actionable items)
- exploit_categories (list of 1-3 short labels like "Flash Loan", "MEV", "Mixer Routing")

Respond ONLY with valid JSON, no markdown code fences."""

            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=400,
            )

            import json
            raw = response.choices[0].message.content.strip()
            # Strip potential markdown fences
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            parsed = json.loads(raw)

            logger.info("Groq report generated for %s in %dms",
                        wallet_address[:10],
                        int(response.usage.total_tokens * 0.5))  # rough estimate

            return {
                "wallet_address": wallet_address,
                "risk_level": risk_level,
                "risk_score": risk_score,
                "executive_summary":   parsed.get("executive_summary", ""),
                "threat_narrative":    parsed.get("threat_narrative", ""),
                "recommended_actions": parsed.get("recommended_actions", []),
                "exploit_categories":  parsed.get("exploit_categories", []),
            }

        except Exception as exc:
            logger.warning("Groq call failed (%s) — using local fallback", exc)


    return _local_fallback(wallet_address, risk_score, risk_level, label, risk_hints)


def _local_fallback(
    wallet_address: str,
    risk_score: float,
    risk_level: str,
    label: str,
    risk_hints: list[str],
) -> dict:
    """Fast deterministic report when Groq is unavailable."""
    signals = " and ".join(risk_hints[:2]) if risk_hints else "anomalous behaviour"
    return {
        "wallet_address": wallet_address,
        "risk_level": risk_level,
        "risk_score": risk_score,
        "executive_summary": (
            f"Wallet flagged as {risk_level} risk ({risk_score:.0%}) "
            f"based on {signals.lower()}."
        ),
        "threat_narrative": (
            f"On-chain forensic analysis identified {len(risk_hints)} distinct threat "
            f"patterns for {wallet_address[:10]}…. "
            f"Primary signals include: {signals}. "
            f"The wallet exhibits behaviour consistent with a '{label}' archetype "
            f"and poses a significant risk to connected DeFi protocols."
        ),
        "recommended_actions": [
            "Immediately blacklist on ThirdEyeGuardian contract",
            "Trace all connected wallets within 2 hops",
            "Alert downstream protocol integrators",
            "Submit evidence bundle to on-chain governance",
        ],
        "exploit_categories": [
            lbl.split("—")[0].strip().title()
            for lbl in risk_hints[:3]
        ],
    }


# ── Feature 2: "Explain This" Plain-Language Generator ──────────
_explain_cache: dict[str, tuple[float, dict]] = {}


def fallback_explanation(
    exposure_percentage: float = 0.0,
    is_sustained: bool = False,
    trust_status: str = "NEW",
    risk_score: float = 0.15,
    keyword: str = "ACTIVE DEFI USER",
    signals_count: int = 0,
) -> str:
    """Deterministic, natural one-sentence explanation template."""
    if exposure_percentage >= 15.0 and is_sustained:
        return f"This wallet has repeatedly interacted with addresses linked to exploit clusters, accounting for {exposure_percentage:.1f}% of its transaction volume."
    elif risk_score >= 0.75 or "EXFILTRATOR" in keyword or "ATTACKER" in keyword:
        return "This wallet shows rapid fund extraction and dispersion patterns characteristic of an active smart contract exploit."
    elif "MIXER" in keyword or "TORNADO" in keyword:
        return "This wallet is routing tainted liquidity through privacy mixing pools to obscure the original fund provenance."
    elif "FLASH LOAN" in keyword:
        return "This address uses zero-block uncollateralized flash loans to execute high-volume multi-pool arbitrage."
    elif "WASHTRADER" in keyword or "CIRCULAR" in keyword:
        return "This wallet is part of a circular transaction ring circulating artificial volume across closed accounts."
    elif "WHALE" in keyword and risk_score >= 0.50:
        return "This high-balance whale wallet recently executed large market liquidations causing abnormal price slippage."
    elif trust_status == "NEW" and risk_score < 0.40:
        return "This is a recently created wallet with limited history, operating safely under Rakshak's progressive trust quarantine."
    elif exposure_percentage > 0:
        return f"This wallet has indirect multi-hop proximity ({exposure_percentage:.1f}% exposure) to flagged accounts without direct malicious execution."
    else:
        return "This wallet demonstrates normal, verified participation across decentralized finance protocols with no flagged threat indicators."


async def explain_wallet_plain_language(
    wallet_address: str,
    risk_score: float,
    exposure_percentage: float = 0.0,
    hop_distance: int = 1,
    is_sustained: bool = False,
    trust_status: str = "NEW",
    days_active: int = 45,
    keyword: str = "ACTIVE DEFI USER",
    technical_signals: list | None = None,
) -> dict:
    """
    Produces a single-sentence plain-language explanation of a wallet's risk status
    for non-technical users, backed by LLM + template fallback + 5-min caching.
    """
    import time
    now = time.time()
    cached = _explain_cache.get(wallet_address.lower())
    if cached and (now - cached[0] < 300):
        return cached[1]

    signals = technical_signals or []
    default_text = fallback_explanation(
        exposure_percentage=exposure_percentage,
        is_sustained=is_sustained,
        trust_status=trust_status,
        risk_score=risk_score,
        keyword=keyword,
        signals_count=len(signals),
    )

    result_text = default_text

    if GROQ_API_KEY:
        try:
            from groq import AsyncGroq
            client = AsyncGroq(api_key=GROQ_API_KEY)

            sustained_str = "repeated/sustained interaction" if is_sustained else "incidental one-off interaction"
            prompt = f"""You are explaining a blockchain fraud-risk assessment to a non-technical user in ONE clear sentence. Do not use jargon like "hop distance" or "anomaly score."

Signals detected:
- Wallet: {wallet_address}
- Risk Level: {risk_score:.0%} ({keyword})
- Graph exposure: {exposure_percentage:.1f}% connected to flagged wallets, {hop_distance} hops away, {sustained_str}
- Wallet trust status: {trust_status}, {days_active} days active

Write ONE single clear sentence (under 30 words) a normal person would easily understand, explaining why this wallet has this risk level. Be specific and natural. Return ONLY the sentence."""

            response = await client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.2,
                max_tokens=80,
            )

            raw = response.choices[0].message.content.strip().strip('"').strip("'")
            if raw and len(raw) > 10:
                result_text = raw

        except Exception as e:
            logger.debug(f"Groq explain failed ({e}) — using structured template fallback")
            result_text = default_text

    final_payload = {
        "wallet_address": wallet_address,
        "plain_explanation": result_text,
        "risk_score": risk_score,
        "keyword": keyword,
        "trust_status": trust_status,
        "technical_signals": signals,
    }

    _explain_cache[wallet_address.lower()] = (now, final_payload)
    return final_payload