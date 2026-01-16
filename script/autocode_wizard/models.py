"""
Models Module
=============

Data classes for configuration and state management.
These are the core data structures used throughout the wizard.
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional


# =============================================================================
# Configuration Data Classes
# =============================================================================

@dataclass
class RateLimitConfig:
    """Configuration for rate limit handling."""
    anthropic_cooldown_minutes: int = 5
    default_cooldown_minutes: int = 1


@dataclass
class ProviderConfig:
    """Configuration for provider management."""
    enabled_providers: List[str] = field(default_factory=lambda: [
        "github-copilot", "google", "opencode", "openai"
    ])
    blocked_providers: List[str] = field(default_factory=lambda: ["anthropic"])
    fallback_chain: List[str] = field(default_factory=lambda: [
        "github-copilot", "openai", "google", "opencode", "amazon-bedrock"
    ])


@dataclass
class LoggingConfig:
    """Configuration for logging behavior."""
    verbose_models: bool = True
    log_technique_selection: bool = True
    log_escalation: bool = True
    log_rate_limits: bool = True
    log_spending: bool = True
    spending_milestone_interval: float = 1.0


@dataclass
class AutoRouterConfig:
    """Configuration for the auto-router feature."""
    enabled: bool = True
    default_budget: str = "cheap"
    auto_escalate: bool = True
    max_escalations: int = 3
    quality_threshold: float = 0.7
    max_budget_tier: str = "expensive"
    active_profile: str = "balanced"


@dataclass
class FullConfig:
    """Complete configuration combining all sub-configs."""
    auto_router: AutoRouterConfig = field(default_factory=AutoRouterConfig)
    rate_limits: RateLimitConfig = field(default_factory=RateLimitConfig)
    providers: ProviderConfig = field(default_factory=ProviderConfig)
    logging: LoggingConfig = field(default_factory=LoggingConfig)


# =============================================================================
# Usage Statistics Data Class
# =============================================================================

@dataclass
class UsageStats:
    """Usage statistics for tracking costs and performance."""
    total_tasks: int = 0
    total_tokens_in: int = 0
    total_tokens_out: int = 0
    total_cost_estimate: float = 0.0
    tasks_by_tier: Dict[str, int] = field(default_factory=dict)
    tasks_by_technique: Dict[str, int] = field(default_factory=dict)
    cost_by_provider: Dict[str, float] = field(default_factory=dict)
    tokens_by_provider: Dict[str, int] = field(default_factory=dict)
    escalations: int = 0
    rate_limit_hits: int = 0
    last_task_at: Optional[str] = None
    session_start: Optional[str] = None

    @property
    def total_tokens(self) -> int:
        """Get total tokens (input + output)."""
        return self.total_tokens_in + self.total_tokens_out

    @property
    def average_cost_per_task(self) -> float:
        """Get average cost per task."""
        if self.total_tasks == 0:
            return 0.0
        return self.total_cost_estimate / self.total_tasks
