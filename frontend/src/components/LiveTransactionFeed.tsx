/**
 * LiveTransactionFeed.tsx — Real-Time On-Chain Transaction Stream
 * Rakshak On-Chain Immunity System (Feature 1)
 */

import { useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000/ws/transaction-feed";

export interface TransactionFeedItem {
  id: string;
  tx_hash: string;
  from_wallet: string;
  to_wallet: string;
  stage: "analyzing" | "scored" | "complete";
  risk_score?: number | null;
  tier?: "CRITICAL" | "ELEVATED" | "WATCH" | "CLEAR" | string | null;
  keyword?: string;
  category?: string;
  summary?: string;
  value_eth: number;
  action?: string;
  timestamp: string;
}

interface LiveTransactionFeedProps {
  onSelectWallet?: (walletAddress: string) => void;
}

export default function LiveTransactionFeed({ onSelectWallet }: LiveTransactionFeedProps) {
  const [feed, setFeed] = useState<TransactionFeedItem[]>([]);
  const [connected, setConnected] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [injecting, setInjecting] = useState<boolean>(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Connect to WebSocket with auto-reconnect
  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let pingInterval: NodeJS.Timeout;

    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(WS_BASE);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send("ping");
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          if (event.data === "pong") return;
          try {
            const data: TransactionFeedItem = JSON.parse(event.data);
            setFeed((prev) => {
              // Update existing tx if same hash & stage progressed, or prepend
              const existingIdx = prev.findIndex((item) => item.tx_hash === data.tx_hash);
              if (existingIdx !== -1) {
                const copy = [...prev];
                copy[existingIdx] = data;
                return copy;
              } else {
                return [data, ...prev.slice(0, 19)];
              }
            });
          } catch (err) {
            console.error("Error parsing WebSocket event:", err);
          }
        };

        ws.onclose = () => {
          setConnected(false);
          clearInterval(pingInterval);
          reconnectTimeout = setTimeout(connectWebSocket, 3000);
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch (err) {
        console.error("WebSocket connection error:", err);
        reconnectTimeout = setTimeout(connectWebSocket, 3000);
      }
    };

    connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeout);
      clearInterval(pingInterval);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  // Demo injection trigger
  const handleInject = async (isMalicious: boolean) => {
    setInjecting(true);
    try {
      await fetch(`${API_BASE}/api/demo/inject-transaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          value_eth: isMalicious ? 14.5 : 1.25,
          is_malicious: isMalicious,
        }),
      });
    } catch (err) {
      console.error("Failed to inject demo transaction:", err);
    } finally {
      setTimeout(() => setInjecting(false), 800);
    }
  };

  const getTierColor = (tier?: string | null, stage?: string) => {
    if (stage === "analyzing") return "#00D4FF";
    switch (tier?.toUpperCase()) {
      case "CRITICAL":
        return "#FF3B3B";
      case "ELEVATED":
        return "#FF8C00";
      case "WATCH":
        return "#F59E0B";
      case "CLEAR":
      case "SAFE":
      default:
        return "#10B981";
    }
  };

  const formatAddress = (addr: string) => {
    if (!addr) return "0x0000…0000";
    return addr.length > 10 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
      if (diffSec <= 2) return "just now";
      if (diffSec < 60) return `${diffSec}s ago`;
      return `${Math.floor(diffSec / 60)}m ago`;
    } catch {
      return "just now";
    }
  };

  if (isMinimized) {
    return (
      <div
        onClick={() => setIsMinimized(false)}
        style={{
          position: "absolute",
          bottom: 18,
          left: 18,
          zIndex: 40,
          background: "rgba(11, 17, 33, 0.92)",
          border: "1px solid rgba(0, 212, 255, 0.3)",
          borderRadius: 9999,
          padding: "6px 14px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: "pointer",
          backdropFilter: "blur(16px)",
          boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
          transition: "all 0.2s ease",
        }}
      >
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: connected ? "#10B981" : "#FF3B3B",
            boxShadow: connected ? "0 0 8px #10B981" : "none",
          }}
        />
        <span style={{ color: "#E2E8F0", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
          ⚡ LIVE TRANSACTION STREAM ({feed.length})
        </span>
        <span style={{ color: "#00D4FF", fontSize: 11 }}>▲</span>
      </div>
    );
  }

  return (
    <div
      style={{
        position: "absolute",
        bottom: 18,
        left: 18,
        width: 360,
        maxHeight: 330,
        zIndex: 40,
        background: "rgba(11, 17, 33, 0.94)",
        border: "1px solid rgba(255, 255, 255, 0.08)",
        borderRadius: 12,
        backdropFilter: "blur(20px)",
        boxShadow: "0 16px 40px -8px rgba(0, 0, 0, 0.75)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Feed Header */}
      <div
        style={{
          padding: "10px 14px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
          background: "rgba(15, 23, 42, 0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: connected ? "#10B981" : "#FF3B3B",
              boxShadow: connected ? "0 0 8px #10B981" : "none",
              animation: connected ? "pulse 1.5s ease-in-out infinite" : "none",
            }}
          />
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 800,
              color: "#F1F5F9",
              letterSpacing: "0.06em",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            ⚡ LIVE PIPELINE FEED
          </span>
          <span
            style={{
              fontSize: 9,
              padding: "1px 5px",
              borderRadius: 3,
              background: connected ? "rgba(16,185,129,0.15)" : "rgba(255,59,59,0.15)",
              color: connected ? "#10B981" : "#FF3B3B",
              fontWeight: 700,
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            {connected ? "STREAMING" : "OFFLINE"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Quick Demo Trigger Buttons */}
          <button
            onClick={() => handleInject(false)}
            disabled={injecting}
            style={{
              background: "rgba(16, 185, 129, 0.12)",
              border: "1px solid rgba(16, 185, 129, 0.3)",
              borderRadius: 4,
              color: "#10B981",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              cursor: injecting ? "wait" : "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title="Inject simulated DeFi swap"
          >
            + Safe
          </button>
          <button
            onClick={() => handleInject(true)}
            disabled={injecting}
            style={{
              background: "rgba(255, 59, 59, 0.15)",
              border: "1px solid rgba(255, 59, 59, 0.4)",
              borderRadius: 4,
              color: "#FF3B3B",
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 6px",
              cursor: injecting ? "wait" : "pointer",
              fontFamily: "'JetBrains Mono', monospace",
            }}
            title="Inject simulated exploit drainage"
          >
            + Threat
          </button>

          <button
            onClick={() => setIsMinimized(true)}
            style={{
              background: "transparent",
              border: "none",
              color: "#64748B",
              cursor: "pointer",
              fontSize: 11,
              padding: "0 4px",
            }}
            title="Minimize feed"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Scrolling Events Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "6px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        {feed.length === 0 ? (
          <div style={{ textAlign: "center", padding: "20px 0", color: "#64748B", fontSize: 11 }}>
            Waiting for live transactions…
          </div>
        ) : (
          feed.map((tx) => {
            const color = getTierColor(tx.tier, tx.stage);
            const isAnalyzing = tx.stage === "analyzing";
            const riskPct = tx.risk_score !== null && tx.risk_score !== undefined ? `${(tx.risk_score * 100).toFixed(0)}%` : "--";

            return (
              <div
                key={tx.id}
                onClick={() => onSelectWallet?.(tx.to_wallet || tx.from_wallet)}
                style={{
                  background: isAnalyzing ? "rgba(0, 212, 255, 0.04)" : "rgba(255, 255, 255, 0.025)",
                  border: `1px solid ${isAnalyzing ? "rgba(0, 212, 255, 0.25)" : color + "35"}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 6,
                  padding: "7px 9px",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
                title="Click to inspect this wallet in the 3D Galaxy"
              >
                {/* Top Row: Flow & Risk Badge */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 11,
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#CBD5E1",
                    }}
                  >
                    <span>{formatAddress(tx.from_wallet)}</span>
                    <span style={{ color: "#64748B" }}>→</span>
                    <span style={{ color: "#F1F5F9", fontWeight: 600 }}>{formatAddress(tx.to_wallet)}</span>
                  </div>

                  {/* Stage or Risk Outcome */}
                  {isAnalyzing ? (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 700,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: "rgba(0, 212, 255, 0.15)",
                        border: "1px solid rgba(0, 212, 255, 0.4)",
                        color: "#00D4FF",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      ⏳ Analyzing…
                    </span>
                  ) : (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        padding: "1px 6px",
                        borderRadius: 3,
                        background: `${color}18`,
                        border: `1px solid ${color}60`,
                        color,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {tx.tier ?? "SCORED"} ({riskPct})
                    </span>
                  )}
                </div>

                {/* Bottom Row: Value, Archetype & Time */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 10,
                    color: "#94A3B8",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  <span style={{ color: "#38BDF8" }}>
                    {tx.value_eth} ETH
                    {tx.keyword && (
                      <span style={{ color: "#64748B", marginLeft: 6 }}>
                        • {tx.keyword}
                      </span>
                    )}
                  </span>
                  <span style={{ color: "#64748B" }}>{formatRelativeTime(tx.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
