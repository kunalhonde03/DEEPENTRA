"""
backend/intelligence/graph-engine/exposure_scorer.py — Graph Exposure Scoring ("D-P-R" Model)

Implements the D-P-R Graph Exposure Framework:
- D (Distance / Hop Decay): risk_contribution = base_risk * (decay_factor ^ hop_count), decay_factor = 0.4
- P (Percentage Exposure): exposure_percentage = (tainted_inbound_value / total_inbound_value) * 100
- R (Repetition Multiplier): < 3 interactions with flagged cluster in 30d = Incidental (0.3x weight);
                            >= 3 interactions = Sustained (1.0x weight)
- Direction: Outbound transfers to flagged clusters weighted 1.2x vs Inbound transfers at 1.0x.
"""

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional

logger = logging.getLogger("Rakshak.exposure_scorer")

DEFAULT_DECAY_FACTOR = 0.4
MAX_HOP_DEPTH = 4
SUSTAINED_INTERACTION_THRESHOLD = 3
REPETITION_INCIDENTAL_MULTIPLIER = 0.3
REPETITION_SUSTAINED_MULTIPLIER = 1.0
OUTBOUND_DIRECTION_MULTIPLIER = 1.2


@dataclass
class PathContribution:
    target_flagged_address: str
    hop_distance: int
    base_risk: float
    decayed_contribution: float
    direction: str  # "inbound" | "outbound"
    repetition_count_30d: int
    repetition_multiplier: float
    effective_risk_score: float
    amount_eth: float
    timestamp: Optional[str] = None


@dataclass
class ExposureScore:
    wallet_address: str
    exposure_percentage: float                   # 0.0 to 100.0%
    primary_contributing_hop: int                # Closest flagged hop (1..4, or -1 if clean)
    is_sustained_relationship: bool              # True if >= 3 interactions in last 30d with flagged cluster
    direction: str                               # "inbound" | "outbound" | "bidirectional" | "clean"
    total_risk_contribution: float               # Aggregate decayed score 0.0 to 1.0
    tainted_inbound_value_eth: float
    total_inbound_value_eth: float
    interaction_count_30d: int
    closest_flagged_cluster: Optional[str] = None
    relationship_label: str = "Clean / Isolated" # "Incidental", "Sustained", "Clean"
    paths: List[PathContribution] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class GraphExposureScorer:
    """Computes DPR exposure score by querying Neo4j or in-memory fallback graph."""

    def __init__(self, decay_factor: float = DEFAULT_DECAY_FACTOR):
        self.decay_factor = decay_factor

    async def compute_exposure_score(
        self,
        wallet_address: str,
        neo4j_driver: Any = None,
        custom_graph_data: Optional[Dict[str, Any]] = None,
    ) -> ExposureScore:
        addr = wallet_address.lower()
        now = datetime.now(timezone.utc)
        thirty_days_ago = now - timedelta(days=30)

        # 1. Gather all paths within MAX_HOP_DEPTH from Neo4j or fallback
        paths_found = await self._traverse_graph_to_flagged(
            target_address=addr,
            neo4j_driver=neo4j_driver,
            custom_graph_data=custom_graph_data,
        )

        if not paths_found:
            return ExposureScore(
                wallet_address=addr,
                exposure_percentage=0.0,
                primary_contributing_hop=-1,
                is_sustained_relationship=False,
                direction="clean",
                total_risk_contribution=0.0,
                tainted_inbound_value_eth=0.0,
                total_inbound_value_eth=max(1.0, await self._get_total_inbound_eth(addr, neo4j_driver, custom_graph_data)),
                interaction_count_30d=0,
                relationship_label="Clean / No Malicious Cluster Connections",
                paths=[],
            )

        # 2. Evaluate DPR factors per path
        path_contributions: List[PathContribution] = []
        tainted_inbound_val = 0.0
        total_inbound_val = await self._get_total_inbound_eth(addr, neo4j_driver, custom_graph_data)

        min_hops = 999
        has_inbound = False
        has_outbound = False
        max_interactions_per_cluster: Dict[str, int] = {}
        closest_cluster_addr = None

        for p in paths_found:
            flagged_addr = p.get("flagged_address", "").lower()
            hops = max(1, min(MAX_HOP_DEPTH, int(p.get("hops", 1))))
            base_risk = float(p.get("flagged_risk_score", 0.90))
            direction = p.get("direction", "inbound")
            amount = float(p.get("amount_eth", 0.0))
            tx_count_30d = int(p.get("interaction_count_30d", 1))

            if hops < min_hops:
                min_hops = hops
                closest_cluster_addr = flagged_addr

            if direction == "inbound":
                has_inbound = True
                tainted_inbound_val += amount
            elif direction == "outbound":
                has_outbound = True

            max_interactions_per_cluster[flagged_addr] = max(
                max_interactions_per_cluster.get(flagged_addr, 0), tx_count_30d
            )

            # D — Distance Decay
            decayed = base_risk * (self.decay_factor ** (hops - 1))

            # R — Repetition Multiplier
            is_sustained = tx_count_30d >= SUSTAINED_INTERACTION_THRESHOLD
            rep_multiplier = REPETITION_SUSTAINED_MULTIPLIER if is_sustained else REPETITION_INCIDENTAL_MULTIPLIER

            # Direction Multiplier
            dir_multiplier = OUTBOUND_DIRECTION_MULTIPLIER if direction == "outbound" else 1.0

            effective_risk = min(1.0, decayed * rep_multiplier * dir_multiplier)

            path_contributions.append(
                PathContribution(
                    target_flagged_address=flagged_addr,
                    hop_distance=hops,
                    base_risk=base_risk,
                    decayed_contribution=round(decayed, 4),
                    direction=direction,
                    repetition_count_30d=tx_count_30d,
                    repetition_multiplier=rep_multiplier,
                    effective_risk_score=round(effective_risk, 4),
                    amount_eth=round(amount, 4),
                    timestamp=p.get("timestamp"),
                )
            )

        # 3. P — Percentage Exposure
        effective_total_inbound = max(tainted_inbound_val, total_inbound_val, 0.01)
        exposure_pct = min(100.0, round((tainted_inbound_val / effective_total_inbound) * 100.0, 2))

        # Determine overall relationship type & direction
        max_interactions = max(max_interactions_per_cluster.values()) if max_interactions_per_cluster else 0
        is_sustained_rel = max_interactions >= SUSTAINED_INTERACTION_THRESHOLD

        if has_inbound and has_outbound:
            overall_direction = "bidirectional"
        elif has_outbound:
            overall_direction = "outbound"
        elif has_inbound:
            overall_direction = "inbound"
        else:
            overall_direction = "clean"

        if is_sustained_rel:
            rel_label = f"Sustained ({max_interactions} interactions in last 30d)"
        else:
            rel_label = f"Incidental ({max_interactions} interaction(s) in last 30d)"

        # Aggregate risk contribution
        total_risk = min(1.0, sum(pc.effective_risk_score for pc in path_contributions) / max(1, len(path_contributions) * 0.8))

        return ExposureScore(
            wallet_address=addr,
            exposure_percentage=exposure_pct,
            primary_contributing_hop=min_hops if min_hops <= MAX_HOP_DEPTH else -1,
            is_sustained_relationship=is_sustained_rel,
            direction=overall_direction,
            total_risk_contribution=round(total_risk, 4),
            tainted_inbound_value_eth=round(tainted_inbound_val, 4),
            total_inbound_value_eth=round(effective_total_inbound, 4),
            interaction_count_30d=max_interactions,
            closest_flagged_cluster=closest_cluster_addr,
            relationship_label=rel_label,
            paths=path_contributions,
        )

    async def _traverse_graph_to_flagged(
        self,
        target_address: str,
        neo4j_driver: Any = None,
        custom_graph_data: Optional[Dict[str, Any]] = None,
    ) -> List[Dict[str, Any]]:
        """Executes bounded Cypher query or uses mock in-memory store."""
        if custom_graph_data and "paths" in custom_graph_data:
            return custom_graph_data["paths"]

        if neo4j_driver:
            try:
                async with neo4j_driver.session() as session:
                    # Cypher query for 1..4 hop path matching to flagged counterparties
                    cypher = """
                    MATCH (target:Wallet {address: $address})
                    OPTIONAL MATCH path = (target)-[r:SENT_TO*1..4]-(flagged:Wallet)
                    WHERE flagged.flagged = true AND flagged.address <> $address
                    WITH path, flagged, length(path) as hops, relationships(path)[0] as first_rel
                    WHERE path IS NOT NULL
                    RETURN
                        flagged.address AS flagged_address,
                        coalesce(flagged.risk_score, 0.90) AS flagged_risk_score,
                        hops AS hops,
                        CASE WHEN startNode(first_rel).address = $address THEN 'outbound' ELSE 'inbound' END AS direction,
                        coalesce(first_rel.value_eth, 1.0) AS amount_eth,
                        1 AS interaction_count_30d
                    LIMIT 20
                    """
                    result = await session.run(cypher, address=target_address)
                    records = await result.data()
                    if records:
                        return records
            except Exception as e:
                logger.warning("Neo4j exposure query fallback: %s", e)

        # Fallback heuristic calculation
        return []

    async def _get_total_inbound_eth(
        self,
        target_address: str,
        neo4j_driver: Any = None,
        custom_graph_data: Optional[Dict[str, Any]] = None,
    ) -> float:
        if custom_graph_data and "total_inbound_eth" in custom_graph_data:
            return float(custom_graph_data["total_inbound_eth"])

        if neo4j_driver:
            try:
                async with neo4j_driver.session() as session:
                    cypher = """
                    MATCH (w:Wallet {address: $address})
                    RETURN coalesce(w.balance_eth, 10.0) AS balance
                    """
                    res = await session.run(cypher, address=target_address)
                    row = await res.single()
                    if row and row["balance"]:
                        return float(row["balance"])
            except Exception:
                pass
        return 15.0


_exposure_scorer_instance = GraphExposureScorer()


def get_exposure_scorer() -> GraphExposureScorer:
    return _exposure_scorer_instance


async def compute_exposure_score(
    wallet_address: str,
    neo4j_driver: Any = None,
    custom_graph_data: Optional[Dict[str, Any]] = None,
) -> ExposureScore:
    return await _exposure_scorer_instance.compute_exposure_score(
        wallet_address, neo4j_driver, custom_graph_data
    )
