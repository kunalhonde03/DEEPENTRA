"""
backend/database.py — Neo4j Connection Layer with Automatic Real/Fallback Detection
"""

import logging
import os
import random
import secrets
import time
from dotenv import load_dotenv
from neo4j import AsyncGraphDatabase

load_dotenv()

logger = logging.getLogger("Third Eye.database")

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://127.0.0.1:7687")
NEO4J_AUTH_RAW = os.getenv("NEO4J_AUTH", "neo4j/password")
NEO4J_DATABASE = os.getenv("NEO4J_DATABASE", "neo4j")

if "/" in NEO4J_AUTH_RAW:
    _username, _password = NEO4J_AUTH_RAW.split("/", 1)
else:
    _username, _password = "neo4j", "password"
NEO4J_AUTH = (_username, _password)

_driver = None
_using_real_db = False


class InMemoryResult:
    def __init__(self, records: list[dict]):
        self._records = records
        self._index = 0

    async def data(self) -> list[dict]:
        return self._records

    async def single(self) -> dict | None:
        return self._records[0] if self._records else None

    def __aiter__(self):
        self._index = 0
        return self

    async def __anext__(self) -> dict:
        if self._index < len(self._records):
            res = self._records[self._index]
            self._index += 1
            return res
        raise StopAsyncIteration


class InMemoryGraphStore:
    def __init__(self):
        self.nodes: dict[str, dict] = {}
        self.links: list[dict] = []
        self._seed_initial_data()

    def _seed_initial_data(self):
        hex_chars = "0123456789abcdef"
        labels = ["defi_user", "whale", "bot", "exchange", "attacker"]
        
        # Generate 200 initial nodes
        for i in range(200):
            addr = "0x" + "".join(random.choices(hex_chars, k=40))
            is_high_risk = random.random() < 0.15
            risk_score = round(random.uniform(0.76, 0.98) if is_high_risk else random.uniform(0.01, 0.55), 4)
            label = random.choice(labels) if not is_high_risk else random.choice(["bot", "attacker"])
            
            self.nodes[addr] = {
                "address": addr,
                "label": label,
                "risk_score": risk_score,
                "flagged": risk_score >= 0.75,
                "tx_count": random.randint(5, 1200),
                "balance_eth": round(random.uniform(0.1, 450.0), 4),
                "injected": False,
                "last_seen": time.time()
            }

        addresses = list(self.nodes.keys())
        # Generate 350 links
        for _ in range(350):
            src = random.choice(addresses)
            tgt = random.choice(addresses)
            if src != tgt:
                self.links.append({
                    "source": src,
                    "target": tgt,
                    "tx_hash": "0x" + "".join(random.choices(hex_chars, k=64)),
                    "value_eth": round(random.uniform(0.01, 25.0), 4),
                    "gas_used": random.randint(21000, 300000)
                })

    async def execute_query(self, cypher: str, parameters: dict | None = None) -> InMemoryResult:
        params = parameters or {}
        cypher_clean = cypher.strip()

        # 1. Delete injected
        if "MATCH (w:Wallet {injected: true}) DETACH DELETE w" in cypher_clean:
            injected_addrs = {a for a, n in self.nodes.items() if n.get("injected")}
            for addr in injected_addrs:
                self.nodes.pop(addr, None)
            self.links = [l for l in self.links if l["source"] not in injected_addrs and l["target"] not in injected_addrs]
            return InMemoryResult([])

        # 2. Get graph nodes
        if "MATCH (w:Wallet)" in cypher_clean and "UNWIND raw_nodes" in cypher_clean:
            limit = params.get("limit", 200)
            sorted_nodes = sorted(self.nodes.values(), key=lambda x: x["risk_score"], reverse=True)
            top_40 = sorted_nodes[:40]
            top_addrs = {n["address"] for n in top_40}
            
            neighbors = set()
            for l in self.links:
                if l["source"] in top_addrs:
                    neighbors.add(l["target"])
                elif l["target"] in top_addrs:
                    neighbors.add(l["source"])
            
            selected_addrs = list(top_addrs | neighbors)[:limit]
            res_nodes = []
            for addr in selected_addrs:
                if addr in self.nodes:
                    n = self.nodes[addr]
                    res_nodes.append({
                        "address": n["address"],
                        "label": n["label"],
                        "riskScore": n["risk_score"],
                        "flagged": n["flagged"],
                        "txCount": n["tx_count"],
                        "balanceEth": n["balance_eth"],
                    })
            return InMemoryResult(res_nodes)

        # 3. Get links for addresses
        if "UNWIND $addresses AS addr" in cypher_clean and "SENT_TO" in cypher_clean:
            addrs = set(params.get("addresses", []))
            res_links = []
            for l in self.links:
                if l["source"] in addrs and l["target"] in addrs:
                    res_links.append({
                        "source": l["source"],
                        "target": l["target"],
                        "txHash": l["tx_hash"],
                        "valueEth": l["value_eth"]
                    })
            return InMemoryResult(res_links)

        # 4. Flag wallet
        if "MATCH (w:Wallet {address: $address})" in cypher_clean and "SET" in cypher_clean:
            addr = params.get("address")
            rs = params.get("risk_score", 0.95)
            if addr in self.nodes:
                self.nodes[addr]["flagged"] = True
                self.nodes[addr]["risk_score"] = rs
                return InMemoryResult([{
                    "address": addr,
                    "risk_score": rs,
                    "flagged": True
                }])
            return InMemoryResult([])

        # 5. Get report wallet info
        if "MATCH (w:Wallet {address: $addr}) RETURN" in cypher_clean:
            addr = params.get("addr")
            if addr in self.nodes:
                n = self.nodes[addr]
                return InMemoryResult([{"rs": n["risk_score"], "lbl": n["label"]}])
            return InMemoryResult([{"rs": 0.75, "lbl": "unknown"}])

        # 6. Inject attacker node
        if "MERGE (w:Wallet {address: $address})" in cypher_clean:
            addr = params.get("address")
            self.nodes[addr] = {
                "address": addr,
                "label": "attacker",
                "risk_score": params.get("risk_score", 0.95),
                "flagged": True,
                "tx_count": params.get("tx_count", 150),
                "balance_eth": params.get("balance", 12.5),
                "injected": True,
                "last_seen": time.time()
            }
            return InMemoryResult([])

        # 7. Get random victims
        if "WHERE w.address <> $addr RETURN w.address AS addr ORDER BY rand() LIMIT 3" in cypher_clean:
            addr = params.get("addr")
            candidates = [a for a in self.nodes.keys() if a != addr]
            victims = random.sample(candidates, min(3, len(candidates)))
            return InMemoryResult([{"addr": v} for v in victims])

        # 8. Create SENT_TO edge from attacker to victim
        if "MATCH (a:Wallet {address: $attacker})" in cypher_clean:
            atk = params.get("attacker")
            vic = params.get("victim")
            if atk in self.nodes and vic in self.nodes:
                self.nodes[vic]["flagged"] = True
                self.nodes[vic]["risk_score"] = 0.88
                self.nodes[vic]["injected"] = True
                self.links.append({
                    "source": atk,
                    "target": vic,
                    "tx_hash": params.get("tx_hash", "0x" + secrets.token_hex(32)),
                    "value_eth": params.get("value", 15.0),
                    "gas_used": params.get("gas", 250000)
                })
            return InMemoryResult([])

        # 9. List anomalies
        if "MATCH (w:Wallet)" in cypher_clean and "w.risk_score >= $min_risk" in cypher_clean:
            min_risk = params.get("min_risk", 0.7)
            anomalies = [
                {
                    "address": n["address"],
                    "label": n["label"],
                    "riskScore": n["risk_score"],
                    "flagged": n["flagged"],
                    "txCount": n["tx_count"],
                    "balanceEth": n["balance_eth"]
                }
                for n in self.nodes.values()
                if n["risk_score"] >= min_risk
            ]
            anomalies.sort(key=lambda x: x["riskScore"], reverse=True)
            return InMemoryResult(anomalies[:100])

        return InMemoryResult([])


_in_memory_store = InMemoryGraphStore()


class InMemorySession:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        pass

    async def run(self, cypher: str, parameters: dict | None = None, **kwargs) -> InMemoryResult:
        params = (parameters or {}).copy()
        params.update(kwargs)
        return await _in_memory_store.execute_query(cypher, params)


class InMemoryDriver:
    def session(self, database: str | None = None):
        return InMemorySession()

    async def verify_connectivity(self) -> bool:
        return True

    async def close(self):
        pass


def get_driver():
    global _driver, _using_real_db
    if _driver is None:
        use_real_neo4j = os.getenv("USE_REAL_NEO4J", "true").lower() in ("true", "1")
        if use_real_neo4j:
            try:
                logger.info("Connecting to real Neo4j Desktop driver → %s", NEO4J_URI)
                _driver = AsyncGraphDatabase.driver(
                    NEO4J_URI,
                    auth=NEO4J_AUTH,
                    max_connection_pool_size=50,
                    connection_timeout=3.0,
                )
                _using_real_db = True
            except Exception as e:
                logger.warning("Failed to create Neo4j driver: %s. Using In-Memory Store.", e)
                _driver = InMemoryDriver()
                _using_real_db = False
        else:
            _driver = InMemoryDriver()
            _using_real_db = False
    return _driver


async def verify_connectivity() -> bool:
    global _driver, _using_real_db
    driver = get_driver()
    if isinstance(driver, InMemoryDriver):
        return True
    try:
        await driver.verify_connectivity()
        logger.info("✅ Successfully connected to Neo4j Desktop database!")
        _using_real_db = True
        return True
    except Exception as exc:
        logger.warning("⚠️ Could not authenticate with Neo4j Desktop (%s). Falling back to In-Memory Graph Store.", exc)
        _driver = InMemoryDriver()
        _using_real_db = False
        return True


async def get_session():
    driver = get_driver()
    return driver.session(database=NEO4J_DATABASE)


async def run_query(cypher: str, parameters: dict | None = None) -> list[dict]:
    async with await get_session() as session:
        result = await session.run(cypher, parameters or {})
        return await result.data()


SCHEMA_CYPHER = [
    "CREATE CONSTRAINT wallet_address_unique IF NOT EXISTS FOR (w:Wallet) REQUIRE w.address IS UNIQUE",
    "CREATE INDEX wallet_risk_score IF NOT EXISTS FOR (w:Wallet) ON (w.risk_score)",
    "CREATE INDEX wallet_flagged IF NOT EXISTS FOR (w:Wallet) ON (w.flagged)",
]


async def apply_schema():
    driver = get_driver()
    if not isinstance(driver, InMemoryDriver):
        try:
            async with driver.session(database=NEO4J_DATABASE) as session:
                for stmt in SCHEMA_CYPHER:
                    await session.run(stmt)
        except Exception as exc:
            logger.warning("Schema application skipped: %s", exc)
