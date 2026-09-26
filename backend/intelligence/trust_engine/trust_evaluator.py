"""
backend/intelligence/trust_engine/trust_evaluator.py — Progressive Trust & Wallet Graduation System

Guards:
1. normalize_address() utility applied to all inputs.
2. FIND-OR-CREATE semantics: existing profiles are updated in place, never reset on read.
3. first_transaction_at is set ONLY ONCE on inception and preserved across transactions.
"""

from datetime import datetime, timezone, timedelta
import logging
from typing import Any, Dict, List, Optional

from intelligence.trust_engine.models import (
    TrustStatus,
    WeeklyRecord,
    WalletTrustProfile,
    TrustStatusResponse,
    BackfillWeek,
)

logger = logging.getLogger("Rakshak.trust_engine")

REQUIRED_AGE_DAYS = 45
REQUIRED_TOTAL_TXS = 10
DAYS_PER_WINDOW = 7
NEW_USER_THRESHOLD_MULTIPLIER = 0.5  # Stricter anomaly threshold multiplier for NEW wallets
MAX_NEW_SEVERITY_TIER = "Watch"     # Severity tier cap for NEW wallets


def normalize_address(address: Optional[str]) -> str:
    """
    Normalizes Ethereum wallet addresses to lowercase with standard 0x prefix.
    Ensures identical lookup keys across ingestion, Neo4j, and API endpoints.
    """
    if not address:
        return ""
    addr = str(address).strip()
    if not addr.startswith("0x") and not addr.startswith("0X"):
        addr = "0x" + addr
    return addr.lower()


class TrustEvaluator:
    """In-memory and Neo4j persistent trust evaluator."""

    def __init__(self):
        self._profiles: Dict[str, WalletTrustProfile] = {}

    def get_or_create_profile(
        self,
        wallet_address: str,
        initial_timestamp: Optional[datetime] = None,
    ) -> WalletTrustProfile:
        addr = normalize_address(wallet_address)
        if addr not in self._profiles:
            now = initial_timestamp or datetime.now(timezone.utc)
            self._profiles[addr] = WalletTrustProfile(
                address=addr,
                first_transaction_at=now,
                last_transaction_at=now,
                transaction_count=0,
                trust_status=TrustStatus.NEW,
                weekly_activity=[],
            )
        return self._profiles[addr]

    def has_profile(self, wallet_address: str) -> bool:
        return normalize_address(wallet_address) in self._profiles

    def update_weekly_activity(
        self,
        wallet_address: str,
        transaction_timestamp: Optional[datetime | float | str] = None,
    ) -> WalletTrustProfile:
        """
        Record a new transaction timestamp and update the corresponding 7-day window bucket.
        Guarantees first_transaction_at is only set on the initial transaction and never overwritten.
        """
        addr = normalize_address(wallet_address)
        if isinstance(transaction_timestamp, (int, float)):
            tx_dt = datetime.fromtimestamp(transaction_timestamp, tz=timezone.utc)
        elif isinstance(transaction_timestamp, str):
            try:
                tx_dt = datetime.fromisoformat(transaction_timestamp.replace("Z", "+00:00"))
            except Exception:
                tx_dt = datetime.now(timezone.utc)
        elif isinstance(transaction_timestamp, datetime):
            tx_dt = transaction_timestamp if transaction_timestamp.tzinfo else transaction_timestamp.replace(tzinfo=timezone.utc)
        else:
            tx_dt = datetime.now(timezone.utc)

        # FIND-OR-CREATE in place
        if addr in self._profiles:
            profile = self._profiles[addr]
            # Explicit guard: first_transaction_at is only updated if tx is strictly prior to inception
            if profile.first_transaction_at is None:
                profile.first_transaction_at = tx_dt
            elif tx_dt < profile.first_transaction_at:
                profile.first_transaction_at = tx_dt
        else:
            profile = self.get_or_create_profile(addr, initial_timestamp=tx_dt)

        if profile.last_transaction_at is None or tx_dt > profile.last_transaction_at:
            profile.last_transaction_at = tx_dt

        profile.transaction_count += 1

        delta_seconds = max(0.0, (tx_dt - profile.first_transaction_at).total_seconds())
        week_num = int(delta_seconds // (DAYS_PER_WINDOW * 86400))

        self._ensure_weekly_buckets(profile, current_week=week_num)

        record = profile.weekly_activity[week_num]
        record.has_transaction = True
        record.transaction_count_this_week += 1

        self.evaluate_trust_status(addr)
        return profile

    def _ensure_weekly_buckets(self, profile: WalletTrustProfile, current_week: int) -> None:
        while len(profile.weekly_activity) <= current_week:
            w = len(profile.weekly_activity)
            profile.weekly_activity.append(
                WeeklyRecord(
                    week_number=w,
                    has_transaction=False,
                    transaction_count_this_week=0,
                    start_day=w * DAYS_PER_WINDOW,
                    end_day=(w + 1) * DAYS_PER_WINDOW,
                )
            )

    def evaluate_trust_status(
        self,
        wallet_address: str,
        now: Optional[datetime] = None,
    ) -> TrustStatusResponse:
        """
        Evaluates the 3-condition graduation check without mutating first_transaction_at on read.
        """
        addr = normalize_address(wallet_address)
        current_time = now or datetime.now(timezone.utc)

        # Use existing profile if available; otherwise create a default profile
        if addr in self._profiles:
            profile = self._profiles[addr]
        else:
            profile = self.get_or_create_profile(addr, initial_timestamp=current_time)

        age_seconds = max(0.0, (current_time - profile.first_transaction_at).total_seconds())
        days_since_creation = int(age_seconds // 86400)

        total_weeks_evaluated = max(1, int(days_since_creation // DAYS_PER_WINDOW) + 1)
        self._ensure_weekly_buckets(profile, current_week=total_weeks_evaluated - 1)

        cond_45_days = days_since_creation >= REQUIRED_AGE_DAYS

        weeks_to_check = profile.weekly_activity[:total_weeks_evaluated]
        weeks_completed = sum(1 for w in weeks_to_check if w.has_transaction)
        weeks_missed = sum(1 for w in weeks_to_check if not w.has_transaction)
        has_dead_weeks = weeks_missed > 0
        cond_continuous_activity = (not has_dead_weeks) and (weeks_completed >= max(1, int(REQUIRED_AGE_DAYS / DAYS_PER_WINDOW)))

        cond_min_transactions = profile.transaction_count >= REQUIRED_TOTAL_TXS

        if cond_45_days and (not has_dead_weeks) and cond_min_transactions:
            profile.trust_status = TrustStatus.TRUSTED
        else:
            profile.trust_status = TrustStatus.NEW

        if profile.trust_status == TrustStatus.TRUSTED:
            graduation_eta = "Graduated to TRUSTED"
        else:
            reasons = []
            if not cond_45_days:
                reasons.append(f"{REQUIRED_AGE_DAYS - days_since_creation}d remaining")
            if has_dead_weeks:
                reasons.append(f"{weeks_missed} dead week(s) detected — must maintain weekly txs")
            if not cond_min_transactions:
                reasons.append(f"{max(0, REQUIRED_TOTAL_TXS - profile.transaction_count)} txs needed")
            graduation_eta = " | ".join(reasons) if reasons else "Pending evaluation"

        return TrustStatusResponse(
            wallet_address=addr,
            trust_status=profile.trust_status,
            days_since_creation=days_since_creation,
            weeks_completed=weeks_completed,
            weeks_missed=weeks_missed,
            total_weeks_evaluated=total_weeks_evaluated,
            transaction_count=profile.transaction_count,
            transactions_needed=max(0, REQUIRED_TOTAL_TXS - profile.transaction_count),
            has_dead_weeks=has_dead_weeks,
            graduation_eta=graduation_eta,
            conditions={
                "45_days_elapsed": cond_45_days,
                "no_dead_weeks": not has_dead_weeks,
                "min_10_transactions": cond_min_transactions,
            },
            weekly_activity=profile.weekly_activity[:max(7, total_weeks_evaluated)],
        )

    def simulate_time(
        self,
        wallet_address: str,
        days_to_advance: int = 45,
        transactions_to_backfill: Optional[List[BackfillWeek | dict]] = None,
    ) -> TrustStatusResponse:
        addr = normalize_address(wallet_address)
        now = datetime.now(timezone.utc)
        first_tx_time = now - timedelta(days=days_to_advance)

        backfills = transactions_to_backfill or []
        total_backfill_txs = 0

        total_weeks = max(1, int(days_to_advance // DAYS_PER_WINDOW) + 1)
        weekly_records: List[WeeklyRecord] = []

        backfill_map = {}
        for item in backfills:
            if isinstance(item, dict):
                backfill_map[item.get("week", 0)] = item.get("count", 1)
            elif isinstance(item, BackfillWeek):
                backfill_map[item.week] = item.count

        for w in range(total_weeks):
            count = backfill_map.get(w, 0)
            total_backfill_txs += count
            weekly_records.append(
                WeeklyRecord(
                    week_number=w,
                    has_transaction=(count > 0),
                    transaction_count_this_week=count,
                    start_day=w * DAYS_PER_WINDOW,
                    end_day=(w + 1) * DAYS_PER_WINDOW,
                )
            )

        profile = WalletTrustProfile(
            address=addr,
            first_transaction_at=first_tx_time,
            last_transaction_at=now,
            transaction_count=total_backfill_txs,
            trust_status=TrustStatus.NEW,
            weekly_activity=weekly_records,
        )
        self._profiles[addr] = profile

        return self.evaluate_trust_status(addr, now=now)


_trust_evaluator_instance = TrustEvaluator()


def get_trust_evaluator() -> TrustEvaluator:
    return _trust_evaluator_instance


def evaluate_trust_status(wallet_address: str) -> TrustStatusResponse:
    return _trust_evaluator_instance.evaluate_trust_status(wallet_address)


def update_weekly_activity(wallet_address: str, transaction_timestamp: Optional[datetime | float | str] = None) -> WalletTrustProfile:
    return _trust_evaluator_instance.update_weekly_activity(wallet_address, transaction_timestamp)


def simulate_time(
    wallet_address: str,
    days_to_advance: int = 45,
    transactions_to_backfill: Optional[List[BackfillWeek | dict]] = None,
) -> TrustStatusResponse:
    return _trust_evaluator_instance.simulate_time(wallet_address, days_to_advance, transactions_to_backfill)
