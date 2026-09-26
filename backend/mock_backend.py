"""
Mock Backend - For testing without Neo4j/Redis
Run: python mock_backend.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import random
import uuid

app = FastAPI(title="Third Eye Mock API")

class BlacklistRequest(BaseModel):
    wallet_address: str
    risk_score: float
    reason: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {"status": "ok", "mode": "mock"}

@app.get("/api/graph/nodes")
async def get_graph_nodes(limit: int = 200):
    """Return graph data for 3D visualization"""
    nodes = []
    for i in range(min(limit, 88)):
        risk_score = (i * 0.73) % 1.0  # Pseudo-random risk score
        flagged = risk_score > 0.8 and i % 7 == 0  # Some flagged nodes
        label_idx = i % 5
        labels = ["defi_user", "bot", "exchange", "whale", "unknown"]
        
        nodes.append({
            "id": f"0x{i:040x}",
            "address": f"0x{i:040x}",
            "label": labels[label_idx],
            "riskScore": risk_score,
            "flagged": flagged,
            "txCount": int(50 + (i * 17) % 300),
            "balanceEth": round((i * 1.5) % 100, 2),
            "x": (i % 10) * 100 - 450,
            "y": (i // 10) * 100 - 250,
            "z": ((i * 7) % 20) * 20 - 200,
        })
    
    # Generate edges between random nodes
    links = []
    for i in range(120):
        source_idx = (i * 7) % len(nodes)
        target_idx = ((i * 13) + 1) % len(nodes)
        if source_idx != target_idx:
            links.append({
                "source": nodes[source_idx]["id"],
                "target": nodes[target_idx]["id"],
                "txHash": f"0x{i:064x}",
                "valueEth": round((i * 0.3) % 50, 2),
            })
    
    return {"nodes": nodes, "links": links}

@app.post("/api/simulate-exploit")
async def simulate_exploit():
    """Simulate an exploit attack for demo purposes"""
    import random
    attacker_addr = f"0x{random.randint(0, 2**160-1):040x}"
    return {
        "result": "exploit_simulated",
        "attacker_address": attacker_addr,
        "ml_score": 0.95 + random.random() * 0.05,
        "affected_wallets": 5,
        "message": "Mock simulation - no real changes"
    }

@app.get("/api/risk-report")
async def risk_report():
    return {
        "total_wallets": 88,
        "flagged": 8,
        "exploits_prevented": 3,
        "threat_level": "medium"
    }

@app.post("/api/shield/blacklist")
async def shield_blacklist(request: BlacklistRequest):
    """Mock endpoint for blacklisting wallets"""
    return {
        "tx_hash": f"0x{uuid.uuid4().hex}",
        "status": "confirmed",
        "wallet_address": request.wallet_address,
        "block_number": 1234567
    }

@app.get("/api/forensic/{wallet_address}")
async def get_forensic_report(wallet_address: str):
    """Get forensic analysis for a wallet"""
    return {
        "wallet": wallet_address,
        "risk_score": 0.85,
        "detected_patterns": ["MEV_sandwich", "flash_loan_attack"],
        "threat_level": "HIGH",
        "recommendation": "BLACKLIST",
        "analysis": "This wallet exhibits patterns consistent with automated attack patterns."
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
