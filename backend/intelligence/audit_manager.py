"""
backend/intelligence/audit_manager.py — Decision Audit Trail Manager

Stores and retrieves immutable decision audit logs for both autonomous and human-directed enforcement actions.
"""

import json
import logging
import os
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("Rakshak.audit_manager")

AUDIT_LOG_FILE = Path(os.getenv("DECISION_AUDIT_LOG_PATH", "audit_log.json"))


@dataclass
class DecisionAuditEntry:
    wallet_address: str
    timestamp: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    severity_tier: str = "Low"
    confidence_level: str = "Low"
    signals_triggered: List[str] = field(default_factory=list)
    action_taken: str = "log_only"                # "auto_block" | "human_block" | "dismissed" | "quarantined" | "log_only"
    decided_by: str = "system"                   # "system" | user_id / operator address
    tx_hash: Optional[str] = None
    reason: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


class AuditTrailManager:
    """Manages persistent decision audit records."""

    def __init__(self, log_path: Path = AUDIT_LOG_FILE):
        self.log_path = log_path
        self._memory_cache: List[DecisionAuditEntry] = []
        self._load_existing_records()

    def _load_existing_records(self):
        if self.log_path.exists():
            try:
                with open(self.log_path, "r", encoding="utf-8") as f:
                    for line in f:
                        line = line.strip()
                        if not line:
                            continue
                        try:
                            item = json.loads(line)
                            entry = DecisionAuditEntry(
                                wallet_address=item.get("wallet_address") or item.get("wallet") or "unknown",
                                timestamp=item.get("timestamp") or datetime.now(timezone.utc).isoformat(),
                                severity_tier=item.get("severity_tier") or ("Critical" if item.get("risk_score", 0) >= 0.8 else "Low"),
                                confidence_level=item.get("confidence_level", "Low"),
                                signals_triggered=item.get("signals_triggered") or item.get("risk_hints") or [],
                                action_taken=item.get("action_taken", "log_only"),
                                decided_by=item.get("decided_by", "system"),
                                tx_hash=item.get("tx_hash"),
                                reason=item.get("reason"),
                            )
                            self._memory_cache.append(entry)
                        except Exception:
                            pass
            except Exception as e:
                logger.warning("Could not read audit log file: %s", e)

    def log_decision(
        self,
        wallet_address: str,
        severity_tier: str,
        confidence_level: str,
        signals_triggered: List[str],
        action_taken: str,
        decided_by: str = "system",
        tx_hash: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> DecisionAuditEntry:
        entry = DecisionAuditEntry(
            wallet_address=wallet_address.lower(),
            timestamp=datetime.now(timezone.utc).isoformat(),
            severity_tier=severity_tier,
            confidence_level=confidence_level,
            signals_triggered=signals_triggered,
            action_taken=action_taken,
            decided_by=decided_by,
            tx_hash=tx_hash,
            reason=reason,
        )
        self._memory_cache.insert(0, entry)

        # Write to JSONL
        try:
            self.log_path.parent.mkdir(parents=True, exist_ok=True)
            with open(self.log_path, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry.to_dict()) + "\n")
        except Exception as e:
            logger.error("Failed to append to audit log: %s", e)

        return entry

    def get_audit_trail_for_wallet(self, wallet_address: str) -> List[Dict[str, Any]]:
        addr = wallet_address.lower()
        return [
            entry.to_dict()
            for entry in self._memory_cache
            if entry.wallet_address.lower() == addr
        ]

    def get_all_audit_logs(self, limit: int = 50) -> List[Dict[str, Any]]:
        return [entry.to_dict() for entry in self._memory_cache[:limit]]


_audit_manager_instance = AuditTrailManager()


def get_audit_manager() -> AuditTrailManager:
    return _audit_manager_instance
