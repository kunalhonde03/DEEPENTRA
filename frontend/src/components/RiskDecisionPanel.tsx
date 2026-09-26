/**
 * frontend/src/components/RiskDecisionPanel.tsx — Feature D: Confidence-Aware Hybrid Enforcement & Human Review Panel
 *
 * Displays:
 * - Multi-signal corroboration breakdown (+35, +28, etc.)
 * - Severity tier (Critical, Elevated, Watch, Low)
 * - Confidence Level (High vs Low)
 * - Operator action buttons: [Quarantine Wallet], [Confirm Block], [Dismiss / Mark Safe]
 * - Direct integration with ShieldWallet.sol & Decision Audit Trail
 */

import { useEffect, useState, useCallback } from "react";

const API_BASE = "http://localhost:8000";

export interface SignalDetail {
  category: string;
  name: string;
  triggered: boolean;
  score: number;
  threshold: number;
  description: string;
  weight: number;
}

export interface SeverityResultData {
  wallet_address: string;
  severity_tier: "Critical" | "Elevated" | "Watch" | "Low";
  composite_risk_score: number;
  signals_triggered: string[];
  signals_count: number;
  confidence_level: "High" | "Low";
  trust_status: "NEW" | "TRUSTED";
  tier_capped_by_trust: boolean;
  signal_breakdown: SignalDetail[];
  recommendation: string;
}

export interface EnforcementDecisionData {
  wallet_address: string;
  action: "auto_block" | "human_review" | "log_only";
  requires_dashboard_alert: boolean;
  quarantine_eligible: boolean;
  recommended_action: string;
  severity_tier: string;
  confidence_level: string;
  signals_triggered: string[];
  composite_risk_score: number;
}

interface RiskDecisionPanelProps {
  walletAddress: string;
  onActionComplete?: (action: string) => void;
}

export default function RiskDecisionPanel({
  walletAddress,
  onActionComplete,
}: RiskDecisionPanelProps) {
  const [decision, setDecision] = useState<EnforcementDecisionData | null>(null);
  const [severity, setSeverity] = useState<SeverityResultData | null>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [executing, setExecuting] = useState<boolean>(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Feature 2: "Explain This" toggle
  const [explainMode, setExplainMode] = useState<'plain' | 'technical'>('plain');
  const [plainExplanation, setPlainExplanation] = useState<string | null>(null);
  const [explainLoading, setExplainLoading] = useState<boolean>(false);

  const fetchEnforcementData = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const [resDec, resAudit] = await Promise.all([
        fetch(`${API_BASE}/api/enforcement/decision/${walletAddress}`),
        fetch(`${API_BASE}/api/audit-log/${walletAddress}`),
      ]);

      if (resDec.ok) {
        const json = await resDec.json();
        setDecision(json.decision);
        setSeverity(json.severity_result);
      }
      if (resAudit.ok) {
        const jsonA = await resAudit.json();
        setAuditLogs(jsonA.audit_trail || []);
      }
    } catch (err) {
      console.warn("Enforcement decision fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    fetchEnforcementData();
    const interval = setInterval(fetchEnforcementData, 5000);
    return () => clearInterval(interval);
  }, [fetchEnforcementData]);

  // Fetch plain-language explanation on mount / address change
  useEffect(() => {
    if (!walletAddress) return;
    setExplainLoading(true);
    setPlainExplanation(null);
    fetch(`${API_BASE}/api/wallet/${walletAddress}/explain`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.plain_explanation) setPlainExplanation(data.plain_explanation);
      })
      .catch(() => {})
      .finally(() => setExplainLoading(false));
  }, [walletAddress]);

  const handleExecuteAction = async (action: "quarantine" | "block" | "dismiss") => {
    setExecuting(true);
    setActionSuccess(null);
    try {
      const res = await fetch(`${API_BASE}/api/enforcement/execute-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          action: action,
          reason: `Human review decision executed via Rakshak Dashboard for ${severity?.severity_tier} risk profile`,
          operator_address: "operator_admin",
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const label =
          action === "quarantine"
            ? "🛡️ Quarantined Reversibly on Base Sepolia"
            : action === "block"
            ? "⛔ Permanently Blocked on Base Sepolia"
            : "✓ Cleared / Dismissed in Audit Trail";
        setActionSuccess(`${label} (Tx: ${json.tx_hash?.slice(0, 12)}…)`);
        if (onActionComplete) onActionComplete(action);
        fetchEnforcementData();
      }
    } catch (err: any) {
      setActionSuccess(`Error: ${err.message}`);
    } finally {
      setExecuting(false);
      setTimeout(() => setActionSuccess(null), 6000);
    }
  };

  if (loading && !severity) {
    return (
      <div style={styles.card}>
        <div style={styles.loadingPulse}>Evaluating Corroboration Matrix…</div>
      </div>
    );
  }

  const tier = severity?.severity_tier ?? "Low";
  const conf = severity?.confidence_level ?? "Low";
  const score = severity?.composite_risk_score ?? 15;
  const isCapped = severity?.tier_capped_by_trust ?? false;

  const tierColor =
    tier === "Critical" ? "#FF3B3B" : tier === "Elevated" ? "#FF8C00" : tier === "Watch" ? "#F59E0B" : "#10B981";

  return (
    <div style={styles.card}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.scoreRow}>
            <span style={{ ...styles.riskScore, color: tierColor }}>
              {score.toFixed(0)}/100
            </span>
            <span style={{ ...styles.tierBadge, borderColor: tierColor, color: tierColor }}>
              {tier.toUpperCase()}
            </span>
            <span
              style={{
                ...styles.confBadge,
                color: conf === "High" ? "#34D399" : "#FBBF24",
                borderColor: conf === "High" ? "rgba(52,211,153,0.4)" : "rgba(251,191,36,0.4)",
              }}
            >
              CONFIDENCE: {conf.toUpperCase()}
            </span>
          </div>
          <div style={styles.subtext}>
            {severity?.trust_status === "NEW" ? "New Wallet (Protected)" : "Graduated Trusted Wallet"}
          </div>
        </div>

        {/* Action Route Indicator */}
        <div style={styles.routeBadge}>
          {decision?.action === "auto_block"
            ? "⚡ AUTONOMOUS BLOCK"
            : decision?.action === "human_review"
            ? "👤 HUMAN REVIEW REQUIRED"
            : "📝 AUDIT LOG ONLY"}
        </div>
      </div>

      {/* Cap notification if applicable */}
      {isCapped && (
        <div style={styles.trustCapBanner}>
          <span>🔒 Capped at <strong>"Watch"</strong> by Progressive Trust Layer (NEW wallet safeguard)</span>
        </div>
      )}

      {/* Feature 2: Explain This — Plain English / Technical Toggle */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '10px 0 6px',
      }}>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em' }}>
          SIGNAL BREAKDOWN
        </div>
        <div style={{
          display: 'flex',
          background: 'rgba(15,23,42,0.8)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 6,
          overflow: 'hidden',
          gap: 0,
        }}>
          {(['plain', 'technical'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setExplainMode(mode)}
              style={{
                background: explainMode === mode ? 'rgba(56,189,248,0.18)' : 'transparent',
                border: 'none',
                borderRight: mode === 'plain' ? '1px solid rgba(255,255,255,0.06)' : 'none',
                color: explainMode === mode ? '#38BDF8' : '#64748B',
                fontSize: 10,
                fontWeight: 700,
                padding: '4px 10px',
                cursor: 'pointer',
                letterSpacing: '0.05em',
                fontFamily: "'JetBrains Mono', monospace",
                transition: 'all 0.15s ease',
              }}
            >
              {mode === 'plain' ? '💬 Plain English' : '⚙️ Technical'}
            </button>
          ))}
        </div>
      </div>

      {/* Plain English View */}
      {explainMode === 'plain' && (
        <div style={{
          background: 'rgba(56, 189, 248, 0.05)',
          border: '1px solid rgba(56, 189, 248, 0.2)',
          borderLeft: '3px solid #38BDF8',
          borderRadius: 8,
          padding: '12px 14px',
          marginBottom: 10,
          minHeight: 60,
          display: 'flex',
          alignItems: 'center',
        }}>
          {explainLoading ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: '2px solid rgba(56,189,248,0.3)',
                borderTop: '2px solid #38BDF8',
                animation: 'spin 0.8s linear infinite',
              }} />
              <span style={{ color: '#64748B', fontSize: 12 }}>Generating explanation…</span>
            </div>
          ) : (
            <p style={{
              color: '#CBD5E1',
              fontSize: 13.5,
              lineHeight: 1.6,
              margin: 0,
              fontStyle: 'italic',
            }}>
              {plainExplanation || 'This wallet shows activity consistent with normal decentralized finance participation.'}
            </p>
          )}
        </div>
      )}

      {/* Technical Signals View */}
      {explainMode === 'technical' && (
        <div style={styles.signalsList}>
          {severity?.signal_breakdown?.map((sig, idx) => (
            <div
              key={idx}
              style={{
                ...styles.signalRow,
                backgroundColor: sig.triggered ? "rgba(239,68,68,0.08)" : "rgba(30,41,59,0.3)",
                borderColor: sig.triggered ? "rgba(239,68,68,0.35)" : "rgba(51,65,85,0.3)",
              }}
            >
              <div style={styles.signalLeft}>
                <span style={{ ...styles.checkIcon, color: sig.triggered ? "#10B981" : "#64748B" }}>
                  {sig.triggered ? "✓" : "✗"}
                </span>
                <div>
                  <div style={{ ...styles.sigCategory, color: sig.triggered ? "#F8FAFC" : "#94A3B8" }}>
                    {sig.category}
                  </div>
                  <div style={styles.sigDesc}>{sig.description}</div>
                </div>
              </div>
              <div style={{ ...styles.sigWeight, color: sig.triggered ? "#F87171" : "#64748B" }}>
                {sig.triggered ? `+${sig.weight}` : "(not triggered)"}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recommendation Banner */}
      <div style={styles.recBanner}>
        <span style={{ fontWeight: 600, color: "#38BDF8" }}>Recommendation: </span>
        <span style={{ color: "#CBD5E1" }}>{severity?.recommendation || decision?.recommended_action}</span>
      </div>

      {/* Action Success Toast */}
      {actionSuccess && <div style={styles.successToast}>{actionSuccess}</div>}

      {/* Operator Action Buttons */}
      <div style={styles.actionsGrid}>
        <button
          onClick={() => handleExecuteAction("quarantine")}
          disabled={executing}
          style={{ ...styles.actionBtn, ...styles.quarantineBtn }}
        >
          {executing ? "Processing…" : "🛡️ Quarantine Wallet"}
        </button>

        <button
          onClick={() => handleExecuteAction("block")}
          disabled={executing}
          style={{ ...styles.actionBtn, ...styles.blockBtn }}
        >
          {executing ? "Processing…" : "⛔ Confirm Block"}
        </button>

        <button
          onClick={() => handleExecuteAction("dismiss")}
          disabled={executing}
          style={{ ...styles.actionBtn, ...styles.dismissBtn }}
        >
          {executing ? "Processing…" : "✓ Dismiss / Safe"}
        </button>
      </div>

      {/* Decision Audit Trail History */}
      {auditLogs.length > 0 && (
        <div style={styles.auditSection}>
          <div style={styles.auditHeader}>Decision Audit Trail ({auditLogs.length} entries)</div>
          <div style={styles.auditList}>
            {auditLogs.slice(0, 3).map((a, i) => (
              <div key={i} style={styles.auditItem}>
                <div style={styles.auditTop}>
                  <span style={{ fontWeight: 600, color: "#38BDF8" }}>{a.action_taken?.toUpperCase()}</span>
                  <span style={{ fontSize: 10, color: "#64748B" }}>{new Date(a.timestamp).toLocaleTimeString()}</span>
                </div>
                <div style={styles.auditMeta}>
                  <span>By: {a.decided_by}</span>
                  {a.tx_hash && (
                    <span>· Tx: {a.tx_hash.slice(0, 10)}…{a.tx_hash.slice(-4)}</span>
                  )}
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
    alignItems: "flex-start",
    marginBottom: 12,
  },
  scoreRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 3,
  },
  riskScore: {
    fontSize: 20,
    fontWeight: 800,
    letterSpacing: "-0.02em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  tierBadge: {
    padding: "2px 8px",
    borderRadius: 9999,
    fontSize: 10.5,
    fontWeight: 800,
    border: "1px solid",
    fontFamily: "'JetBrains Mono', monospace",
  },
  confBadge: {
    padding: "2px 8px",
    borderRadius: 9999,
    fontSize: 10,
    fontWeight: 700,
    border: "1px solid",
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    fontFamily: "'JetBrains Mono', monospace",
  },
  subtext: {
    fontSize: 11,
    color: "#94A3B8",
  },
  routeBadge: {
    fontSize: 10,
    fontWeight: 800,
    color: "#38BDF8",
    background: "rgba(56,189,248,0.12)",
    border: "1px solid rgba(56,189,248,0.3)",
    padding: "4px 8px",
    borderRadius: 6,
    letterSpacing: "0.03em",
    fontFamily: "'JetBrains Mono', monospace",
  },
  trustCapBanner: {
    backgroundColor: "rgba(245,158,11,0.08)",
    border: "1px solid rgba(245,158,11,0.3)",
    borderRadius: 6,
    padding: "8px 10px",
    fontSize: 11,
    color: "#FCD34D",
    marginBottom: 12,
  },
  signalsHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 8,
  },
  signalsList: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  signalRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid",
  },
  signalLeft: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  checkIcon: {
    fontSize: 14,
    fontWeight: 700,
  },
  sigCategory: {
    fontSize: 11.5,
    fontWeight: 600,
  },
  sigDesc: {
    fontSize: 10,
    color: "#94A3B8",
  },
  sigWeight: {
    fontSize: 11,
    fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
  recBanner: {
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: 8,
    padding: "9px 12px",
    fontSize: 11.5,
    lineHeight: 1.45,
    marginBottom: 12,
    color: "#CBD5E1",
  },
  successToast: {
    backgroundColor: "rgba(16,185,129,0.15)",
    border: "1px solid #10B981",
    borderRadius: 6,
    padding: "7px 10px",
    color: "#34D399",
    fontSize: 11,
    marginBottom: 10,
    textAlign: "center",
  },
  actionsGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 6,
    marginBottom: 12,
  },
  actionBtn: {
    padding: "8px 6px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
    cursor: "pointer",
    border: "1px solid",
    transition: "all 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
    letterSpacing: "0.01em",
  },
  quarantineBtn: {
    backgroundColor: "rgba(245,158,11,0.15)",
    borderColor: "rgba(245,158,11,0.5)",
    color: "#FBBF24",
  },
  blockBtn: {
    backgroundColor: "rgba(239,68,68,0.18)",
    borderColor: "rgba(239,68,68,0.5)",
    color: "#F87171",
  },
  dismissBtn: {
    backgroundColor: "rgba(16,185,129,0.12)",
    borderColor: "rgba(16,185,129,0.4)",
    color: "#34D399",
  },
  auditSection: {
    borderTop: "1px dashed rgba(255, 255, 255, 0.12)",
    paddingTop: 10,
  },
  auditHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontFamily: "'JetBrains Mono', monospace",
    marginBottom: 6,
  },
  auditList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  auditItem: {
    background: "rgba(15, 23, 42, 0.5)",
    padding: "6px 8px",
    borderRadius: 4,
    border: "1px solid rgba(255, 255, 255, 0.05)",
    fontSize: 10.5,
  },
  auditTop: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  auditMeta: {
    display: "flex",
    gap: 6,
    color: "#94A3B8",
    fontSize: 9.5,
    fontFamily: "'JetBrains Mono', monospace",
  },
};

