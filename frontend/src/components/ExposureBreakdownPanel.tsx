/**
 * frontend/src/components/ExposureBreakdownPanel.tsx — Feature B: Graph Exposure Scoring ("D-P-R" Model)
 *
 * Displays:
 * - Graph Exposure % (Tainted inbound / Total inbound)
 * - Closest flagged counterparty (Distance hop decay)
 * - Relationship type (Incidental 0.3x vs Sustained 1.0x)
 * - Direction (Inbound vs Outbound 1.2x)
 * - Path traversal inspection table
 */

import React, { useEffect, useState, useCallback } from "react";

const API_BASE = "http://localhost:8000";

export interface PathContribution {
  target_flagged_address: string;
  hop_distance: number;
  base_risk: number;
  decayed_contribution: number;
  direction: "inbound" | "outbound" | "bidirectional" | "clean";
  repetition_count_30d: number;
  repetition_multiplier: number;
  effective_risk_score: number;
  amount_eth: number;
  timestamp?: string;
}

export interface ExposureScoreData {
  wallet_address: string;
  exposure_percentage: number;
  primary_contributing_hop: number;
  is_sustained_relationship: boolean;
  direction: "inbound" | "outbound" | "bidirectional" | "clean";
  total_risk_contribution: number;
  tainted_inbound_value_eth: number;
  total_inbound_value_eth: number;
  interaction_count_30d: number;
  closest_flagged_cluster?: string;
  relationship_label: string;
  paths: PathContribution[];
}

interface ExposureBreakdownPanelProps {
  walletAddress: string;
}

export default function ExposureBreakdownPanel({
  walletAddress,
}: ExposureBreakdownPanelProps) {
  const [data, setData] = useState<ExposureScoreData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchExposure = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_BASE}/api/wallet/${walletAddress}/exposure`);
      if (res.ok) {
        const json: ExposureScoreData = await res.json();
        setData(json);
      }
    } catch (err) {
      console.warn("Exposure score fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchExposure();
    const interval = setInterval(fetchExposure, 5000);
    return () => clearInterval(interval);
  }, [fetchExposure]);

  if (loading && !data) {
    return (
      <div style={styles.card}>
        <div style={styles.loadingPulse}>Calculating Graph Exposure Matrix…</div>
      </div>
    );
  }

  const expPct = data?.exposure_percentage ?? 0.0;
  const isHighExposure = expPct > 15.0;
  const hops = data?.primary_contributing_hop ?? -1;
  const isSustained = data?.is_sustained_relationship ?? false;
  const direction = data?.direction ?? "clean";

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <span style={styles.icon}>🕸️</span>
          <div>
            <div style={styles.title}>Graph Exposure Scoring</div>
            <div style={styles.subtitle}>D-P-R Decay & Proximity Intelligence</div>
          </div>
        </div>
        <div
          style={{
            ...styles.exposureBadge,
            backgroundColor: isHighExposure ? "rgba(239,68,68,0.18)" : "rgba(56,189,248,0.15)",
            borderColor: isHighExposure ? "#EF4444" : "#38BDF8",
            color: isHighExposure ? "#EF4444" : "#38BDF8",
          }}
        >
          {expPct.toFixed(1)}% EXPOSURE
        </div>
      </div>

      {/* Exposure Progress Bar */}
      <div style={styles.barContainer}>
        <div style={styles.barHeader}>
          <span style={styles.barLabel}>Tainted Inbound Exposure (P)</span>
          <span style={styles.barValue}>
            {data?.tainted_inbound_value_eth ?? 0} / {data?.total_inbound_value_eth ?? 0} ETH
          </span>
        </div>
        <div style={styles.progressBarBg}>
          <div
            style={{
              ...styles.progressBarFill,
              width: `${Math.min(100, Math.max(4, expPct))}%`,
              backgroundColor: isHighExposure ? "#EF4444" : expPct > 5 ? "#F59E0B" : "#10B981",
            }}
          />
        </div>
      </div>

      {/* D-P-R Tree Breakdown */}
      <div style={styles.treeBox}>
        {/* Distance Hop */}
        <div style={styles.treeRow}>
          <div style={styles.treeKey}>
            <span style={styles.treeBranch}>├──</span>
            <span style={styles.treeLabel}>Distance Decay (D):</span>
          </div>
          <div style={styles.treeValue}>
            {hops > 0 ? (
              <span style={{ color: hops === 1 ? "#EF4444" : "#FBBF24" }}>
                <strong>{hops} hop{hops > 1 ? "s" : ""}</strong> away (Decay Factor: 0.4<sup>{hops - 1}</sup>)
              </span>
            ) : (
              <span style={{ color: "#10B981" }}>No flagged connections</span>
            )}
          </div>
        </div>

        {/* Relationship Repetition */}
        <div style={styles.treeRow}>
          <div style={styles.treeKey}>
            <span style={styles.treeBranch}>├──</span>
            <span style={styles.treeLabel}>Repetition Weight (R):</span>
          </div>
          <div style={styles.treeValue}>
            <span
              style={{
                color: isSustained ? "#EF4444" : "#38BDF8",
                fontWeight: 600,
              }}
            >
              {isSustained ? "Sustained (1.0x weight)" : "Incidental (0.3x dampening)"}
            </span>
            <span style={{ fontSize: 11, color: "#94A3B8", marginLeft: 4 }}>
              ({data?.interaction_count_30d ?? 0} interaction in 30d)
            </span>
          </div>
        </div>

        {/* Direction */}
        <div style={styles.treeRow}>
          <div style={styles.treeKey}>
            <span style={styles.treeBranch}>└──</span>
            <span style={styles.treeLabel}>Flow Direction:</span>
          </div>
          <div style={styles.treeValue}>
            <span style={{ color: direction === "outbound" ? "#F59E0B" : "#E2E8F0" }}>
              {direction === "outbound"
                ? "Outbound (sent to flagged cluster — 1.2x weight)"
                : direction === "inbound"
                ? "Inbound (received funds from counterparty)"
                : direction === "bidirectional"
                ? "Bidirectional (mutual transfers)"
                : "Clean / Isolated"}
            </span>
          </div>
        </div>
      </div>

      {/* Path Inspection Table if any paths exist */}
      {data?.paths && data.paths.length > 0 && (
        <div style={styles.pathsContainer}>
          <div style={styles.pathsTitle}>Corroborating Path Contributions</div>
          <div style={styles.pathsList}>
            {data.paths.map((p, idx) => (
              <div key={idx} style={styles.pathItem}>
                <div style={styles.pathHeader}>
                  <span style={styles.pathAddress}>
                    Target: {p.target_flagged_address.slice(0, 8)}…{p.target_flagged_address.slice(-6)}
                  </span>
                  <span style={styles.pathScore}>
                    +{(p.effective_risk_score * 100).toFixed(1)} Risk
                  </span>
                </div>
                <div style={styles.pathMeta}>
                  <span>{p.hop_distance} Hop{p.hop_distance > 1 ? "s" : ""}</span>
                  <span>·</span>
                  <span>{p.amount_eth} ETH</span>
                  <span>·</span>
                  <span>{p.direction}</span>
                  <span>·</span>
                  <span>{p.repetition_multiplier === 1.0 ? "Sustained (1.0x)" : "Incidental (0.3x)"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(17, 24, 39, 0.72)",
    borderRadius: 10,
    border: "1px solid rgba(255, 255, 255, 0.08)",
    padding: "16px",
    color: "#F8FAFC",
    fontFamily: "'Inter', sans-serif",
    marginBottom: 16,
    boxShadow: "0 12px 28px -4px rgba(0,0,0,0.5)",
    backdropFilter: "blur(12px)",
  },
  loadingPulse: {
    padding: "20px 0",
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    fontFamily: "'JetBrains Mono', monospace",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: 14.5,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: "#F8FAFC",
  },
  subtitle: {
    fontSize: 10.5,
    color: "#94A3B8",
  },
  exposureBadge: {
    padding: "3px 10px",
    borderRadius: 9999,
    fontSize: 10.5,
    fontWeight: 800,
    border: "1px solid",
    letterSpacing: "0.04em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  barContainer: {
    background: "rgba(15, 23, 42, 0.65)",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    marginBottom: 12,
  },
  barHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10.5,
    color: "#94A3B8",
    marginBottom: 6,
    fontFamily: "'JetBrains Mono', monospace",
  },
  barLabel: {
    fontWeight: 600,
  },
  barValue: {
    color: "#F1F5F9",
    fontWeight: 700,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  treeBox: {
    background: "rgba(15, 23, 42, 0.65)",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    padding: "10px 12px",
    fontSize: 11.5,
    fontFamily: "'JetBrains Mono', monospace",
    lineHeight: 1.6,
    marginBottom: 12,
  },
  treeRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "4px 0",
  },
  treeKey: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    color: "#94A3B8",
  },
  treeBranch: {
    color: "#475569",
  },
  treeLabel: {
    color: "#CBD5E1",
    fontFamily: "'Inter', sans-serif",
  },
  treeValue: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 11.5,
  },
  pathsContainer: {
    borderTop: "1px dashed rgba(255, 255, 255, 0.12)",
    paddingTop: 10,
  },
  pathsTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  },
  pathsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  pathItem: {
    background: "rgba(15, 23, 42, 0.5)",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid rgba(255, 255, 255, 0.05)",
    fontSize: 11,
  },
  pathHeader: {
    display: "flex",
    justifyContent: "space-between",
    fontWeight: 600,
    marginBottom: 3,
  },
  pathAddress: {
    color: "#E2E8F0",
    fontFamily: "'JetBrains Mono', monospace",
  },
  pathScore: {
    color: "#FBBF24",
    fontFamily: "'JetBrains Mono', monospace",
    fontWeight: 700,
  },
  pathMeta: {
    display: "flex",
    gap: 6,
    fontSize: 10,
    color: "#94A3B8",
    fontFamily: "'JetBrains Mono', monospace",
  },
};

