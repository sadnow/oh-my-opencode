"""
Constants Module
================

Enums and constant definitions for the AutoCode wizard.
Includes budget tiers, provider definitions, and model costs.
"""

from enum import Enum
from pathlib import Path
from typing import Set, Dict


# =============================================================================
# Configuration Paths
# =============================================================================

HOME = Path.home()
OPENCODE_DIR = HOME / ".opencode"
PLUGIN_CONFIG = OPENCODE_DIR / "oh-my-opencode.json"
RATE_LIMIT_STATE = OPENCODE_DIR / "rate-limit-state.json"
USAGE_STATS_FILE = OPENCODE_DIR / "usage-stats.json"
PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()


# =============================================================================
# Enums
# =============================================================================

class BudgetTier(Enum):
    """Available budget tiers for the auto-router."""
    FREE = "free"
    CHEAP = "cheap"
    MODERATE = "moderate"
    EXPENSIVE = "expensive"
    MAXIMUM = "maximum"


class Provider(Enum):
    """Supported AI model providers."""
    GITHUB_COPILOT = "github-copilot"
    GOOGLE = "google"
    OPENCODE = "opencode"
    OPENAI = "openai"
    AMAZON_BEDROCK = "amazon-bedrock"
    ANTHROPIC = "anthropic"  # Always blocked


# =============================================================================
# Blocked Providers
# =============================================================================

BLOCKED_PROVIDERS: Set[Provider] = {Provider.ANTHROPIC}


# =============================================================================
# Model Cost Estimates
# =============================================================================

# Cost per 1K tokens (input + output averaged)
# Based on published pricing as of Jan 2026
MODEL_COSTS_PER_1K: Dict[str, float] = {
    # GitHub Copilot (included in subscription, but tracked for comparison)
    "github-copilot/gpt-4o": 0.005,
    "github-copilot/gpt-4o-mini": 0.0003,
    "github-copilot/gpt-5.2": 0.015,
    "github-copilot/claude-sonnet-4": 0.006,
    "github-copilot/claude-opus-4-5": 0.030,
    # OpenAI direct
    "openai/gpt-4o": 0.005,
    "openai/gpt-4o-mini": 0.0003,
    "openai/gpt-5.2": 0.015,
    "openai/o1": 0.030,
    # Google (free via Antigravity)
    "google/antigravity-gemini-3-flash": 0.0,
    "google/antigravity-gemini-3-pro-high": 0.0,
    # OpenCode free
    "opencode/grok-code": 0.0,
    "opencode/glm-4.7-free": 0.0,
    # Amazon Bedrock
    "amazon-bedrock/claude-sonnet-4": 0.006,
    "amazon-bedrock/claude-opus-4-5": 0.030,
}


# =============================================================================
# Human-Readable Descriptions
# =============================================================================

BUDGET_TIER_DESCRIPTIONS: Dict[BudgetTier, str] = {
    BudgetTier.FREE: "Free models only (GLM, Grok, Antigravity)",
    BudgetTier.CHEAP: "Low-cost (GPT-4o, GPT-4o-mini)",
    BudgetTier.MODERATE: "Balanced (Claude Sonnet 4, GPT-4o)",
    BudgetTier.EXPENSIVE: "High-quality (GPT-5.2, Claude Sonnet 4)",
    BudgetTier.MAXIMUM: "Best available (Claude Opus 4.5, GPT-5.2)",
}

PROVIDER_DESCRIPTIONS: Dict[Provider, str] = {
    Provider.GITHUB_COPILOT: "GitHub Copilot CLI (GPT-4o, GPT-5.2, Claude)",
    Provider.GOOGLE: "Google Antigravity (Gemini, FREE)",
    Provider.OPENCODE: "OpenCode built-in (GLM, Grok, FREE)",
    Provider.OPENAI: "OpenAI Direct API (requires key)",
    Provider.AMAZON_BEDROCK: "Amazon Bedrock (Claude, enterprise)",
    Provider.ANTHROPIC: "Direct Anthropic API (BLOCKED)",
}


# =============================================================================
# Default Fallback Chains
# =============================================================================

DEFAULT_FALLBACK_CHAIN = [
    "github-copilot",
    "openai",
    "google",
    "opencode",
    "amazon-bedrock",
]

FREE_ONLY_FALLBACK_CHAIN = [
    "opencode",
    "google",
]

COST_FIRST_FALLBACK_CHAIN = [
    "opencode",
    "google",
    "github-copilot",
    "openai",
    "amazon-bedrock",
]
