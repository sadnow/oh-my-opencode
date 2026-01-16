"""
Profiles Module
===============

Pre-configured profile definitions for different use cases.
These mirror the TypeScript profiles in src/features/auto-router/profiles.ts.
"""

from dataclasses import dataclass
from typing import Dict, List


@dataclass
class ProfileConfig:
    """Configuration for a single profile."""
    id: str
    name: str
    description: str
    long_description: str
    tags: List[str]
    default_budget: str
    fallback_chain: List[str]
    auto_escalate: bool
    max_escalations: int
    quality_threshold: float
    max_budget_tier: str
    verbose_logging: bool
    log_spending: bool
    spending_milestone: float
    estimated_cost_simple: float
    estimated_cost_moderate: float
    estimated_cost_complex: float

    @property
    def cost_range(self) -> str:
        """Get formatted cost range string."""
        from .display import format_cost
        return f"{format_cost(self.estimated_cost_simple)}-{format_cost(self.estimated_cost_complex)}"


# =============================================================================
# Classic Profiles (Original oh-my-opencode behavior)
# =============================================================================

PROFILE_CLASSIC = ProfileConfig(
    id="classic",
    name="Classic (Original oh-my-opencode)",
    description="Original behavior - Copilot-first, standard escalation",
    long_description="""Replicates the original oh-my-opencode plugin behavior.
Uses GitHub Copilot as the primary provider with standard escalation rules.
Technique selection is automatic based on task classification, not forced.
Best for users who want familiar, proven behavior from the original plugin.""",
    tags=["classic", "original", "stable"],
    default_budget="cheap",
    fallback_chain=["github-copilot", "openai", "google", "opencode"],
    auto_escalate=True,
    max_escalations=3,
    quality_threshold=0.7,
    max_budget_tier="expensive",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=1.00,
    estimated_cost_simple=0.01,
    estimated_cost_moderate=0.08,
    estimated_cost_complex=0.30,
)

PROFILE_CLASSIC_FREE = ProfileConfig(
    id="classic-free",
    name="Classic Free (Zero-Cost Original)",
    description="Original feel with free models only - $0 cost",
    long_description="""Same behavior patterns as the original oh-my-opencode plugin,
but uses only free models (OpenCode GLM/Grok, Google Antigravity).
Great for users who want the classic feel without any API costs.
Maintains familiar escalation patterns but within free tier limits.""",
    tags=["classic", "free", "original"],
    default_budget="free",
    fallback_chain=["opencode", "google"],
    auto_escalate=True,
    max_escalations=3,
    quality_threshold=0.6,
    max_budget_tier="maximum",
    verbose_logging=True,
    log_spending=False,
    spending_milestone=0,
    estimated_cost_simple=0,
    estimated_cost_moderate=0,
    estimated_cost_complex=0,
)

PROFILE_CLASSIC_COPILOT_MAX = ProfileConfig(
    id="classic-copilot-max",
    name="Classic Copilot Max",
    description="Maximize Copilot subscription - aggressive usage",
    long_description="""For users with unlimited GitHub Copilot access who want to
get maximum value from their subscription. Uses Copilot models exclusively
with aggressive escalation. Falls back to direct OpenAI API only if Copilot
is completely unavailable. Perfect for enterprise Copilot subscribers.""",
    tags=["classic", "copilot", "subscription"],
    default_budget="moderate",
    fallback_chain=["github-copilot", "openai"],
    auto_escalate=True,
    max_escalations=4,
    quality_threshold=0.7,
    max_budget_tier="maximum",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=2.00,
    estimated_cost_simple=0.02,
    estimated_cost_moderate=0.10,
    estimated_cost_complex=0.40,
)


# =============================================================================
# Modern Profiles
# =============================================================================

PROFILE_ULTRA_FRUGAL = ProfileConfig(
    id="ultra-frugal",
    name="Ultra Frugal",
    description="Free models only - $0 cost guaranteed",
    long_description="""For users who cannot afford any API costs.
Uses only free models: OpenCode (GLM-4.7, Grok) and Google Antigravity (Gemini).
Will NEVER escalate to paid tiers. Quality may be lower for complex tasks.""",
    tags=["free", "budget", "no-cost"],
    default_budget="free",
    fallback_chain=["opencode", "google"],
    auto_escalate=False,
    max_escalations=0,
    quality_threshold=0.5,
    max_budget_tier="free",
    verbose_logging=True,
    log_spending=False,
    spending_milestone=0,
    estimated_cost_simple=0,
    estimated_cost_moderate=0,
    estimated_cost_complex=0,
)

PROFILE_BUDGET_CONSCIOUS = ProfileConfig(
    id="budget-conscious",
    name="Budget Conscious",
    description="Minimize costs - ~$0.01-0.05 per task",
    long_description="""For users watching their spending carefully.
Starts with free models, escalates to cheap (GPT-4o-mini) only when needed.
Uses free models for thinking/judging to minimize costs.""",
    tags=["budget", "cost-effective"],
    default_budget="free",
    fallback_chain=["opencode", "google", "github-copilot"],
    auto_escalate=True,
    max_escalations=2,
    quality_threshold=0.6,
    max_budget_tier="moderate",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=0.50,
    estimated_cost_simple=0.001,
    estimated_cost_moderate=0.01,
    estimated_cost_complex=0.05,
)

PROFILE_BALANCED = ProfileConfig(
    id="balanced",
    name="Balanced (Recommended)",
    description="Best value - ~$0.01-0.20 per task",
    long_description="""The recommended default for most developers.
Starts with cheap tier (GPT-4o) and escalates to moderate (Claude Sonnet 4).
Good quality without excessive costs. Suitable for everyday development.""",
    tags=["default", "recommended"],
    default_budget="cheap",
    fallback_chain=["github-copilot", "openai", "google", "opencode"],
    auto_escalate=True,
    max_escalations=3,
    quality_threshold=0.7,
    max_budget_tier="expensive",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=1.00,
    estimated_cost_simple=0.01,
    estimated_cost_moderate=0.05,
    estimated_cost_complex=0.20,
)

PROFILE_QUALITY_FIRST = ProfileConfig(
    id="quality-first",
    name="Quality First",
    description="Maximum quality - ~$0.05-1.00 per task",
    long_description="""For users who prioritize code quality over cost.
Uses premium models (GPT-5.2, Claude Opus). Higher quality thresholds.
Ideal for production code, security-sensitive work, critical systems.""",
    tags=["quality", "production"],
    default_budget="moderate",
    fallback_chain=["github-copilot", "openai", "google", "amazon-bedrock", "opencode"],
    auto_escalate=True,
    max_escalations=4,
    quality_threshold=0.8,
    max_budget_tier="maximum",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=2.00,
    estimated_cost_simple=0.05,
    estimated_cost_moderate=0.20,
    estimated_cost_complex=1.00,
)

PROFILE_SPEED_DEMON = ProfileConfig(
    id="speed-demon",
    name="Speed Demon",
    description="Fast iteration - ~$0.01-0.10 per task",
    long_description="""For users who need fast iteration cycles.
Uses faster models with shorter timeouts and fewer iterations.
Lower quality thresholds. Perfect for hackathons and prototypes.""",
    tags=["fast", "prototype"],
    default_budget="cheap",
    fallback_chain=["github-copilot", "google", "opencode"],
    auto_escalate=True,
    max_escalations=2,
    quality_threshold=0.5,
    max_budget_tier="moderate",
    verbose_logging=False,
    log_spending=False,
    spending_milestone=0,
    estimated_cost_simple=0.005,
    estimated_cost_moderate=0.02,
    estimated_cost_complex=0.10,
)

PROFILE_ENTERPRISE = ProfileConfig(
    id="enterprise",
    name="Enterprise",
    description="Maximum reliability - ~$0.10-2.00 per task",
    long_description="""For enterprise teams with strict requirements.
Uses enterprise-grade providers (Bedrock) with full audit logging.
Higher quality thresholds and security-focused configuration.""",
    tags=["enterprise", "security"],
    default_budget="expensive",
    fallback_chain=["amazon-bedrock", "github-copilot", "openai"],
    auto_escalate=True,
    max_escalations=3,
    quality_threshold=0.85,
    max_budget_tier="maximum",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=5.00,
    estimated_cost_simple=0.10,
    estimated_cost_moderate=0.50,
    estimated_cost_complex=2.00,
)

PROFILE_GAME_DEV = ProfileConfig(
    id="game-dev",
    name="Game Development",
    description="Optimized for games - ~$0.02-0.50 per task",
    long_description="""For game developers building games with Phaser, Unity, etc.
Ralph loop enabled by default for persistent task completion.
Moderate quality thresholds balance iteration speed with quality.""",
    tags=["game", "gamedev"],
    default_budget="moderate",
    fallback_chain=["github-copilot", "google", "openai", "opencode"],
    auto_escalate=True,
    max_escalations=3,
    quality_threshold=0.6,
    max_budget_tier="expensive",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=1.00,
    estimated_cost_simple=0.02,
    estimated_cost_moderate=0.15,
    estimated_cost_complex=0.50,
)

PROFILE_RESEARCH = ProfileConfig(
    id="research",
    name="Research & Exploration",
    description="Deep thinking - ~$0.05-1.50 per task",
    long_description="""For research, analysis, and exploratory development.
Ultrathink enabled by default for deep reasoning.
More iterations and longer timeouts for thorough exploration.""",
    tags=["research", "analysis"],
    default_budget="moderate",
    fallback_chain=["github-copilot", "openai", "google", "opencode"],
    auto_escalate=True,
    max_escalations=4,
    quality_threshold=0.65,
    max_budget_tier="maximum",
    verbose_logging=True,
    log_spending=True,
    spending_milestone=2.00,
    estimated_cost_simple=0.05,
    estimated_cost_moderate=0.25,
    estimated_cost_complex=1.50,
)


# =============================================================================
# Profile Registry
# =============================================================================

PROFILES: Dict[str, ProfileConfig] = {
    # Classic profiles
    "classic": PROFILE_CLASSIC,
    "classic-free": PROFILE_CLASSIC_FREE,
    "classic-copilot-max": PROFILE_CLASSIC_COPILOT_MAX,
    # Modern profiles
    "ultra-frugal": PROFILE_ULTRA_FRUGAL,
    "budget-conscious": PROFILE_BUDGET_CONSCIOUS,
    "balanced": PROFILE_BALANCED,
    "quality-first": PROFILE_QUALITY_FIRST,
    "speed-demon": PROFILE_SPEED_DEMON,
    "enterprise": PROFILE_ENTERPRISE,
    "game-dev": PROFILE_GAME_DEV,
    "research": PROFILE_RESEARCH,
}


def get_profile(profile_id: str) -> ProfileConfig:
    """Get a profile by ID. Raises KeyError if not found."""
    return PROFILES[profile_id]


def get_profiles_sorted_by_cost() -> List[ProfileConfig]:
    """Get all profiles sorted by estimated moderate cost."""
    return sorted(PROFILES.values(), key=lambda p: p.estimated_cost_moderate)


def get_profiles_by_tag(tag: str) -> List[ProfileConfig]:
    """Get all profiles containing a specific tag."""
    return [p for p in PROFILES.values() if tag in p.tags]
