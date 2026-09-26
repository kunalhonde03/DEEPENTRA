"""
backend/intelligence/trust_engine/models.py — Data Models for Progressive Trust System
"""

from datetime import datetime
from enum import Enum
from typing import Any, List, Optional
from pydantic import BaseModel, Field


class TrustStatus(str, Enum):
    NEW = "NEW"
    TRUSTED = "TRUSTED"


class WeeklyRecord(BaseModel):
    week_number: int = Field(..., description="0-indexed week from wallet inception")
    has_transaction: bool = Field(..., description="True if >= 1 tx occurred in this 7-day window")
    transaction_count_this_week: int = Field(0, description="Count of transactions in this 7-day window")
    start_day: int = Field(0, description="Start day offset from first transaction")
    end_day: int = Field(7, description="End day offset from first transaction")


class WalletTrustProfile(BaseModel):
    address: str
    first_transaction_at: datetime
    last_transaction_at: Optional[datetime] = None
    transaction_count: int = 0
    trust_status: TrustStatus = TrustStatus.NEW
    weekly_activity: List[WeeklyRecord] = Field(default_factory=list)


class TrustStatusResponse(BaseModel):
    wallet_address: str
    trust_status: TrustStatus
    days_since_creation: int
    weeks_completed: int
    weeks_missed: int
    total_weeks_evaluated: int
    transaction_count: int
    transactions_needed: int
    has_dead_weeks: bool
    graduation_eta: str
    conditions: dict[str, bool]
    weekly_activity: List[WeeklyRecord] = Field(default_factory=list)


class BackfillWeek(BaseModel):
    week: int
    count: int = 1


class SimulateTimeRequest(BaseModel):
    days_to_advance: int = Field(45, description="Number of days to simulate passing")
    transactions_to_backfill: List[BackfillWeek] = Field(
        default_factory=list,
        description="List of {week: int, count: int} to populate weekly activity"
    )
