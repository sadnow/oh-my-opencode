"""
Config I/O Module
=================

File I/O operations for configuration persistence.
Handles loading/saving config, usage stats, and rate limit state.
"""

import json
from typing import Any, Dict

from .constants import OPENCODE_DIR, PLUGIN_CONFIG, RATE_LIMIT_STATE, USAGE_STATS_FILE
from .models import (
    AutoRouterConfig,
    FullConfig,
    LoggingConfig,
    ProviderConfig,
    RateLimitConfig,
    UsageStats,
)


# =============================================================================
# Configuration Loading/Saving
# =============================================================================

def load_config() -> FullConfig:
    """Load configuration from disk or return defaults."""
    config = FullConfig()

    if PLUGIN_CONFIG.exists():
        try:
            with open(PLUGIN_CONFIG, "r") as f:
                data = json.load(f)

            if "auto_router" in data:
                ar = data["auto_router"]
                config.auto_router = AutoRouterConfig(
                    enabled=ar.get("enabled", True),
                    default_budget=ar.get("default_budget", "cheap"),
                    auto_escalate=ar.get("auto_escalate", True),
                    max_escalations=ar.get("max_escalations", 3),
                    quality_threshold=ar.get("quality_threshold", 0.7),
                    max_budget_tier=ar.get("max_budget_tier", "expensive"),
                    active_profile=ar.get("active_profile", "balanced"),
                )

            if "rate_limits" in data:
                rl = data["rate_limits"]
                config.rate_limits = RateLimitConfig(
                    anthropic_cooldown_minutes=rl.get("anthropic_cooldown_minutes", 5),
                    default_cooldown_minutes=rl.get("default_cooldown_minutes", 1),
                )

            if "providers" in data:
                p = data["providers"]
                config.providers = ProviderConfig(
                    enabled_providers=p.get("enabled_providers", config.providers.enabled_providers),
                    blocked_providers=p.get("blocked_providers", ["anthropic"]),
                    fallback_chain=p.get("fallback_chain", config.providers.fallback_chain),
                )

            if "logging" in data:
                lg = data["logging"]
                config.logging = LoggingConfig(
                    verbose_models=lg.get("verbose_models", True),
                    log_technique_selection=lg.get("log_technique_selection", True),
                    log_escalation=lg.get("log_escalation", True),
                    log_rate_limits=lg.get("log_rate_limits", True),
                    log_spending=lg.get("log_spending", True),
                    spending_milestone_interval=lg.get("spending_milestone_interval", 1.0),
                )
        except Exception as e:
            print(f"Warning: Failed to load config: {e}")

    return config


def save_config(config: FullConfig) -> bool:
    """Save configuration to disk."""
    try:
        OPENCODE_DIR.mkdir(parents=True, exist_ok=True)

        # Load existing config to preserve other settings
        existing: Dict[str, Any] = {}
        if PLUGIN_CONFIG.exists():
            with open(PLUGIN_CONFIG, "r") as f:
                existing = json.load(f)

        # Update with our settings
        existing["auto_router"] = {
            "enabled": config.auto_router.enabled,
            "default_budget": config.auto_router.default_budget,
            "auto_escalate": config.auto_router.auto_escalate,
            "max_escalations": config.auto_router.max_escalations,
            "quality_threshold": config.auto_router.quality_threshold,
            "max_budget_tier": config.auto_router.max_budget_tier,
            "active_profile": config.auto_router.active_profile,
        }

        existing["rate_limits"] = {
            "anthropic_cooldown_minutes": config.rate_limits.anthropic_cooldown_minutes,
            "default_cooldown_minutes": config.rate_limits.default_cooldown_minutes,
        }

        existing["providers"] = {
            "enabled_providers": config.providers.enabled_providers,
            "blocked_providers": config.providers.blocked_providers,
            "fallback_chain": config.providers.fallback_chain,
        }

        existing["logging"] = {
            "verbose_models": config.logging.verbose_models,
            "log_technique_selection": config.logging.log_technique_selection,
            "log_escalation": config.logging.log_escalation,
            "log_rate_limits": config.logging.log_rate_limits,
            "log_spending": config.logging.log_spending,
            "spending_milestone_interval": config.logging.spending_milestone_interval,
        }

        with open(PLUGIN_CONFIG, "w") as f:
            json.dump(existing, f, indent=2)

        print(f"Configuration saved to {PLUGIN_CONFIG}")
        return True

    except Exception as e:
        print(f"Error saving config: {e}")
        return False


# =============================================================================
# Usage Statistics
# =============================================================================

def load_usage_stats() -> UsageStats:
    """Load usage statistics from disk."""
    stats = UsageStats()
    if USAGE_STATS_FILE.exists():
        try:
            with open(USAGE_STATS_FILE, "r") as f:
                data = json.load(f)
            stats = UsageStats(
                total_tasks=data.get("total_tasks", 0),
                total_tokens_in=data.get("total_tokens_in", 0),
                total_tokens_out=data.get("total_tokens_out", 0),
                total_cost_estimate=data.get("total_cost_estimate", 0.0),
                tasks_by_tier=data.get("tasks_by_tier", {}),
                tasks_by_technique=data.get("tasks_by_technique", {}),
                cost_by_provider=data.get("cost_by_provider", {}),
                tokens_by_provider=data.get("tokens_by_provider", {}),
                escalations=data.get("escalations", 0),
                rate_limit_hits=data.get("rate_limit_hits", 0),
                last_task_at=data.get("last_task_at"),
                session_start=data.get("session_start"),
            )
        except Exception:
            pass
    return stats


def save_usage_stats(stats: UsageStats) -> bool:
    """Save usage statistics to disk."""
    try:
        OPENCODE_DIR.mkdir(parents=True, exist_ok=True)
        with open(USAGE_STATS_FILE, "w") as f:
            json.dump({
                "total_tasks": stats.total_tasks,
                "total_tokens_in": stats.total_tokens_in,
                "total_tokens_out": stats.total_tokens_out,
                "total_cost_estimate": stats.total_cost_estimate,
                "tasks_by_tier": stats.tasks_by_tier,
                "tasks_by_technique": stats.tasks_by_technique,
                "cost_by_provider": stats.cost_by_provider,
                "tokens_by_provider": stats.tokens_by_provider,
                "escalations": stats.escalations,
                "rate_limit_hits": stats.rate_limit_hits,
                "last_task_at": stats.last_task_at,
                "session_start": stats.session_start,
            }, f, indent=2)
        return True
    except Exception as e:
        print(f"Error saving usage stats: {e}")
        return False


def clear_usage_stats() -> bool:
    """Clear usage statistics."""
    try:
        if USAGE_STATS_FILE.exists():
            USAGE_STATS_FILE.unlink()
        print("Usage statistics cleared.")
        return True
    except Exception as e:
        print(f"Error clearing usage stats: {e}")
        return False


# =============================================================================
# Rate Limit State
# =============================================================================

def load_rate_limit_state() -> Dict[str, Any]:
    """Load rate limit state from disk."""
    if RATE_LIMIT_STATE.exists():
        try:
            with open(RATE_LIMIT_STATE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return {"providers": {}, "lastUpdated": 0, "version": 1}


def clear_rate_limit_state() -> bool:
    """Clear rate limit state file."""
    try:
        if RATE_LIMIT_STATE.exists():
            RATE_LIMIT_STATE.unlink()
        print("Rate limit state cleared.")
        return True
    except Exception as e:
        print(f"Error clearing rate limit state: {e}")
        return False


# =============================================================================
# Profile Application
# =============================================================================

def apply_profile(config: FullConfig, profile_id: str) -> bool:
    """Apply a profile to the configuration."""
    from .profiles import PROFILES

    if profile_id not in PROFILES:
        print(f"Unknown profile: {profile_id}")
        print(f"Available profiles: {', '.join(PROFILES.keys())}")
        return False

    profile = PROFILES[profile_id]
    config.auto_router.active_profile = profile_id
    config.auto_router.default_budget = profile.default_budget
    config.auto_router.auto_escalate = profile.auto_escalate
    config.auto_router.max_escalations = profile.max_escalations
    config.auto_router.quality_threshold = profile.quality_threshold
    config.auto_router.max_budget_tier = profile.max_budget_tier
    config.providers.fallback_chain = profile.fallback_chain
    config.logging.verbose_models = profile.verbose_logging
    config.logging.log_spending = profile.log_spending
    config.logging.spending_milestone_interval = profile.spending_milestone

    # Enable providers based on fallback chain
    config.providers.enabled_providers = list(set(profile.fallback_chain))

    print(f"\nApplied profile: {profile.name}")
    print(f"  {profile.description}")
    return True
