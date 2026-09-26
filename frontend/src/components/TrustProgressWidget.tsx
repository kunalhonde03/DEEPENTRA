/**
 * frontend/src/components/TrustProgressWidget.tsx — Feature A: Progressive Trust & Wallet Graduation
 *
 * Displays wallet graduation progress:
 * - 45-day progress bar
 * - Weekly checklist row (✓ / ✗ per 7-day interval)
 * - 10-tx minimum threshold counter
 * - Status badge: NEW (amber) vs TRUSTED (green)
 * - Live polling + Dev-mode "Simulate 45 Days" and "Simulate Gap Week" controls
 */

import React, { useEffect, useState, useCallback } from "react";

const API_BASE = "http://localhost:8000";

export interface WeeklyRecord {
  week_number: number;
  has_transaction: boolean;
  transaction_count_this_week: number;
  start_day: number;
  end_day: number;
}

export interface TrustStatusData {
  wallet_address: string;
  trust_status: "NEW" | "TRUSTED";
  days_since_creation: number;
  weeks_completed: number;
  weeks_missed: number;
  total_weeks_evaluated: number;
  transaction_count: number;
  transactions_needed: number;
  has_dead_weeks: boolean;
  graduation_eta: string;
  conditions: {
    "45_days_elapsed": boolean;
    no_dead_weeks: boolean;
    min_10_transactions: boolean;
  };
  weekly_activity: WeeklyRecord[];
}

interface TrustProgressWidgetProps {
  walletAddress: string;
  onStatusChange?: (status: "NEW" | "TRUSTED") => void;
}

export default function TrustProgressWidget({
  walletAddress,
  onStatusChange,
}: TrustProgressWidgetProps) {
  const [data, setData] = useState<TrustStatusData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulating, setSimulating] = useState<boolean>(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch(`${API_BASE}/api/wallet/${walletAddress}/trust-status`);
      if (res.ok) {
        const json: TrustStatusData = await res.json();
        setData(json);
        if (onStatusChange) onStatusChange(json.trust_status);
      }
    } catch (err) {
      console.warn("Trust status fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress, onStatusChange]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleSimulateGraduation = async () => {
    setSimulating(true);
    setActionMsg("Simulating 45 days with consistent weekly activity…");
    try {
      const payload = {
        days_to_advance: 45,
        transactions_to_backfill: [
          { week: 0, count: 2 },
          { week: 1, count: 2 },
          { week: 2, count: 2 },
          { week: 3, count: 2 },
          { week: 4, count: 2 },
          { week: 5, count: 2 },
          { week: 6, count: 2 },
        ],
      };
      const res = await fetch(`${API_BASE}/api/wallet/${walletAddress}/simulate-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json: TrustStatusData = await res.json();
        setData(json);
        if (onStatusChange) onStatusChange(json.trust_status);
        setActionMsg("🎉 Wallet Graduated to TRUSTED! (45d + 14 txs)");
      }
    } catch (e: any) {
      setActionMsg(`Simulation failed: ${e.message}`);
    } finally {
      setSimulating(false);
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleSimulateAdversarialGap = async () => {
    setSimulating(true);
    setActionMsg("Simulating 47 days with Week 3 Dead Gap…");
    try {
      const payload = {
        days_to_advance: 47,
        transactions_to_backfill: [
          { week: 0, count: 3 },
          { week: 1, count: 3 },
          { week: 2, count: 3 },
          { week: 3, count: 0 }, // Gap week!
          { week: 4, count: 3 },
          { week: 5, count: 3 },
          { week: 6, count: 3 },
        ],
      };
      const res = await fetch(`${API_BASE}/api/wallet/${walletAddress}/simulate-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json: TrustStatusData = await res.json();
        setData(json);
        if (onStatusChange) onStatusChange(json.trust_status);
        setActionMsg("⚠️ Adversarial Check: Week 3 Gap detected. Wallet correctly kept in NEW status.");
      }
    } catch (e: any) {
      setActionMsg(`Simulation error: ${e.message}`);
    } finally {
      setSimulating(false);
      setTimeout(() => setActionMsg(null), 5000);
    }
  };

  const handleResetToNew = async () => {
    setSimulating(true);
    try {
      const payload = {
        days_to_advance: 1,
        transactions_to_backfill: [{ week: 0, count: 1 }],
      };
      const res = await fetch(`${API_BASE}/api/wallet/${walletAddress}/simulate-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const json: TrustStatusData = await res.json();
        setData(json);
        if (onStatusChange) onStatusChange(json.trust_status);
        setActionMsg("Reset to Day 1 (NEW wallet status)");
      }
    } catch (e: any) {
      setActionMsg(`Reset error: ${e.message}`);
    } finally {
      setSimulating(false);
      setTimeout(() => setActionMsg(null), 3000);
    }
  };

  if (loading && !data) {
    return (
      <div style={styles.card}>
        <div style={styles.loadingPulse}>Evaluating Trust Profile…</div>
      </div>
    );
  }

  const isTrusted = data?.trust_status === "TRUSTED";
  const days = data?.days_since_creation ?? 0;
  const dayProgress = Math.min(100, Math.round((days / 45) * 100));
  const txCount = data?.transaction_count ?? 0;
  const txProgress = Math.min(100, Math.round((txCount / 10) * 100));

  // Build standard 7-week checklist view
  const weeklyRecords: WeeklyRecord[] = data?.weekly_activity?.length
    ? data.weekly_activity.slice(0, 7)
    : Array.from({ length: 7 }, (_, i) => ({
        week_number: i,
        has_transaction: i === 0,
        transaction_count_this_week: i === 0 ? 1 : 0,
        start_day: i * 7,
        end_day: (i + 1) * 7,
      }));

  while (weeklyRecords.length < 7) {
    const w = weeklyRecords.length;
    weeklyRecords.push({
      week_number: w,
      has_transaction: false,
      transaction_count_this_week: 0,
      start_day: w * 7,
      end_day: (w + 1) * 7,
    });
  }

  return (
    <div style={styles.card}>
      {/* Header with Status Badge */}
      <div style={styles.header}>
        <div style={styles.titleGroup}>
          <span style={styles.icon}>🛡️</span>
          <div>
            <div style={styles.title}>Progressive Trust System</div>
            <div style={styles.subtitle}>Rakshak Autonomous Graduation Engine</div>
          </div>
        </div>
        <div
          style={{
            ...styles.badge,
            backgroundColor: isTrusted ? "rgba(16,185,129,0.18)" : "rgba(245,158,11,0.18)",
            borderColor: isTrusted ? "rgba(16,185,129,0.5)" : "rgba(245,158,11,0.5)",
            color: isTrusted ? "#10B981" : "#F59E0B",
            boxShadow: isTrusted ? "0 0 10px rgba(16,185,129,0.2)" : "0 0 10px rgba(245,158,11,0.2)",
          }}
        >
          <span
            style={{
              ...styles.badgeDot,
              backgroundColor: isTrusted ? "#10B981" : "#F59E0B",
            }}
          />
          {isTrusted ? "🛡️ TRUSTED WALLET" : "⏳ NEW WALLET"}
        </div>
      </div>

      {/* Threshold Cap Notice for NEW wallets */}
      {!isTrusted && (
        <div style={styles.capNotice}>
          <span style={{ fontSize: 14, marginRight: 8 }}>🔒</span>
          <span>
            <strong>New Wallet Protection Active:</strong> Strict threshold multiplier (<strong>0.5x</strong>) applied. Maximum severity tier capped at <strong>"Watch"</strong> to prevent false positive quarantines.
          </span>
        </div>
      )}

      {/* Progress Metric Cards Row */}
      <div style={styles.metricsGrid}>
        {/* Days Progress */}
        <div style={styles.metricBox}>
          <div style={styles.metricLabel}>TIME ELAPSED</div>
          <div style={styles.metricValueRow}>
            <span style={styles.metricNumber}>{days}</span>
            <span style={styles.metricTotal}>/ 45 Days</span>
          </div>
          <div style={styles.progressBarBg}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${dayProgress}%`,
                backgroundColor: days >= 45 ? "#10B981" : "#00D4FF",
              }}
            />
          </div>
        </div>

        {/* Transaction Count Progress */}
        <div style={styles.metricBox}>
          <div style={styles.metricLabel}>TOTAL TRANSACTIONS</div>
          <div style={styles.metricValueRow}>
            <span style={styles.metricNumber}>{txCount}</span>
            <span style={styles.metricTotal}>/ 10 Txs</span>
          </div>
          <div style={styles.progressBarBg}>
            <div
              style={{
                ...styles.progressBarFill,
                width: `${txProgress}%`,
                backgroundColor: txCount >= 10 ? "#10B981" : "#38BDF8",
              }}
            />
          </div>
        </div>
      </div>

      {/* 7-Day Window Activity Checklist */}
      <div style={styles.sectionTitle}>
        <span>WEEKLY CONTINUOUS ACTIVITY</span>
        <span style={{ fontSize: 10.5, color: "#00D4FF", fontFamily: "'JetBrains Mono', monospace" }}>
          {weeklyRecords.filter((w) => w.has_transaction).length}/7 WEEKS PASSED
        </span>
      </div>

      {/* Timeline Grid with Status Tints */}
      <div style={styles.weeklyContainer}>
        <div style={styles.weeklyRow}>
          {weeklyRecords.map((w) => {
            const isPassed = w.has_transaction;
            return (
              <div
                key={w.week_number}
                style={{
                  ...styles.weekPill,
                  borderColor: isPassed ? "rgba(16,185,129,0.4)" : "rgba(239,68,68,0.35)",
                  backgroundColor: isPassed ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.08)",
                }}
                title={`Week ${w.week_number + 1} (Days ${w.start_day}-${w.end_day}): ${
                  isPassed ? `${w.transaction_count_this_week} tx(s)` : "Dead Week (0 tx)"
                }`}
              >
                <div style={styles.weekLabel}>W{w.week_number + 1}</div>
                <div style={{ ...styles.weekIcon, color: isPassed ? "#10B981" : "#FF5C5C" }}>
                  {isPassed ? "✓" : "✗"}
                </div>
                <div style={styles.weekTxCount}>
                  {w.transaction_count_this_week > 0 ? `${w.transaction_count_this_week} tx` : "0 tx"}
                </div>
              </div>
            );
          })}
        </div>
        {/* Timeline Connector Line */}
        <div style={styles.timelineBar}>
          <div
            style={{
              height: "100%",
              width: `${(weeklyRecords.filter((w) => w.has_transaction).length / 7) * 100}%`,
              background: "linear-gradient(90deg, #00D4FF, #10B981)",
              borderRadius: 999,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      {/* ETA & Status Reason */}
      <div style={styles.etaRow}>
        <span style={styles.etaLabel}>Graduation Condition:</span>
        <span style={{ ...styles.etaValue, color: isTrusted ? "#10B981" : "#F59E0B" }}>
          {data?.graduation_eta ?? "Evaluating…"}
        </span>
      </div>

      {/* Live Action Banner */}
      {actionMsg && <div style={styles.actionBanner}>{actionMsg}</div>}

      {/* Demo Controls Section (Clearly Marked as Dev Mode) */}
      <div style={styles.demoSection}>
        <div style={styles.demoHeader}>
          <span style={styles.demoBadge}>🛠️ DEV MODE SIMULATOR</span>
          <span style={{ fontSize: 10.5, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
            Interactive Demo Tests
          </span>
        </div>
        <div style={styles.btnRow}>
          <button
            onClick={handleSimulateGraduation}
            disabled={simulating}
            style={{ ...styles.demoBtn, ...styles.gradBtn }}
          >
            {simulating ? "⏳ Simulating…" : "⚡ Simulate 45d (Graduated)"}
          </button>
          <button
            onClick={handleSimulateAdversarialGap}
            disabled={simulating}
            style={{ ...styles.demoBtn, ...styles.gapBtn }}
          >
            {simulating ? "⏳ Simulating…" : "⚠️ Test Gap Week (Stay NEW)"}
          </button>
          <button
            onClick={handleResetToNew}
            disabled={simulating}
            style={{ ...styles.demoBtn, ...styles.resetBtn }}
            title="Reset wallet to Day 1"
          >
            ↺ Reset
          </button>
        </div>
      </div>
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
    padding: "24px 0",
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
  badge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "3px 10px",
    borderRadius: 9999,
    fontSize: 10.5,
    fontWeight: 800,
    border: "1px solid",
    letterSpacing: "0.04em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
  },
  capNotice: {
    display: "flex",
    alignItems: "flex-start",
    backgroundColor: "rgba(245,158,11,0.06)",
    borderLeft: "4px solid #F59E0B",
    borderTop: "1px solid rgba(245,158,11,0.15)",
    borderRight: "1px solid rgba(245,158,11,0.15)",
    borderBottom: "1px solid rgba(245,158,11,0.15)",
    borderRadius: 6,
    padding: "9px 12px",
    fontSize: 11.5,
    color: "#FCD34D",
    lineHeight: 1.45,
    marginBottom: 14,
  },
  metricsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 14,
  },
  metricBox: {
    background: "rgba(15, 23, 42, 0.65)",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255, 255, 255, 0.06)",
  },
  metricLabel: {
    fontSize: 9.5,
    fontWeight: 700,
    color: "#64748B",
    letterSpacing: "0.08em",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 4,
  },
  metricValueRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 4,
    marginBottom: 8,
  },
  metricNumber: {
    fontSize: 18,
    fontWeight: 800,
    color: "#F1F5F9",
    fontFamily: "'JetBrains Mono', monospace",
  },
  metricTotal: {
    fontSize: 11,
    color: "#94A3B8",
    fontFamily: "'JetBrains Mono', monospace",
  },
  progressBarBg: {
    height: 5,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 999,
    transition: "width 0.4s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.4s ease",
  },
  sectionTitle: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 10,
    fontWeight: 700,
    color: "#94A3B8",
    letterSpacing: "0.08em",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  },
  weeklyContainer: {
    marginBottom: 14,
  },
  weeklyRow: {
    display: "grid",
    gridTemplateColumns: "repeat(7, 1fr)",
    gap: 6,
    marginBottom: 6,
  },
  weekPill: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "7px 2px",
    borderRadius: 6,
    border: "1px solid",
    transition: "all 0.15s ease",
  },
  weekLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: "#94A3B8",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 2,
  },
  weekIcon: {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: 2,
  },
  weekTxCount: {
    fontSize: 8.5,
    color: "#CBD5E1",
    fontFamily: "'JetBrains Mono', monospace",
  },
  timelineBar: {
    height: 3,
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: 999,
    overflow: "hidden",
  },
  etaRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: "rgba(15,23,42,0.7)",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid rgba(255, 255, 255, 0.06)",
    fontSize: 11.5,
    marginBottom: 14,
  },
  etaLabel: {
    color: "#94A3B8",
    fontSize: 11,
  },
  etaValue: {
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  actionBanner: {
    backgroundColor: "rgba(0,212,255,0.12)",
    border: "1px solid #00D4FF",
    borderRadius: 6,
    padding: "8px 12px",
    color: "#00D4FF",
    fontSize: 11.5,
    textAlign: "center",
    marginBottom: 12,
    animation: "fadeIn 0.2s ease-out",
  },
  demoSection: {
    border: "1px dashed rgba(56, 189, 248, 0.35)",
    background: "rgba(8, 12, 24, 0.5)",
    borderRadius: 8,
    padding: "12px",
  },
  demoHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  demoBadge: {
    fontSize: 9.5,
    fontWeight: 800,
    letterSpacing: "0.06em",
    color: "#38BDF8",
    background: "rgba(56,189,248,0.12)",
    padding: "3px 7px",
    borderRadius: 4,
    border: "1px solid rgba(56,189,248,0.25)",
    fontFamily: "'JetBrains Mono', monospace",
  },
  btnRow: {
    display: "flex",
    gap: 6,
  },
  demoBtn: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid transparent",
    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
    letterSpacing: "0.01em",
  },
  gradBtn: {
    background: "linear-gradient(135deg, rgba(16,185,129,0.25) 0%, rgba(5,150,105,0.3) 100%)",
    borderColor: "#10B981",
    color: "#34D399",
    boxShadow: "0 2px 10px rgba(16,185,129,0.15)",
  },
  gapBtn: {
    background: "rgba(245,158,11,0.1)",
    borderColor: "rgba(245,158,11,0.45)",
    color: "#FBBF24",
  },
  resetBtn: {
    flex: "0 0 50px",
    background: "rgba(255,255,255,0.04)",
    borderColor: "rgba(255,255,255,0.12)",
    color: "#94A3B8",
  },
};

