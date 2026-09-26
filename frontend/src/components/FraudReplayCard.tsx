/**
 * FraudReplayCard.tsx — Feature 3: One-Click Real Fraud Case Replay
 * Rakshak On-Chain Immunity System
 *
 * Triggers the backend case replay, shows a live progress ticker,
 * and displays the final accuracy summary card when complete.
 */

import { useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";
const CASE_ID = "fraud_case_1";

type ReplayStatus = "idle" | "running" | "complete" | "error";

interface CaseResult {
  case_id: string;
  case_name: string;
  total_wallets: number;
  total_transactions: number;
  correctly_flagged: number;
  total_malicious: number;
  correctly_spared: number;
  total_clean: number;
  accuracy_pct: number;
  flagged_wallet_addresses: string[];
  spared_wallet_addresses: string[];
  narrative_summary: string;
  status: string;
}

interface FraudReplayCardProps {
  /** Called when replay starts so Dashboard can show extra attention */
  onReplayStart?: () => void;
  onReplayComplete?: (result: CaseResult) => void;
}

export default function FraudReplayCard({ onReplayStart, onReplayComplete }: FraudReplayCardProps) {
  const [status, setStatus] = useState<ReplayStatus>("idle");
  const [result, setResult] = useState<CaseResult | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);
  const [txCount, setTxCount] = useState<number>(0);
  const totalTxs = 11; // matches fraud_case_1.json transaction count
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const txTickRef = useRef<NodeJS.Timeout | null>(null);

  const startReplay = async () => {
    if (status === "running") return;
    setStatus("running");
    setResult(null);
    setElapsed(0);
    setTxCount(0);
    onReplayStart?.();

    // Elapsed time ticker
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    // Tx progress ticker — approximate pace (1.6s/tx as per backend sleep)
    txTickRef.current = setInterval(() => {
      setTxCount((c) => Math.min(c + 1, totalTxs));
    }, 1700);

    try {
      const resp = await fetch(`${API_BASE}/api/demo/replay-case/${CASE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (resp.ok) {
        const data: CaseResult = await resp.json();
        setResult(data);
        setStatus("complete");
        setTxCount(totalTxs);
        onReplayComplete?.(data);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      if (timerRef.current) clearInterval(timerRef.current);
      if (txTickRef.current) clearInterval(txTickRef.current);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (txTickRef.current) clearInterval(txTickRef.current);
    };
  }, []);

  const formatElapsed = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        right: 18,
        width: 340,
        zIndex: 39,
        fontFamily: "'Inter', sans-serif",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}
    >
      {/* Result Summary Card */}
      {status === "complete" && result && (
        <div
          style={{
            background: "rgba(11, 17, 33, 0.96)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            borderBottom: "none",
            borderRadius: "12px 12px 0 0",
            padding: "14px 16px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.5)",
            animation: "slideUp 0.3s ease",
          }}
        >
          {/* Success Header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#10B981", letterSpacing: "0.06em", fontFamily: "'JetBrains Mono', monospace" }}>
                REPLAY COMPLETE
              </div>
              <div style={{ fontSize: 10, color: "#64748B" }}>
                {result.case_name}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                fontSize: 22,
                fontWeight: 900,
                color: "#10B981",
                fontFamily: "'JetBrains Mono', monospace",
              }}
            >
              {result.accuracy_pct}%
            </div>
          </div>

          {/* The Money Moment — Accuracy Breakdown */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <div
              style={{
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderLeft: "3px solid #EF4444",
                borderRadius: 6,
                padding: "8px 10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: "#EF4444", fontFamily: "'JetBrains Mono', monospace" }}>
                {result.correctly_flagged}/{result.total_malicious}
              </div>
              <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.05em" }}>
                MALICIOUS CAUGHT
              </div>
            </div>
            <div
              style={{
                background: "rgba(16, 185, 129, 0.1)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderLeft: "3px solid #10B981",
                borderRadius: 6,
                padding: "8px 10px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 900, color: "#10B981", fontFamily: "'JetBrains Mono', monospace" }}>
                {result.correctly_spared}/{result.total_clean}
              </div>
              <div style={{ fontSize: 9.5, color: "#94A3B8", fontWeight: 700, letterSpacing: "0.05em" }}>
                CLEAN WALLET SPARED
              </div>
            </div>
          </div>

          {/* D-P-R Proof Statement */}
          <div
            style={{
              background: "rgba(56, 189, 248, 0.06)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 11,
              color: "#94A3B8",
              lineHeight: 1.55,
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#38BDF8", fontWeight: 700 }}>D-P-R Graph Scoring: </span>
            {result.narrative_summary.split(". ").slice(0, 2).join(". ")}
          </div>

          <button
            onClick={() => { setStatus("idle"); setResult(null); setElapsed(0); setTxCount(0); }}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 6,
              color: "#94A3B8",
              fontSize: 10.5,
              fontWeight: 700,
              padding: "5px 0",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ↺ Reset
          </button>
        </div>
      )}

      {/* In-Progress Ticker */}
      {status === "running" && (
        <div
          style={{
            background: "rgba(11, 17, 33, 0.96)",
            border: "1px solid rgba(251, 191, 36, 0.3)",
            borderBottom: "none",
            borderRadius: "12px 12px 0 0",
            padding: "10px 14px",
            backdropFilter: "blur(20px)",
            animation: "slideUp 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#FBBF24", boxShadow: "0 0 8px #FBBF24", animation: "pulse 1s ease-in-out infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#FBBF24", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.05em" }}>
                REPLAYING CASE…
              </span>
            </div>
            <span style={{ fontSize: 11, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
              {formatElapsed(elapsed)}
            </span>
          </div>

          {/* Progress bar */}
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 4, height: 4, overflow: "hidden" }}>
            <div
              style={{
                height: "100%",
                background: "linear-gradient(90deg, #FBBF24, #F97316)",
                borderRadius: 4,
                width: `${(txCount / totalTxs) * 100}%`,
                transition: "width 0.4s ease",
              }}
            />
          </div>

          <div style={{ marginTop: 6, fontSize: 10, color: "#64748B", fontFamily: "'JetBrains Mono', monospace" }}>
            Replaying transaction {Math.min(txCount + 1, totalTxs)}/{totalTxs} — check Live Feed for real-time events
          </div>
        </div>
      )}

      {/* Trigger Button */}
      <button
        onClick={startReplay}
        disabled={status === "running"}
        style={{
          width: "100%",
          background:
            status === "running"
              ? "rgba(251, 191, 36, 0.15)"
              : status === "complete"
              ? "rgba(16, 185, 129, 0.12)"
              : "linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(168,85,247,0.25) 100%)",
          border: `1px solid ${
            status === "running" ? "rgba(251,191,36,0.4)"
            : status === "complete" ? "rgba(16,185,129,0.4)"
            : "rgba(99,102,241,0.5)"
          }`,
          borderRadius: status === "idle" ? 12 : "0 0 12px 12px",
          color:
            status === "running" ? "#FBBF24"
            : status === "complete" ? "#10B981"
            : "#A78BFA",
          fontSize: 12,
          fontWeight: 800,
          padding: "11px 0",
          cursor: status === "running" ? "wait" : "pointer",
          letterSpacing: "0.05em",
          backdropFilter: "blur(20px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          boxShadow: status === "idle" ? "0 8px 20px rgba(99,102,241,0.2)" : "none",
          transition: "all 0.2s ease",
          fontFamily: "'JetBrains Mono', monospace",
        }}
      >
        {status === "running" ? (
          <><span style={{ animation: "pulse 1s ease-in-out infinite" }}>⏳</span> REPLAYING FRAUD CASE…</>
        ) : status === "complete" ? (
          <><span>✅</span> REPLAY AGAIN</>
        ) : (
          <><span>▶</span> REPLAY REAL FRAUD CASE</>
        )}
      </button>
    </div>
  );
}
