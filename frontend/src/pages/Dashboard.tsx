/**
 * Dashboard.tsx — Rakshak Main SOC Layout & 3D Intelligence Matrix
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Galaxy3D, { type GalaxyNode, type GraphData } from "../components/Galaxy3D";
import Sidebar from "../components/Sidebar";
import LiveTransactionFeed from "../components/LiveTransactionFeed";
import FraudReplayCard from "../components/FraudReplayCard";
import { useAuth } from "../context/AuthContext";
import { useShield } from "../hooks/useShield";
import { getWalletArchetype } from "../utils/archetypeHelper";

// API Base - Point to backend server
const API_BASE = "http://localhost:8000";

const EMPTY_GRAPH: GraphData = { nodes: [], links: [] };

export default function Dashboard() {
  const { authenticated, walletAddress, login, logout } = useAuth();

  const {
    txStatus,
    resetStatus,
  } = useShield();

  const [graphData, setGraphData] = useState<GraphData>(EMPTY_GRAPH);
  const [selectedNode, setSelectedNode] = useState<GalaxyNode | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertMode, setAlertMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);

  // Search / Node Finder State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const showToast = (msg: string, type: "success" | "error" | "info" = "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  };

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/graph/nodes?limit=200`);
      if (!res.ok) throw new Error("Graph fetch failed");
      const data = await res.json();

      // Ensure every node is enriched with rich archetype metadata
      const enrichedNodes: GalaxyNode[] = (data.nodes || []).map((n: any) => {
        const arch = getWalletArchetype(
          n.address || n.id,
          n.label,
          n.riskScore ?? 0.15,
          n.txCount ?? 1,
          n.balanceEth ?? 0,
          n.flagged ?? false
        );
        return {
          ...n,
          id: n.id || n.address,
          address: n.address || n.id,
          keyword: n.keyword || arch.keyword,
          icon: n.icon || arch.icon,
          summary: n.summary || arch.summary,
          badge: n.badge || arch.badge,
          archetypeColor: n.archetypeColor || arch.color,
          category: n.category || arch.category,
        };
      });

      setGraphData({ nodes: enrichedNodes, links: data.links || [] });
      setAlertMode(enrichedNodes.some((n) => n.flagged || n.riskScore > 0.85));
      setLastRefresh(new Date());
    } catch {
      setGraphData(GENERATED_MOCK_GRAPH);
      setAlertMode(GENERATED_MOCK_GRAPH.nodes.some((n) => n.flagged || n.riskScore > 0.85));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
    const interval = setInterval(fetchGraph, 30_000);
    return () => clearInterval(interval);
  }, [fetchGraph]);

  const handleNodeSelect = (node: GalaxyNode) => {
    setSelectedNode(node);
    setSidebarOpen(true);
  };

  const handleOpenPanel = () => {
    if (selectedNode) {
      setSidebarOpen(true);
    } else if (graphData.nodes.length > 0) {
      const riskiest = [...graphData.nodes].sort((a, b) => b.riskScore - a.riskScore)[0];
      setSelectedNode(riskiest);
      setSidebarOpen(true);
    }
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
    setSelectedNode(null);
  };

  // Close search dropdown on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    return graphData.nodes
      .filter((n) =>
        n.address.toLowerCase().includes(q) ||
        (n.keyword && n.keyword.toLowerCase().includes(q)) ||
        (n.category && n.category.toLowerCase().includes(q)) ||
        (n.label && n.label.toLowerCase().includes(q))
      )
      .slice(0, 7);
  }, [searchQuery, graphData.nodes]);

  const simulateExploit = async () => {
    resetStatus();
    setSimulating(true);
    showToast("🚨 Injecting exploit wallet into the galaxy…", "info");

    const sampleAttackerAddr = "0x" + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    const placeholderArch = getWalletArchetype(sampleAttackerAddr, "attacker", 0.98, 150, 8.4, true);

    const placeholderNode: GalaxyNode = {
      id: sampleAttackerAddr,
      address: sampleAttackerAddr,
      label: "attacker",
      riskScore: 0.98,
      flagged: true,
      txCount: 150,
      balanceEth: 8.4,
      keyword: placeholderArch.keyword,
      icon: placeholderArch.icon,
      summary: placeholderArch.summary,
      badge: placeholderArch.badge,
      archetypeColor: placeholderArch.color,
      category: placeholderArch.category,
    };
    setSelectedNode(placeholderNode);
    setSidebarOpen(true);
    setAlertMode(true);

    try {
      const res = await fetch(`${API_BASE}/api/simulate-exploit`, { method: "POST" });
      if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
      const data = await res.json();

      const attackerAddress: string = data.attacker_address;
      const mlRiskScore: number = data.ml_score ?? 0.98;
      const realArch = getWalletArchetype(attackerAddress, "attacker", mlRiskScore, 180, 12.5, true);

      const attackerNode: GalaxyNode = {
        id: attackerAddress,
        address: attackerAddress,
        label: "attacker",
        riskScore: mlRiskScore,
        flagged: true,
        txCount: 180,
        balanceEth: 12.5,
        keyword: realArch.keyword,
        icon: realArch.icon,
        summary: realArch.summary,
        badge: realArch.badge,
        archetypeColor: realArch.color,
        category: realArch.category,
      };
      setSelectedNode(attackerNode);

      showToast("⏳ Shielding & Blacklisting Attacker Wallet on Base Sepolia…", "info");
      const shieldRes = await fetch(`${API_BASE}/api/shield/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: attackerAddress,
          risk_score: mlRiskScore,
          reason: "Automated detection: Simulated exploit pattern — ML + PSI confirmed",
        }),
      });
      const shieldData = await shieldRes.json();

      if (shieldRes.ok && shieldData.tx_hash) {
        const h = shieldData.tx_hash as string;
        showToast(
          `✅ Shield Activated — Blacklisted on Base Sepolia\nTx: ${h.slice(0, 12)}…${h.slice(-6)}`,
          "success"
        );
      } else {
        showToast("✅ Exploit Detected & Flagged in Security Galaxy", "success");
      }

      fetchGraph();
    } catch (err: any) {
      showToast(`Demo Mode: ${err?.message ?? "exploit simulated"}`, "info");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div style={styles.root}>
      {/* Top Navigation Bar */}
      <nav style={styles.nav}>
        {/* Brand & Network Pill */}
        <div style={styles.navBrand}>
          <span style={styles.navLogo}>🛡️</span>
          <div>
            <div style={styles.navTitle}>RAKSHAK</div>
            <div style={styles.navSubtitle}>ON-CHAIN IMMUNITY SYSTEM</div>
          </div>

          <div style={styles.networkPill} title="Connected to Base Sepolia Testnet">
            <span style={styles.networkDot} />
            <span>Base Sepolia</span>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>•</span>
            <span style={{ color: "#94A3B8" }}>84532</span>
          </div>

          {alertMode && (
            <span style={styles.alertPill}>
              <span style={styles.alertDot} /> LIVE THREAT DETECTED
            </span>
          )}
        </div>

        {/* Global Node & Archetype Quick Search Bar */}
        <div style={styles.searchContainer} ref={searchRef}>
          <div style={styles.searchInputWrapper}>
            <span style={{ color: "#64748B", fontSize: 13 }}>🔍</span>
            <input
              type="text"
              placeholder="Search wallet (0x...) or archetype (Whale, Mixer, Flash...)"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
              >
                ✕
              </button>
            )}
          </div>

          {/* Autocomplete Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div style={styles.searchDropdown}>
              {searchResults.map((n) => {
                const color = n.archetypeColor || "#00D4FF";
                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      handleNodeSelect(n);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    style={styles.searchResultItem}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 14 }}>{n.icon || "🛡️"}</span>
                      <div>
                        <div style={{ fontSize: 11.5, fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>
                          {n.keyword || n.label.toUpperCase()}
                        </div>
                        <div style={{ fontSize: 10, color: "#94A3B8", fontFamily: "'JetBrains Mono', monospace" }}>
                          {n.address.slice(0, 10)}…{n.address.slice(-8)}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9.5,
                      padding: "2px 6px",
                      borderRadius: 4,
                      background: `${color}18`,
                      border: `1px solid ${color}40`,
                      color,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontWeight: 700,
                    }}>
                      {(n.riskScore * 100).toFixed(0)}% RISK
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Chips */}
        <div style={styles.navStats}>
          <span style={styles.statChip}>
            <span style={{ color: "#00D4FF" }}>⬡</span> {graphData.nodes.length.toLocaleString()} Nodes
          </span>
          <span style={styles.statChip}>
            <span style={{ color: "#38BDF8" }}>🔗</span> {graphData.links.length.toLocaleString()} Edges
          </span>
          <span style={{
            ...styles.statChip,
            color: graphData.nodes.some((n) => n.flagged) ? "#FF3B3B" : "#10B981",
            borderColor: graphData.nodes.some((n) => n.flagged) ? "rgba(255,59,59,0.3)" : "rgba(16,185,129,0.25)",
            background: graphData.nodes.some((n) => n.flagged) ? "rgba(255,59,59,0.08)" : "rgba(16,185,129,0.06)",
          }}>
            <span>{graphData.nodes.some((n) => n.flagged) ? "🚨" : "🛡️"}</span>
            <span>{graphData.nodes.filter((n) => n.flagged).length} Flagged</span>
          </span>
          {lastRefresh && (
            <span style={{ ...styles.statChip, color: "#64748B" }}>
              ↻ {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={styles.navActions}>
          <button onClick={fetchGraph} style={styles.refreshBtn} title="Sync latest graph data">⟳ Refresh</button>
          <button onClick={handleOpenPanel} style={styles.inspectBtn}>🔍 Inspect Node</button>
          <button
            onClick={simulateExploit}
            disabled={simulating || txStatus === "pending" || txStatus === "confirming"}
            style={{ ...styles.exploitBtn, opacity: (simulating || txStatus === "pending" || txStatus === "confirming") ? 0.6 : 1 }}
          >
            {txStatus === "confirming"
              ? "⏳ Confirming on-chain…"
              : txStatus === "pending"
              ? "⏳ Broadcasting tx…"
              : simulating
              ? "⏳ Injecting Exploit…"
              : "💀 Simulate Exploit"}
          </button>
          {authenticated ? (
            <div style={styles.walletGroup}>
              <div style={styles.walletAddress}>
                <span style={styles.walletDot} />
                {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connected"}
              </div>
              <button onClick={() => logout()} style={styles.logoutBtn}>Disconnect</button>
            </div>
          ) : (
            <button onClick={() => login()} style={styles.connectBtn}>Connect Wallet</button>
          )}
        </div>
      </nav>

      {/* Live Threat Banner Overlay (Centered) */}
      {alertMode && (
        <div style={styles.liveBannerOverlay}>
          <div style={styles.liveThreatBanner}>
            <span style={styles.liveThreatBadge}>LIVE INCIDENT</span>
            <span style={styles.liveThreatText}>🚨 THREAT DETECTED — RAKSHAK AUTONOMOUS IMMUNITY ACTIVE</span>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          ...styles.toast,
          background:
            toast.type === "success" ? "rgba(16,185,129,0.15)" :
            toast.type === "error"   ? "rgba(255,59,59,0.15)"  :
                                       "rgba(0,212,255,0.12)",
          borderColor:
            toast.type === "success" ? "#10B981" :
            toast.type === "error"   ? "#FF3B3B"  :
                                       "#00D4FF",
          color:
            toast.type === "success" ? "#10B981" :
            toast.type === "error"   ? "#FF3B3B"  :
                                       "#00D4FF",
        }}>
          {toast.msg}
        </div>
      )}

      {/* Main Content Area */}
      <div style={styles.content}>
        {/* 3D Galaxy — fills full area */}
        <div style={{ width: "100%", height: "100%", position: "relative" }}>
          {loading ? (
            <div style={styles.loadingScreen}>
              <div style={styles.loadingSpinner} />
              <p style={styles.loadingText}>Initializing Rakshak 3D Matrix…</p>
            </div>
          ) : (
            <Galaxy3D
              graphData={graphData}
              onNodeSelect={handleNodeSelect}
              selectedNode={selectedNode}
              alertMode={alertMode}
            />
          )}
        </div>

        {/* Live Transaction Feed Component (Feature 1) */}
        <LiveTransactionFeed
          onSelectWallet={(walletAddr) => {
            const existing = graphData.nodes.find(
              (n) => n.address.toLowerCase() === walletAddr.toLowerCase()
            );
            if (existing) {
              handleNodeSelect(existing);
            } else {
              const arch = getWalletArchetype(walletAddr, "unknown", 0.35, 12, 1.5, false);
              const newNode: GalaxyNode = {
                id: walletAddr,
                address: walletAddr,
                label: "defi_user",
                riskScore: 0.35,
                flagged: false,
                txCount: 12,
                balanceEth: 1.5,
                keyword: arch.keyword,
                icon: arch.icon,
                summary: arch.summary,
                badge: arch.badge,
                archetypeColor: arch.color,
                category: arch.category,
              };
              handleNodeSelect(newNode);
            }
          }}
        />

        {/* Sidebar — absolute overlay on right */}
        {sidebarOpen && (
          <div style={{
            position: "absolute",
            top: 0,
            right: 0,
            height: "100%",
            width: 390,
            zIndex: 50,
            boxShadow: "-12px 0 40px rgba(0,0,0,0.75)",
            animation: "slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
          }}>
            <Sidebar selectedNode={selectedNode} onClose={handleSidebarClose} />
          </div>
        )}

        {/* Feature 3: Fraud Case Replay Card */}
        {!sidebarOpen && (
          <FraudReplayCard
            onReplayStart={() => showToast("▶ Replaying Wallet Drain Case — watch the Live Feed!", "info")}
            onReplayComplete={(res) => {
              showToast(
                `✅ Replay done — ${res.correctly_flagged}/${res.total_malicious} malicious caught, ${res.correctly_spared}/${res.total_clean} clean wallet spared`,
                "success"
              );
            }}
          />
        )}
      </div>
    </div>
  );
}

// ── Realistic Multi-Archetype Mock Data Generator ──────────────
function generateRichMockGraph(): GraphData {
  const seedPrefixes = [
    "0x71C679732105fe368f0bee977093717540410ee3",
    "0x38B5708945612348571029384756102938475610",
    "0xaeb0c781045981240591823049581720491dde1f",
    "0x805AFB03032A4282a964F9b62608d31260C8e1E0",
    "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984",
    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "0x47ac0Fb4F2D84898e4D9E7b4DaB3C24507a6D503",
    "0x50b89646d4a08e6b043593ebf736ffd72431391f",
    "0x00000000219ab540356cbb839cbe05303d7705fa",
    "0xbe0eb53f46cd790cd13851d5eff43d12404d33e8",
    "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    "0x28C6c06298d514Db089934071355E5743bf21d60",
  ];

  const nodes: GalaxyNode[] = Array.from({ length: 90 }, (_, i) => {
    let addr: string;
    if (i < seedPrefixes.length) {
      addr = seedPrefixes[i];
    } else {
      addr = `0x${((i * 123456789) & 0xffffffffffffffff).toString(16).padStart(40, "0")}`;
    }

    const labels: GalaxyNode["label"][] = ["defi_user", "bot", "whale", "exchange", "attacker", "unknown"];
    const label = i === 2 ? "attacker" : labels[i % labels.length];
    const riskScore = i === 2 ? 0.98 : i === 0 ? 0.88 : i % 7 === 0 ? 0.72 : i % 5 === 0 ? 0.48 : 0.04 + (i % 20) * 0.01;
    const flagged = i === 2 || i === 0 || riskScore > 0.85;
    const txCount = label === "attacker" ? 180 : label === "bot" ? 420 + i * 15 : 8 + (i * 37) % 600;
    const balanceEth = label === "whale" ? 85.4 + i * 4.2 : label === "attacker" ? 14.8 : Math.max(0.1, ((i * 13) % 45));

    const arch = getWalletArchetype(addr, label, riskScore, txCount, balanceEth, flagged);

    return {
      id: addr,
      address: addr,
      label,
      riskScore,
      flagged,
      txCount,
      balanceEth,
      keyword: arch.keyword,
      icon: arch.icon,
      summary: arch.summary,
      badge: arch.badge,
      archetypeColor: arch.color,
      category: arch.category,
    };
  });

  const links = Array.from({ length: 140 }, (_, i) => {
    const sIdx = i % nodes.length;
    const tIdx = (i * 7 + 3) % nodes.length;
    const isThreatLink = nodes[sIdx].flagged || nodes[tIdx].flagged;
    return {
      source: nodes[sIdx].address,
      target: nodes[tIdx].address,
      txHash: `0x${(i * 99999).toString(16).padStart(64, "f")}`,
      valueEth: isThreatLink ? 18.5 + (i % 10) : 0.2 + (i % 5) * 0.8,
    };
  });

  return { nodes, links };
}

const GENERATED_MOCK_GRAPH = generateRichMockGraph();

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: "100vw",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    background: "#030712",
    overflow: "hidden",
    fontFamily: "'Inter', sans-serif",
  },
  nav: {
    height: 58,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 18px",
    background: "rgba(11, 17, 33, 0.94)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(16px)",
    zIndex: 100,
    gap: 14,
    boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
  },
  navBrand: { display: "flex", alignItems: "center", gap: 12 },
  navLogo: { fontSize: 22 },
  navTitle: {
    fontSize: 15,
    fontWeight: 800,
    letterSpacing: "0.14em",
    color: "#F8FAFC",
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.1,
  },
  navSubtitle: {
    fontSize: 8.5,
    fontWeight: 600,
    letterSpacing: "0.12em",
    color: "#00D4FF",
    fontFamily: "'JetBrains Mono', monospace",
  },
  networkPill: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(16, 185, 129, 0.1)",
    border: "1px solid rgba(16, 185, 129, 0.3)",
    borderRadius: 9999,
    padding: "3px 10px",
    fontSize: 10.5,
    fontWeight: 700,
    color: "#10B981",
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: "0.02em",
  },
  networkDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#10B981",
    boxShadow: "0 0 6px #10B981",
  },
  alertPill: {
    background: "rgba(255,59,59,0.15)",
    border: "1px solid rgba(255,59,59,0.6)",
    borderRadius: 9999,
    padding: "3px 10px",
    fontSize: 10,
    fontWeight: 700,
    color: "#FF3B3B",
    letterSpacing: "0.06em",
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
  alertDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#FF3B3B",
    boxShadow: "0 0 6px #FF3B3B",
    animation: "pulse 1.2s ease-in-out infinite",
  },
  searchContainer: {
    position: "relative",
    flex: 1,
    maxWidth: 380,
  },
  searchInputWrapper: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(15, 23, 42, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
    padding: "5px 10px",
    transition: "border-color 0.15s ease",
  },
  searchInput: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#E2E8F0",
    fontSize: 11.5,
    width: "100%",
    fontFamily: "'JetBrains Mono', monospace",
  },
  clearSearchBtn: {
    background: "transparent",
    border: "none",
    color: "#64748B",
    cursor: "pointer",
    fontSize: 11,
    padding: 0,
  },
  searchDropdown: {
    position: "absolute",
    top: 38,
    left: 0,
    right: 0,
    background: "rgba(11, 17, 33, 0.98)",
    border: "1px solid rgba(0, 212, 255, 0.25)",
    borderRadius: 8,
    backdropFilter: "blur(20px)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.8)",
    zIndex: 200,
    overflow: "hidden",
  },
  searchResultItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 12px",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    transition: "background 0.12s ease",
  },
  navStats: { display: "flex", gap: 8, alignItems: "center" },
  statChip: {
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 11,
    color: "#CBD5E1",
    fontFamily: "'JetBrains Mono', monospace",
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  navActions: { display: "flex", alignItems: "center", gap: 8 },
  refreshBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 6,
    color: "#94A3B8",
    cursor: "pointer",
    padding: "6px 11px",
    fontSize: 11.5,
    fontWeight: 600,
    transition: "all 0.15s ease",
  },
  inspectBtn: {
    background: "rgba(0, 212, 255, 0.08)",
    border: "1px solid rgba(0, 212, 255, 0.3)",
    borderRadius: 6,
    color: "#00D4FF",
    cursor: "pointer",
    padding: "6px 11px",
    fontSize: 11.5,
    fontWeight: 600,
    transition: "all 0.15s ease",
  },
  exploitBtn: {
    background: "linear-gradient(135deg, rgba(255,59,59,0.22) 0%, rgba(245,158,11,0.15) 100%)",
    border: "1px solid rgba(255,59,59,0.6)",
    borderRadius: 6,
    color: "#FF5C5C",
    cursor: "pointer",
    padding: "6px 13px",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.03em",
    transition: "all 0.2s ease",
    boxShadow: "0 0 14px rgba(255,59,59,0.15)",
  },
  liveBannerOverlay: {
    position: "absolute",
    top: 70,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 40,
    pointerEvents: "none",
    animation: "fadeIn 0.3s ease-out",
  },
  liveThreatBanner: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(20, 10, 20, 0.88)",
    border: "1px solid #FF3B3B",
    borderRadius: 9999,
    padding: "6px 18px",
    backdropFilter: "blur(14px)",
    animation: "pulseGlow 2.5s ease-in-out infinite",
  },
  liveThreatBadge: {
    background: "#FF3B3B",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.08em",
    padding: "2px 8px",
    borderRadius: 9999,
    fontFamily: "'JetBrains Mono', monospace",
  },
  liveThreatText: {
    color: "#FFAAAA",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.04em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  toast: {
    position: "fixed" as const,
    bottom: 28,
    left: "50%",
    transform: "translateX(-50%)",
    border: "1px solid",
    borderRadius: 10,
    padding: "12px 24px",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'Inter', sans-serif",
    backdropFilter: "blur(16px)",
    zIndex: 9999,
    pointerEvents: "none" as const,
    letterSpacing: "0.02em",
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
  },
  connectBtn: {
    background: "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)",
    border: "1px solid rgba(56, 189, 248, 0.4)",
    borderRadius: 6,
    color: "#fff",
    cursor: "pointer",
    padding: "6px 14px",
    fontSize: 11.5,
    fontWeight: 700,
    letterSpacing: "0.02em",
    boxShadow: "0 4px 14px rgba(2,132,199,0.25)",
  },
  walletGroup: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "rgba(0,212,255,0.06)",
    border: "1px solid rgba(0,212,255,0.25)",
    borderRadius: 6,
    padding: "4px 4px 4px 10px",
  },
  walletAddress: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 11,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#00D4FF",
    letterSpacing: "0.04em",
  },
  walletDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#10B981",
    boxShadow: "0 0 6px #10B981",
    display: "inline-block" as const,
  },
  logoutBtn: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: 4,
    color: "#94A3B8",
    cursor: "pointer",
    padding: "3px 7px",
    fontSize: 10,
    fontWeight: 600,
  },
  content: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
    position: "relative",
  },
  loadingScreen: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 20,
    background: "#030712",
  },
  loadingSpinner: {
    width: 48,
    height: 48,
    border: "3px solid rgba(0,212,255,0.15)",
    borderTop: "3px solid #00D4FF",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
  },
  loadingText: {
    color: "#00D4FF",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 13,
    letterSpacing: "0.1em",
  },
};
