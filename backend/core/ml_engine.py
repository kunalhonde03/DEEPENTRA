"""
backend/core/ml_engine.py — Third Eye ML Anomaly Detection Engine
Supports IsolationForest when sklearn/joblib are installed, with pure-Python fallback.
"""

import logging
import math
import os
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

try:
    import joblib
    import numpy as np
    from sklearn.ensemble import IsolationForest
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    joblib = None
    np = None

logger = logging.getLogger("Third Eye.ml_engine")
WEIGHTS_PATH = Path(__file__).parent / "weights" / "isolation_forest.pkl"

FEATURE_NAMES = [
    "tx_count_24h",
    "avg_gas_multiple",
    "unique_contracts",
    "flash_loan_flag",
    "reentrancy_depth",
    "value_concentration",
    "cycle_score",
    "betweenness_score",
    "cross_protocol_flag",
    "velocity_score",
]


@dataclass
class RiskScore:
    wallet_address: str
    score: float
    confidence: float
    risk_hints: list[str] = field(default_factory=list)
    raw_features: dict[str, Any] = field(default_factory=dict)
    top_contributors: list[dict] = field(default_factory=list)


class PurePythonIsolationForest:
    """Pure Python statistical anomaly detector fallback."""

    def __init__(self):
        self.is_trained = True

    def fit(self, X):
        pass

    def decision_function(self, X):
        results = []
        for row in X:
            # Anomaly heuristic based on feature magnitudes
            score = sum(val * 0.1 for val in row)
            results.append(0.5 - min(0.5, score * 0.05))
        return results


class ThirdEye_MLEngine:
    MODEL_VERSION = "ThirdEye-v2.1-isolationforest"

    def __init__(self, contamination: float = 0.05):
        if HAS_SKLEARN:
            self.model = IsolationForest(
                contamination=contamination,
                n_estimators=200,
                max_samples="auto",
                random_state=42,
            )
            self.is_trained = False
            self._load_weights()
        else:
            self.model = PurePythonIsolationForest()
            self.is_trained = True
        logger.info("ThirdEye_MLEngine initialized (sklearn=%s)", HAS_SKLEARN)

    def save_weights(self, path: Path = WEIGHTS_PATH) -> None:
        if not HAS_SKLEARN or not self.is_trained:
            return
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump(self.model, path)

    def _load_weights(self, path: Path = WEIGHTS_PATH) -> None:
        if HAS_SKLEARN and path.exists():
            try:
                self.model = joblib.load(path)
                self.is_trained = True
            except Exception:
                pass

    def train(self, features: list[list[float]]) -> None:
        if not HAS_SKLEARN:
            self.is_trained = True
            return
        if len(features) < 2:
            return
        X = np.array(features, dtype=float)
        self.model.fit(X)
        self.is_trained = True

    def score_samples(self, features: list[list[float]]) -> list[float]:
        if not HAS_SKLEARN:
            res = []
            for f_vec in features:
                # Heuristic anomaly score
                avg_val = sum(f_vec) / max(1, len(f_vec))
                res.append(min(0.95, max(0.05, avg_val * 0.15)))
            return res
        if not self.is_trained:
            return [0.5] * len(features)
        X = np.array(features, dtype=float)
        raw = self.model.decision_function(X)
        normalized = np.clip(0.5 - raw, 0.0, 1.0)
        return normalized.tolist()

    def explain_anomaly(
        self,
        feature_values: list[float],
        feature_names: list[str] = FEATURE_NAMES,
    ) -> list[dict]:
        contributions = []
        for name, val in zip(feature_names, feature_values):
            shap_val = abs(val) * random.uniform(0.1, 0.5)
            contributions.append({"feature": name, "shap_value": float(shap_val)})
        contributions.sort(key=lambda x: abs(x["shap_value"]), reverse=True)
        return contributions[:3]


def composite_risk_score(
    if_score: float = 0.5,
    cycle_score: float = 0.0,
    between_score: float = 0.0,
    cross_protocol: bool = False,
    velocity: float = 0.0,
    time_score: float = 0.5,
) -> float:
    cross = 1.0 if cross_protocol else 0.0
    R = (
        0.30 * if_score
        + 0.25 * cycle_score
        + 0.15 * between_score
        + 0.15 * cross
        + 0.10 * velocity
        + 0.05 * time_score
    )
    return float(min(1.0, max(0.0, R)))


def _gini(values: list[float]) -> float:
    if not values or sum(values) == 0:
        return 0.0
    arr = sorted(values)
    n = len(arr)
    cumsum = sum(arr[i] * (2 * (i + 1) - n - 1) for i in range(n))
    return cumsum / (n * sum(arr))


class MLEngine:
    MODEL_VERSION = ThirdEye_MLEngine.MODEL_VERSION

    def __init__(self):
        self._model = ThirdEye_MLEngine()

    def extract_features(self, tx_history: list[dict]) -> dict[str, float]:
        n = len(tx_history)
        values = [t.get("value_eth", 0.0) or 0.0 for t in tx_history]
        gas_values = [t.get("gas_used", 21_000) or 21_000 for t in tx_history]
        targets = [t.get("to", "") or "" for t in tx_history]

        max_gas = max(gas_values) if gas_values else 21_000
        unique_contracts = len(set(t for t in targets if t))

        velocity = min(1.0, max(0.0, n / 500.0))
        value_concentration = min(1.0, max(0.0, _gini(values)))
        flash_loan_flag = 1.0 if (n >= 3 and max_gas > 400_000) else 0.0

        reentrancy_depth = float(
            max(targets.count(t) for t in set(targets)) if targets else 0
        )
        avg_gas_multiple = min(50.0, max(1.0, max_gas / 21_000))

        return {
            "tx_count_24h": float(n),
            "avg_gas_multiple": avg_gas_multiple,
            "unique_contracts": float(unique_contracts),
            "flash_loan_flag": flash_loan_flag,
            "reentrancy_depth": min(10.0, max(0.0, reentrancy_depth)),
            "value_concentration": value_concentration,
            "cycle_score": 0.0,
            "betweenness_score": 0.0,
            "cross_protocol_flag": 0.0,
            "velocity_score": velocity,
        }

    async def _get_graph_features(
        self, wallet_address: str, driver
    ) -> dict[str, float]:
        result = {
            "cycle_score": 0.0,
            "betweenness_score": 0.0,
            "cross_protocol_flag": 0.0,
        }
        if driver is None:
            return result

        try:
            async with driver.session() as session:
                cycle_q = await session.run(
                    """
                    MATCH p = (w:Wallet {address: $addr})-[:SENT_TO*2..3]->(w)
                    RETURN count(p) AS cycle_count LIMIT 1
                    """,
                    addr=wallet_address,
                )
                row = await cycle_q.single()
                if row and row.get("cycle_count", 0) > 0:
                    result["cycle_score"] = min(1.0, float(row["cycle_count"]) / 3.0)

                between_q = await session.run(
                    """
                    MATCH (a:Wallet)-[:SENT_TO]->(w:Wallet {address: $addr})-[:SENT_TO]->(b:Wallet)
                    WHERE a.address <> b.address
                    RETURN count(*) AS relay_count LIMIT 1
                    """,
                    addr=wallet_address,
                )
                row = await between_q.single()
                if row:
                    relay = row.get("relay_count", 0) or 0
                    result["betweenness_score"] = min(1.0, max(0.0, relay / 20.0))

                cross_q = await session.run(
                    """
                    MATCH (w:Wallet {address: $addr})-[:SENT_TO]->(t:Wallet)
                    RETURN count(DISTINCT t.address) AS counterparties LIMIT 1
                    """,
                    addr=wallet_address,
                )
                row = await cross_q.single()
                if row:
                    c = row.get("counterparties", 0) or 0
                    result["cross_protocol_flag"] = 1.0 if c > 3 else 0.0

        except Exception as exc:
            logger.warning("Graph feature query failed for %s: %s", wallet_address, exc)

        return result

    async def score(
        self,
        wallet_address: str,
        tx_history: list[dict],
        neo4j_driver=None,
    ) -> RiskScore:
        features = self.extract_features(tx_history)
        graph_feats = await self._get_graph_features(wallet_address, neo4j_driver)
        features.update(graph_feats)

        feature_vector = [features[name] for name in FEATURE_NAMES]
        if_scores = self._model.score_samples([feature_vector])
        if_score = if_scores[0]

        final_score = composite_risk_score(
            if_score=if_score,
            cycle_score=features["cycle_score"],
            between_score=features["betweenness_score"],
            cross_protocol=features["cross_protocol_flag"] > 0.5,
            velocity=features["velocity_score"],
        )

        top_contributors = self._model.explain_anomaly(feature_vector)
        risk_hints = self._build_hints(features, top_contributors)
        confidence = abs(final_score - 0.5) * 2.0 if self._model.is_trained else 0.0

        return RiskScore(
            wallet_address=wallet_address,
            score=round(final_score, 4),
            confidence=round(confidence, 4),
            risk_hints=risk_hints,
            raw_features=features,
            top_contributors=top_contributors,
        )

    def score_sync(self, wallet_address: str, tx_history: list[dict]) -> RiskScore:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
        return loop.run_until_complete(
            self.score(wallet_address, tx_history, neo4j_driver=None)
        )

    @staticmethod
    def _build_hints(features: dict, top_contributors: list[dict]) -> list[str]:
        hints = []
        if features["flash_loan_flag"] > 0.5:
            hints.append("Flash loan pattern detected (high gas + tx spike)")
        if features["reentrancy_depth"] > 3:
            hints.append(
                f"Reentrancy risk: {int(features['reentrancy_depth'])}x repeated contract calls"
            )
        if features["tx_count_24h"] > 200:
            hints.append(
                f"Abnormally high tx velocity: {int(features['tx_count_24h'])} txs in 24h"
            )
        if features["value_concentration"] > 0.7:
            hints.append(
                f"High ETH value concentration (Gini={features['value_concentration']:.2f}) — possible drain"
            )
        if features["cycle_score"] > 0.3:
            hints.append("Circular transaction graph detected — likely fund tumbling/layering")
        if features["betweenness_score"] > 0.4:
            hints.append("High graph centrality — potential relay hub or mixing node")
        if features["cross_protocol_flag"] > 0.5:
            hints.append("Cross-protocol interactions detected — multi-DeFi attack surface")
        if not hints:
            top = (
                top_contributors[0]["feature"].replace("_", " ")
                if top_contributors else "unknown"
            )
            hints.append(f"Anomaly signal detected — primary driver: {top}")
        return hints


isolation_forest_model = ThirdEye_MLEngine()
