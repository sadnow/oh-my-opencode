"""
Display Module
==============

UI display utilities for formatting output in the terminal.
Includes headers, sections, status displays, and expense reports.
"""

import time
from typing import TYPE_CHECKING

from .constants import OPENCODE_DIR, RATE_LIMIT_STATE

if TYPE_CHECKING:
    from .models import FullConfig, UsageStats


# =============================================================================
# Formatting Utilities
# =============================================================================

def print_header(title: str, width: int = 70) -> None:
    """Print a formatted header with borders."""
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)


def print_section(title: str) -> None:
    """Print a section header."""
    print(f"\n--- {title} ---")


def format_cost(cost: float) -> str:
    """Format a cost value for display."""
    if cost == 0:
        return "$0.00"
    elif cost < 0.01:
        return f"${cost:.4f}"
    else:
        return f"${cost:.2f}"


def format_tokens(tokens: int) -> str:
    """Format token count with comma separators."""
    return f"{tokens:,}"


def format_percentage(value: float, total: float) -> str:
    """Format a percentage value."""
    if total == 0:
        return "0.0%"
    return f"{(value / total * 100):.1f}%"


def make_bar(percentage: float, width: int = 20) -> str:
    """Create a progress bar string."""
    filled = int(percentage / 100 * width)
    return "█" * filled + "░" * (width - filled)


# =============================================================================
# Status Display
# =============================================================================

def print_status(config: "FullConfig") -> None:
    """Print current configuration status."""
    from .profiles import PROFILES
    from .config_io import load_rate_limit_state

    print_header("AutoCode Configuration Status")

    # Active profile
    profile = PROFILES.get(config.auto_router.active_profile)
    if profile:
        print(f"\n  Active Profile: {profile.name}")
        print(f"  Description: {profile.description}")

    print_section("Auto-Router Settings")
    print(f"  Enabled: {'Yes' if config.auto_router.enabled else 'No'}")
    print(f"  Default Budget: {config.auto_router.default_budget.upper()}")
    print(f"  Auto Escalate: {'Yes' if config.auto_router.auto_escalate else 'No'}")
    print(f"  Max Escalations: {config.auto_router.max_escalations}")
    print(f"  Max Budget Tier: {config.auto_router.max_budget_tier.upper()}")
    print(f"  Quality Threshold: {config.auto_router.quality_threshold}")

    print_section("Provider Fallback Chain")
    for i, provider in enumerate(config.providers.fallback_chain, 1):
        status = "ENABLED" if provider in config.providers.enabled_providers else "disabled"
        if provider in config.providers.blocked_providers:
            status = "BLOCKED"
        print(f"  {i}. {provider} ({status})")

    print_section("Logging Configuration")
    print(f"  Verbose Models: {'Yes' if config.logging.verbose_models else 'No'}")
    print(f"  Log Technique Selection: {'Yes' if config.logging.log_technique_selection else 'No'}")
    print(f"  Log Escalation: {'Yes' if config.logging.log_escalation else 'No'}")
    print(f"  Log Rate Limits: {'Yes' if config.logging.log_rate_limits else 'No'}")
    print(f"  Log Spending: {'Yes' if config.logging.log_spending else 'No'}")
    if config.logging.log_spending:
        print(f"  Spending Milestone: {format_cost(config.logging.spending_milestone_interval)}")

    # Show rate limit state
    state = load_rate_limit_state()
    if state.get("providers"):
        print_section("Active Rate Limits")
        now = time.time() * 1000
        for provider, pstate in state["providers"].items():
            cooldown_left = max(0, (pstate.get("cooldownUntil", 0) - now) / 60000)
            circuit = pstate.get("circuitState", "unknown")
            hits = pstate.get("hitCount", 0)
            print(f"  {provider}: {circuit.upper()} (hits: {hits}, cooldown: {cooldown_left:.1f}m)")

    print()


# =============================================================================
# Expense Display
# =============================================================================

def print_expenses(config: "FullConfig") -> None:
    """Print expense breakdown by provider."""
    from .config_io import load_usage_stats

    print_header("Expense Breakdown by Provider")

    stats = load_usage_stats()

    if stats.total_tasks == 0:
        print("\n  No usage data available yet.")
        print("  Run some /autocode tasks to see expense tracking.\n")
        return

    print_section("Summary")
    print(f"  Total Tasks: {stats.total_tasks}")
    print(f"  Total Tokens: {format_tokens(stats.total_tokens)}")
    print(f"    - Input: {format_tokens(stats.total_tokens_in)}")
    print(f"    - Output: {format_tokens(stats.total_tokens_out)}")
    print(f"  Estimated Total Cost: {format_cost(stats.total_cost_estimate)}")
    print(f"  Escalations: {stats.escalations}")
    print(f"  Rate Limit Hits: {stats.rate_limit_hits}")

    if stats.cost_by_provider:
        print_section("Cost by Provider")
        sorted_providers = sorted(
            stats.cost_by_provider.items(),
            key=lambda x: x[1],
            reverse=True
        )
        total = stats.total_cost_estimate or 1
        for provider, cost in sorted_providers:
            tokens = stats.tokens_by_provider.get(provider, 0)
            pct = (cost / total * 100) if total > 0 else 0
            bar = make_bar(pct)
            print(f"  {provider:20s} {format_cost(cost):>10s} {bar} {pct:5.1f}%")
            print(f"  {'':20s} {format_tokens(tokens):>10s} tokens")

    if stats.tasks_by_tier:
        print_section("Tasks by Budget Tier")
        for tier, count in sorted(stats.tasks_by_tier.items()):
            print(f"  {tier:12s}: {count} tasks")

    if stats.tasks_by_technique:
        print_section("Tasks by Technique")
        for technique, count in sorted(stats.tasks_by_technique.items()):
            print(f"  {technique:20s}: {count} tasks")

    if stats.last_task_at:
        print_section("Session Info")
        print(f"  Last Task: {stats.last_task_at}")
        if stats.session_start:
            print(f"  Session Start: {stats.session_start}")

    # Cost projection
    if stats.total_tasks > 0:
        avg_cost = stats.average_cost_per_task
        print_section("Cost Projections (based on current usage)")
        print(f"  Average cost per task: {format_cost(avg_cost)}")
        print(f"  Projected cost for 100 tasks: {format_cost(avg_cost * 100)}")
        print(f"  Projected cost for 1000 tasks: {format_cost(avg_cost * 1000)}")

    print()


# =============================================================================
# Profile Display
# =============================================================================

def print_profiles() -> None:
    """Print available profiles."""
    from .profiles import get_profiles_sorted_by_cost

    print_header("Available Configuration Profiles")

    for profile in get_profiles_sorted_by_cost():
        print(f"\n  {profile.name}")
        print(f"  ID: {profile.id}")
        print(f"  {profile.description}")
        print(f"  Cost per task: {profile.cost_range}")
        print(f"  Tags: {', '.join(profile.tags)}")

    print()
