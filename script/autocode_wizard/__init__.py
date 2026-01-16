"""
AutoCode Wizard Package
=======================

A modular CLI tool for configuring oh-my-opencode's auto-router settings.
Split into reusable components for easy maintenance and extension.

Modules:
    - constants: Enums, budget tiers, provider definitions
    - models: Data classes for configuration
    - profiles: Pre-configured profile definitions
    - config_io: File I/O for configuration persistence
    - display: UI display utilities
    - menu: Interactive menu component
    - interactive: Full interactive CLI mode
    - cli: Command-line argument handling
    - runner: Test runner utilities
"""

__version__ = "2.1.0"

# Re-export main components for convenience
from .constants import BudgetTier, Provider, BLOCKED_PROVIDERS, MODEL_COSTS_PER_1K
from .models import FullConfig, AutoRouterConfig, ProviderConfig, LoggingConfig
from .profiles import PROFILES, ProfileConfig
from .config_io import load_config, save_config, apply_profile
from .display import print_header, print_section, format_cost, print_status
from .cli import main

__all__ = [
    # Constants
    "BudgetTier",
    "Provider",
    "BLOCKED_PROVIDERS",
    "MODEL_COSTS_PER_1K",
    # Models
    "FullConfig",
    "AutoRouterConfig",
    "ProviderConfig",
    "LoggingConfig",
    # Profiles
    "PROFILES",
    "ProfileConfig",
    # Config I/O
    "load_config",
    "save_config",
    "apply_profile",
    # Display
    "print_header",
    "print_section",
    "format_cost",
    "print_status",
    # CLI
    "main",
]
