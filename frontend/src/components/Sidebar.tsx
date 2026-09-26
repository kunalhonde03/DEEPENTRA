/**
 * frontend/src/components/Sidebar.tsx — Forensic Intelligence Panel
 * Role: UI/Viz Designer (Member 4)
 * Rakshak Threat Detection Dashboard
 */

import React, { useCallback, useEffect, useState } from "react";
import type { GalaxyNode } from "./Galaxy3D";
import TrustProgressWidget from "./TrustProgressWidget";
import ExposureBreakdownPanel from "./ExposureBreakdownPanel";
import RiskDecisionPanel from "./RiskDecisionPanel";
import { getWalletArchetype } from "../utils/archetypeHelper";

const API_BASE = "http://localhost:8000";

// ── Risk color mapping ─────────────────────────────────────────
const RISK_COLORS: Record<string, string> = {
  CRITICAL: "#FF3B3B",
  HIGH: "#FF8C00",
  MEDIUM: "#F59E0B",
  LOW: "#10B981",
};

function scoreToColor(score: number): string {
  if (score > 0.85) return "#FF3B3B";
  if (score > 0.65) return "#FF8C00";
  if (score > 0.40) return "#F59E0B";
  if (score > 0.20) return "#00D4FF";
  return "#10B981";
}

// ── Forensic Report Types ──────────────────────────────────────
interface ForensicReport {
  wallet_address: string;
  risk_level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  risk_score: number;
  executive_summary: string;
  threat_narrative: string;
  recommended_actions: string[];
  exploit_categories: string[];
}

// ── Props ──────────────────────────────────────────────────────
interface SidebarProps {
  selectedNode: GalaxyNode | null;
  onClose: () => void;
}

// ── Component ──────────────────────────────────────────────────
export default function Sidebar({ selectedNode, onClose }: SidebarProps) {
  const [activeTab, setActiveTab] = useState<"trust" | "exposure" | "decision" | "ai">("trust");
  const [report, setReport] = useState<ForensicReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const addrStr = selectedNode?.address || selectedNode?.id || "0x0000000000000000000000000000000000000000";
  const scoreNum = typeof selectedNode?.riskScore === "number" ? selectedNode.riskScore : 0.15;
  const isFlagged = Boolean(selectedNode?.flagged);
  const txCountNum = typeof selectedNode?.txCount === "number" ? selectedNode.txCount : 1;
  const balanceNum = typeof selectedNode?.balanceEth === "number" ? selectedNode.balanceEth : 0.0;

  // Instant deterministic archetype
  const baseArch = getWalletArchetype(addrStr, selectedNode?.label, scoreNum, txCountNum, balanceNum, isFlagged);

  const [archetypeData, setArchetypeData] = useState<{
    keyword?: string;
    icon?: string;
    summary?: string;
    badge?: string;
    color?: string;
    category?: string;
  }>(baseArch);

  // Update archetype immediately when selectedNode changes
  useEffect(() => {
    if (!selectedNode) return;

    if (selectedNode.keyword && selectedNode.summary) {
      setArchetypeData({
        keyword: selectedNode.keyword,
        icon: selectedNode.icon || baseArch.icon,
        summary: selectedNode.summary,
        badge: selectedNode.badge || baseArch.badge,
        color: selectedNode.archetypeColor || baseArch.color,
        category: selectedNode.category || baseArch.category,
      });
      return;
    }

    const freshArch = getWalletArchetype(selectedNode.address, selectedNode.label, scoreNum, txCountNum, balanceNum, isFlagged);
    setArchetypeData(freshArch);

    // Fetch live summary from backend if available
    let active = true;
    fetch(`${API_BASE}/api/wallet/${selectedNode.address}/summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && data.keyword) {
          setArchetypeData({
            keyword: data.keyword,
            icon: data.icon || freshArch.icon,
            summary: data.summary || freshArch.summary,
            badge: data.badge || freshArch.badge,
            color: data.color || freshArch.color,
            category: data.category || freshArch.category,
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [selectedNode, scoreNum, txCountNum, balanceNum, isFlagged]);

  // Reset report on node switch
  useEffect(() => {
    setReport(null);
    setError(null);
    setTxStatus("idle");
    setTxHash(null);
  }, [selectedNode]);

  const handleCopyAddress = () => {
    if (!selectedNode?.address) return;
    navigator.clipboard.writeText(selectedNode.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fetchReport = useCallback(async () => {
    if (!selectedNode) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const res = await fetch(`${API_BASE}/api/forensic/report/${selectedNode.address}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();
      setReport(data);
    } catch (err: any) {
      setError(err?.message ?? "Failed to fetch forensic report");
    } finally {
      setLoading(false);
    }
  }, [selectedNode]);

  const handleShield = useCallback(async () => {
    if (!selectedNode) return;
    setTxStatus("pending");
    setTxHash(null);
    try {
      const shieldRes = await fetch(`${API_BASE}/api/shield/blacklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: selectedNode.address,
          risk_score: selectedNode.riskScore,
          reason: `Rakshak manual shield — ${selectedNode.label} wallet flagged at ${(selectedNode.riskScore * 100).toFixed(1)}% risk`,
        }),
      });
      const data = await shieldRes.json();
      if (!shieldRes.ok) throw new Error(data.detail ?? `HTTP ${shieldRes.status}`);

      await fetch(`${API_BASE}/api/graph/flag`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: selectedNode.address,
          risk_score: selectedNode.riskScore,
        }),
      });

      setTxHash(data.tx_hash ?? null);
      setTxStatus("success");
    } catch (err: any) {
      console.error("Shield failed:", err?.message);
      setTxStatus("error");
    }
  }, [selectedNode]);

  if (!selectedNode) {
    return (
      <aside style={styles.sidebar}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40 }}>🌌</div>
          <p style={styles.emptyText}>
            Click any node in the galaxy to inspect trust status, keyword archetype, and risk exposure.
          </p>
        </div>
      </aside>
    );
  }

  const riskColor = scoreToColor(scoreNum);
  const kwColor = archetypeData.color || (scoreNum > 0.65 ? "#FF3B3B" : "#00D4FF");
  const kwIcon = archetypeData.icon || (scoreNum > 0.65 ? "⚡" : "🛡️");
  const kwName = archetypeData.keyword || "ACTIVE DEFI USER";
  const kwSummary = archetypeData.summary || "Standard verified participant interacting regularly with decentralized contracts.";
  const kwCategory = archetypeData.category || "On-Chain Participant";

  return (
    <aside style={styles.sidebar}>
      {/* Identity Card Header */}
      <div style={styles.header}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div
              style={{
                ...styles.riskBadge,
                background: riskColor + "22",
                color: riskColor,
                border: `1px solid ${riskColor}80`,
                boxShadow: `0 0 14px ${riskColor}35`,
              }}
            >
              {scoreNum > 0.85
                ? "🚨 CRITICAL THREAT"
                : scoreNum > 0.65
                  ? "⚠️ HIGH RISK"
                  : scoreNum > 0.40
                    ? "● MEDIUM WATCH"
                    : "✓ VERIFIED SAFE"}{" "}
              &nbsp;·&nbsp; {(scoreNum * 100).toFixed(1)}%
            </div>
            <button onClick={onClose} style={styles.closeBtn} title="Close Inspector">✕</button>
          </div>

          {/* Address with 1-Click Copy */}
          <div style={styles.addressRow}>
            <span style={styles.walletAddress}>
              {addrStr.length > 16 ? `${addrStr.slice(0, 10)}…${addrStr.slice(-8)}` : addrStr}
            </span>
            <button
              onClick={handleCopyAddress}
              style={{
                ...styles.copyBtn,
                color: copied ? "#10B981" : "#94A3B8",
                borderColor: copied ? "#10B981" : "rgba(255,255,255,0.12)",
              }}
              title="Copy wallet address"
            >
              {copied ? "✓ Copied" : "📋 Copy"}
            </button>
          </div>

          {/* Quick Metrics Bar */}
          <div style={styles.quickMetricsRow}>
            <div style={styles.quickMetric}>
              <span style={styles.quickMetricKey}>BALANCE</span>
              <span style={styles.quickMetricVal}>{balanceNum.toFixed(2)} ETH</span>
            </div>
            <div style={styles.quickMetric}>
              <span style={styles.quickMetricKey}>ACTIVITY</span>
              <span style={styles.quickMetricVal}>{txCountNum.toLocaleString()} Txs</span>
            </div>
            <div style={styles.quickMetric}>
              <span style={styles.quickMetricKey}>STATUS</span>
              <span style={{
                ...styles.quickMetricVal,
                color: isFlagged ? "#FF5C5C" : "#10B981",
              }}>
                {isFlagged ? "FLAGGED" : "CLEAN"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Dynamic Archetype Card */}
      <div
        style={{
          background: `linear-gradient(135deg, ${kwColor}18 0%, rgba(15,23,42,0.96) 100%)`,
          borderLeft: `4px solid ${kwColor}`,
          borderTop: `1px solid ${kwColor}45`,
          borderRight: `1px solid ${kwColor}45`,
          borderBottom: `1px solid ${kwColor}45`,
          borderRadius: 10,
          padding: "13px 15px",
          margin: "0 16px 12px 16px",
          boxShadow: `0 8px 24px -6px ${kwColor}25`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 800,
              color: kwColor,
              letterSpacing: "0.04em",
              display: "flex",
              alignItems: "center",
              gap: 7,
              textTransform: "uppercase",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            <span style={{ fontSize: 17 }}>{kwIcon}</span>
            <span>{kwName}</span>
          </div>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 700,
              color: "#94A3B8",
              backgroundColor: "rgba(30,41,59,0.85)",
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.08)",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {kwCategory}
          </span>
        </div>

        <div style={{
          fontSize: 9.5,
          fontWeight: 700,
          color: "#38BDF8",
          letterSpacing: "0.06em",
          marginBottom: 4,
          fontFamily: "'JetBrains Mono', monospace",
          display: "flex",
          alignItems: "center",
          gap: 5,
        }}>
          <span>📖</span> PLAIN ENGLISH MEANING
        </div>

        <p
          style={{
            fontSize: 12,
            color: "#F1F5F9",
            lineHeight: 1.55,
            margin: 0,
            fontWeight: 400,
            background: "rgba(0, 0, 0, 0.2)",
            padding: "8px 10px",
            borderRadius: 6,
            borderLeft: `2px solid ${kwColor}`,
          }}
        >
          {kwSummary}
        </p>
      </div>

      {/* Modern Pill Tabs Row */}
      <div style={styles.tabNav}>
        <button
          onClick={() => setActiveTab("trust")}
          style={{
            ...styles.tabBtn,
            background: activeTab === "trust" ? "rgba(0, 212, 255, 0.16)" : "transparent",
            borderColor: activeTab === "trust" ? "#00D4FF" : "transparent",
            color: activeTab === "trust" ? "#00D4FF" : "#94A3B8",
            fontWeight: activeTab === "trust" ? 700 : 500,
          }}
        >
          🛡️ Trust
        </button>
        <button
          onClick={() => setActiveTab("exposure")}
          style={{
            ...styles.tabBtn,
            background: activeTab === "exposure" ? "rgba(0, 212, 255, 0.16)" : "transparent",
            borderColor: activeTab === "exposure" ? "#00D4FF" : "transparent",
            color: activeTab === "exposure" ? "#00D4FF" : "#94A3B8",
            fontWeight: activeTab === "exposure" ? 700 : 500,
          }}
        >
          🕸️ Exposure
        </button>
        <button
          onClick={() => setActiveTab("decision")}
          style={{
            ...styles.tabBtn,
            background: activeTab === "decision" ? "rgba(0, 212, 255, 0.16)" : "transparent",
            borderColor: activeTab === "decision" ? "#00D4FF" : "transparent",
            color: activeTab === "decision" ? "#00D4FF" : "#94A3B8",
            fontWeight: activeTab === "decision" ? 700 : 500,
          }}
        >
          ⚖️ Decision
        </button>
        <button
          onClick={() => setActiveTab("ai")}
          style={{
            ...styles.tabBtn,
            background: activeTab === "ai" ? "rgba(0, 212, 255, 0.16)" : "transparent",
            borderColor: activeTab === "ai" ? "#00D4FF" : "transparent",
            color: activeTab === "ai" ? "#00D4FF" : "#94A3B8",
            fontWeight: activeTab === "ai" ? 700 : 500,
          }}
        >
          🔍 Forensics
        </button>
      </div>

      {/* Tab Panels */}
      <div style={styles.tabContent}>
        {activeTab === "trust" && (
          <TrustProgressWidget
            walletAddress={selectedNode.address}
          />
        )}

        {activeTab === "exposure" && (
          <ExposureBreakdownPanel
            walletAddress={selectedNode.address}
          />
        )}

        {activeTab === "decision" && (
          <RiskDecisionPanel
            walletAddress={selectedNode.address}
          />
        )}

        {activeTab === "ai" && (
          <>
            <div style={styles.statsRow}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{selectedNode.txCount?.toLocaleString() ?? 0}</div>
                <div style={styles.statLabel}>TRANSACTIONS</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{selectedNode.balanceEth?.toFixed(3) ?? "0.000"}</div>
                <div style={styles.statLabel}>BALANCE ETH</div>
              </div>
              <div style={styles.statCard}>
                <div style={{ ...styles.statValue, color: riskColor }}>
                  {(scoreNum * 100).toFixed(0)}%
                </div>
                <div style={styles.statLabel}>RISK SCORE</div>
              </div>
            </div>

            {/* AI Forensic Section */}
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>🔍 AI EXPLAINABILITY REPORT</span>
                <button
                  onClick={fetchReport}
                  disabled={loading}
                  style={styles.analyzeBtn}
                >
                  {loading ? "Analyzing…" : "Run Gemini AI"}
                </button>
              </div>

              {error && <div style={styles.errorBox}>{error}</div>}

              {report ? (
                <div>
                  <div
                    style={{
                      ...styles.riskLevelBanner,
                      borderColor: RISK_COLORS[report.risk_level] ?? "#94A3B8",
                      color: RISK_COLORS[report.risk_level] ?? "#94A3B8",
                    }}
                  >
                    ⚠ {report.risk_level} RISK
                  </div>
                  <p style={styles.summaryText}>{report.executive_summary}</p>
                  <div style={styles.narrativeBox}>
                    <p style={styles.narrativeText}>{report.threat_narrative}</p>
                  </div>
                  {report.recommended_actions.length > 0 && (
                    <div style={styles.actionsSection}>
                      <div style={styles.actionsTitle}>Recommended Actions</div>
                      <ul style={styles.actionsList}>
                        {report.recommended_actions.map((action, i) => (
                          <li key={i} style={styles.actionItem}>→ {action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                !loading && (
                  <p style={styles.hintText}>
                    Click "Run Gemini AI" to generate a forensic threat narrative for this wallet.
                  </p>
                )
              )}
            </div>

            {/* Shield Action */}
            <div style={styles.shieldSection}>
              <button
                onClick={handleShield}
                disabled={txStatus === "pending"}
                style={{
                  ...styles.shieldBtn,
                  opacity: txStatus === "pending" ? 0.6 : 1,
                  cursor: txStatus === "pending" ? "wait" : "pointer",
                }}
              >
                {txStatus === "pending" && "⏳ Confirming on Base Sepolia…"}
                {txStatus === "success" && "✅ Shield Active — Blacklisted On-Chain"}
                {txStatus === "error" && "❌ Failed — Check console & retry"}
                {txStatus === "idle" && "🛡 Activate Guardian Shield"}
              </button>
              {txHash && (
                <a
                  href={`https://sepolia.basescan.org/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={styles.txLink}
                >
                  View on BaseScan ↗ {txHash.slice(0, 10)}…{txHash.slice(-6)}
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}

// ── Inline Styles ──────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 390,
    minWidth: 340,
    height: "100%",
    background: "rgba(11, 17, 33, 0.96)",
    borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
    backdropFilter: "blur(20px)",
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    fontFamily: "'Inter', sans-serif",
    color: "#E2E8F0",
    boxShadow: "-16px 0 36px rgba(0, 0, 0, 0.65)",
  },
  tabNav: {
    display: "flex",
    gap: 4,
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    background: "rgba(15, 23, 42, 0.4)",
    padding: "6px 12px",
  },
  tabBtn: {
    flex: 1,
    padding: "8px 4px",
    borderRadius: 6,
    border: "1px solid transparent",
    fontSize: 11.5,
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
    letterSpacing: "0.02em",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  tabContent: {
    padding: "14px 16px",
    flex: 1,
    overflowY: "auto",
    animation: "fadeIn 0.2s ease-out",
  },
  emptyState: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 16,
  },
  emptyText: { color: "#64748B", textAlign: "center", fontSize: 13, lineHeight: 1.6 },
  header: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  riskBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 9999,
    fontSize: 10.5,
    fontWeight: 800,
    letterSpacing: "0.06em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  addressRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    margin: "8px 0 6px",
    background: "rgba(0, 0, 0, 0.25)",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255, 255, 255, 0.05)",
  },
  walletAddress: {
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
    color: "#F1F5F9",
    letterSpacing: "0.02em",
    fontWeight: 600,
  },
  copyBtn: {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 4,
    fontSize: 10.5,
    fontWeight: 600,
    cursor: "pointer",
    padding: "3px 8px",
    transition: "all 0.15s ease",
    fontFamily: "'JetBrains Mono', monospace",
  },
  quickMetricsRow: {
    display: "flex",
    gap: 6,
    marginTop: 8,
  },
  quickMetric: {
    flex: 1,
    background: "rgba(255, 255, 255, 0.03)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: 6,
    padding: "6px 8px",
    display: "flex",
    flexDirection: "column" as const,
    gap: 2,
  },
  quickMetricKey: {
    fontSize: 9,
    fontWeight: 700,
    color: "#64748B",
    letterSpacing: "0.08em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  quickMetricVal: {
    fontSize: 11.5,
    fontWeight: 700,
    color: "#E2E8F0",
    fontFamily: "'JetBrains Mono', monospace",
  },
  closeBtn: {
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "50%",
    width: 26,
    height: 26,
    color: "#94A3B8",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    transition: "all 0.15s ease",
  },
  statsRow: {
    display: "flex",
    gap: 8,
    padding: "12px 16px",
    borderBottom: "1px solid rgba(0,212,255,0.08)",
  },
  statCard: {
    flex: 1,
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: "8px 10px",
    textAlign: "center",
  },
  statValue: { fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 2 },
  statLabel: { fontSize: 10, color: "#64748B", letterSpacing: "0.06em" },
  section: { padding: "16px 16px 8px", flex: 1 },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.1em",
    color: "#00D4FF",
  },
  analyzeBtn: {
    background: "rgba(0,212,255,0.1)",
    border: "1px solid rgba(0,212,255,0.4)",
    borderRadius: 6,
    color: "#00D4FF",
    cursor: "pointer",
    padding: "5px 12px",
    fontSize: 11,
    fontWeight: 600,
  },
  errorBox: {
    background: "rgba(255,59,59,0.1)",
    border: "1px solid rgba(255,59,59,0.3)",
    borderRadius: 6,
    padding: "8px 12px",
    fontSize: 12,
    color: "#FF3B3B",
    marginBottom: 8,
  },
  riskLevelBanner: {
    border: "1px solid",
    borderRadius: 6,
    padding: "6px 12px",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.08em",
    marginBottom: 10,
  },
  summaryText: { fontSize: 13, color: "#CBD5E1", lineHeight: 1.6, marginBottom: 10 },
  narrativeBox: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 10,
    maxHeight: 180,
    overflowY: "auto",
  },
  narrativeText: { fontSize: 12, color: "#94A3B8", lineHeight: 1.7, margin: 0 },
  actionsSection: { marginTop: 10 },
  actionsTitle: { fontSize: 10, fontWeight: 700, color: "#64748B", letterSpacing: "0.1em", marginBottom: 6 },
  actionsList: { margin: 0, padding: 0, listStyle: "none" },
  actionItem: { fontSize: 12, color: "#94A3B8", padding: "3px 0", lineHeight: 1.5 },
  hintText: { fontSize: 12, color: "#475569", lineHeight: 1.6 },
  shieldSection: {
    padding: "12px 16px 20px",
    borderTop: "1px solid rgba(255,59,59,0.15)",
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  shieldBtn: {
    background: "linear-gradient(135deg, #FF3B3B22, #FF8C0022)",
    border: "1px solid #FF3B3B",
    borderRadius: 8,
    color: "#FF3B3B",
    cursor: "pointer",
    padding: "12px 16px",
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: "0.05em",
    transition: "all 0.2s ease",
  },
  txLink: { fontSize: 11, color: "#00D4FF", textDecoration: "none", textAlign: "center" },
};
