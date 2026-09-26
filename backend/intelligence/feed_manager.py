"""
backend/intelligence/feed_manager.py — Live Transaction Feed & WebSocket Broadcast Manager
Rakshak On-Chain Immunity System (Feature 1)
"""

import asyncio
import logging
import random
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from fastapi import WebSocket

logger = logging.getLogger("Rakshak.feed_manager")


class TransactionFeedManager:
    """
    Manages active WebSocket subscribers and broadcasts live transaction events
    across pipeline stages: analyzing -> scored -> complete.
    """

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self._bg_task: Optional[asyncio.Task] = None
        self._history: List[Dict[str, Any]] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total subscribers: {len(self.active_connections)}")
        
        # Send recent transaction history so newly opened dashboard feeds populate immediately
        for item in self._history[-10:]:
            try:
                await websocket.send_json(item)
            except Exception:
                pass

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"WebSocket disconnected. Total subscribers: {len(self.active_connections)}")

    async def broadcast(self, event: Dict[str, Any]):
        """Broadcasts event to all connected clients and stores in rolling history."""
        # Store in rolling history (keep last 30)
        self._history.append(event)
        if len(self._history) > 30:
            self._history.pop(0)

        disconnected = []
        for connection in list(self.active_connections):
            try:
                await connection.send_json(event)
            except Exception as e:
                logger.warning(f"Error sending WebSocket event: {e}")
                disconnected.append(connection)

        for conn in disconnected:
            self.disconnect(conn)


# Global singleton instance
feed_manager = TransactionFeedManager()


async def broadcast_transaction_event(
    tx_hash: str,
    from_wallet: str,
    to_wallet: str,
    stage: str,  # "analyzing" | "scored" | "complete"
    risk_score: Optional[float] = None,
    tier: Optional[str] = None,
    value_eth: float = 0.5,
    keyword: Optional[str] = None,
    category: Optional[str] = None,
    summary: Optional[str] = None,
    action: Optional[str] = None,
):
    """
    Emits an event to all WebSocket clients for live transaction tracking.
    """
    from intelligence.archetype_engine import determine_wallet_keyword_and_summary

    if risk_score is not None:
        if tier is None:
            if risk_score >= 0.75:
                tier = "CRITICAL"
            elif risk_score >= 0.50:
                tier = "ELEVATED"
            elif risk_score >= 0.25:
                tier = "WATCH"
            else:
                tier = "CLEAR"

        if not keyword:
            arch = determine_wallet_keyword_and_summary(
                address=to_wallet or from_wallet,
                risk_score=risk_score,
                flagged=(risk_score >= 0.75),
            )
            keyword = arch["keyword"]
            category = arch["category"]
            summary = arch["summary"]

    payload = {
        "id": f"{tx_hash}_{stage}_{int(time.time() * 1000)}",
        "tx_hash": tx_hash,
        "from_wallet": from_wallet,
        "to_wallet": to_wallet,
        "stage": stage,
        "risk_score": risk_score,
        "tier": tier,
        "keyword": keyword or "DEFI ROUTING",
        "category": category or "Decentralized Liquidity",
        "summary": summary or "Processing on-chain transaction through Rakshak pipeline...",
        "value_eth": round(value_eth, 4),
        "action": action or ("auto_block" if (risk_score and risk_score >= 0.80) else "log_only"),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    await feed_manager.broadcast(payload)


async def process_simulated_transaction_pipeline(
    from_wallet: str,
    to_wallet: str,
    value_eth: float,
    is_malicious: bool = False,
    override_score: Optional[float] = None,
    archetype: Optional[str] = None,
):
    """
    Executes a transaction through the simulated multi-stage pipeline:
    1. Analyzing (ingestion + mempool scan)
    2. Scored (graph exposure + ML Isolation Forest + corroboration gate)
    3. Complete (enforcement router: auto_block vs clear)
    """
    tx_hash = "0x" + "".join(random.choices("0123456789abcdef", k=64))

    # Stage 1: Ingestion & Mempool Pre-flight
    await broadcast_transaction_event(
        tx_hash=tx_hash,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        stage="analyzing",
        value_eth=value_eth,
    )

    await asyncio.sleep(0.45)

    # Stage 2: Scored via Risk Engine
    if override_score is not None:
        risk_score = override_score
    elif is_malicious:
        risk_score = round(random.uniform(0.78, 0.98), 2)
    else:
        risk_score = round(random.uniform(0.04, 0.22), 2)

    tier = "CRITICAL" if risk_score >= 0.75 else "ELEVATED" if risk_score >= 0.50 else "WATCH" if risk_score >= 0.25 else "CLEAR"

    await broadcast_transaction_event(
        tx_hash=tx_hash,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        stage="scored",
        risk_score=risk_score,
        tier=tier,
        value_eth=value_eth,
        keyword=archetype,
    )

    await asyncio.sleep(0.35)

    # Stage 3: Enforcement Routing Complete
    action = "auto_block" if risk_score >= 0.75 else "human_review" if risk_score >= 0.50 else "log_only"

    await broadcast_transaction_event(
        tx_hash=tx_hash,
        from_wallet=from_wallet,
        to_wallet=to_wallet,
        stage="complete",
        risk_score=risk_score,
        tier=tier,
        value_eth=value_eth,
        keyword=archetype,
        action=action,
    )

    return {
        "tx_hash": tx_hash,
        "from_wallet": from_wallet,
        "to_wallet": to_wallet,
        "risk_score": risk_score,
        "tier": tier,
        "action": action,
        "value_eth": value_eth,
    }


# Background live demo transaction generator
async def background_feed_generator():
    """
    Generates realistic, ambient on-chain transaction activity in the background
    so the Live Feed stays alive and engaging during judge presentations.
    """
    logger.info("⚡ Background Live Feed generator started.")
    
    sample_addresses = [
        "0x71C679732105fe368f0bee977093717540410ee3",
        "0x38B5708945612348571029384756102938475610",
        "0xaeb0c781045981240591823049581720491dde1f",
        "0x805AFB03032A4282a964F9b62608d31260C8e1E0",
        "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
        "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
        "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    ]

    while True:
        try:
            # Wait 4.5 to 7.5 seconds between ambient transactions
            await asyncio.sleep(random.uniform(4.5, 7.5))

            from_addr = random.choice(sample_addresses)
            to_addr = random.choice([a for a in sample_addresses if a != from_addr])
            val = round(random.uniform(0.1, 4.8), 3)

            # 20% chance of threat injection for interesting feed variety
            is_mal = (random.random() < 0.20)
            if is_mal:
                val = round(random.uniform(5.5, 24.0), 2)

            await process_simulated_transaction_pipeline(
                from_wallet=from_addr,
                to_wallet=to_addr,
                value_eth=val,
                is_malicious=is_mal,
            )
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.warning(f"Error in background feed generator: {e}")
            await asyncio.sleep(3)
