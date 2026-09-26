"""
Third Eye - Fresh Backend Server
Run: python app.py
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
import uuid

# Create app
app = FastAPI(title="Third Eye API")

# Add CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models
class BlacklistRequest(BaseModel):
    wallet_address: str
    risk_score: float = 0.8
    reason: str = "suspicious activity"

# Routes
@app.get("/health")
async def health():
    return {"status": "ok", "mode": "mock", "version": "1.0"}

@app.get("/")
async def root():
    return {"message": "Third Eye API Running"}

@app.get("/api/graph/nodes")
async def get_graph_nodes(limit: int = 200):
    """Return graph data with 88 nodes and 120 links"""
    nodes = []
    
    # Generate 88 nodes
    for i in range(88):
        risk_score = (i * 0.73) % 1.0
        flagged = risk_score > 0.8 and i % 7 == 0
        labels = ["defi_user", "bot", "exchange", "whale", "unknown"]
        
        node = {
            "id": f"0x{i:040x}",
            "address": f"0x{i:040x}",
            "label": labels[i % 5],
            "riskScore": round(risk_score, 4),
            "flagged": flagged,
            "txCount": int(50 + (i * 17) % 300),
            "balanceEth": round((i * 1.5) % 100, 2),
            "x": (i % 10) * 100 - 450,
            "y": (i // 10) * 100 - 250,
            "z": ((i * 7) % 20) * 20 - 200,
        }
        nodes.append(node)
    
    # Generate 120 links
    links = []
    for i in range(120):
        source_idx = (i * 7) % 88
        target_idx = ((i * 13) + 1) % 88
        
        if source_idx != target_idx:
            link = {
                "source": nodes[source_idx]["id"],
                "target": nodes[target_idx]["id"],
                "txHash": f"0x{i:064x}",
                "valueEth": round((i * 0.3) % 50, 2),
            }
            links.append(link)
    
    return {
        "nodes": nodes,
        "links": links[:120],
        "metadata": {
            "totalNodes": len(nodes),
            "totalEdges": len(links)
        }
    }

@app.get("/api/wallets")
async def get_wallets():
    """Legacy endpoint for wallet data"""
    return {
        "nodes": [
            {
                "id": f"wallet_{i}",
                "address": f"0x{i:040x}",
                "risk_score": 0.3 + (i * 0.05) % 0.7
            }
            for i in range(20)
        ],
        "edges": [
            {"source": f"wallet_{i}", "target": f"wallet_{(i+1) % 20}"}
            for i in range(20)
        ]
    }

@app.post("/api/simulate-exploit")
async def simulate_exploit():
    """Simulate an exploit"""
    return {
        "result": "exploit_simulated",
        "attacker_address": f"0x{random.randint(0, 2**160-1):040x}",
        "ml_score": 0.95 + random.random() * 0.05,
        "affected_wallets": 5,
        "message": "Mock simulation - no real changes"
    }

@app.get("/api/risk-report")
async def risk_report():
    """Get risk statistics"""
    return {
        "total_wallets": 88,
        "flagged": 8,
        "exploits_prevented": 3,
        "threat_level": "medium"
    }

@app.post("/api/shield/blacklist")
async def shield_blacklist(request: BlacklistRequest):
    """Blacklist a wallet"""
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
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
