#!/usr/bin/env python3
"""
AutoCode Setup Wizard
=====================

A comprehensive CLI tool for configuring oh-my-opencode's auto-router settings.

Usage:
    python autocode_setup.py              # Interactive CLI mode (arrow navigation)
    python autocode_setup.py --cli        # Same as above
    python autocode_setup.py --options    # Show all options as flags
    python autocode_setup.py --status     # Show current configuration
    python autocode_setup.py --rebuild    # Rebuild the plugin
    python autocode_setup.py --reset-rate-limits  # Clear rate limit state

Options Mode Examples:
    python autocode_setup.py --set-budget free
    python autocode_setup.py --enable-provider github-copilot
    python autocode_setup.py --disable-provider anthropic
    python autocode_setup.py --set-cooldown anthropic 10
    python autocode_setup.py --set-cooldown default 2
"""

import argparse
import json
import os
import sys
import subprocess
from pathlib import Path
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass, field
from enum import Enum

# Try to import curses for arrow navigation (not available on Windows by default)
try:
    import curses
    HAS_CURSES = True
except ImportError:
    HAS_CURSES = False

# Try to import readchar as fallback for Windows
try:
    import readchar
    HAS_READCHAR = True
except ImportError:
    HAS_READCHAR = False


# =============================================================================
# Configuration Paths
# =============================================================================

HOME = Path.home()
OPENCODE_DIR = HOME / ".opencode"
PLUGIN_CONFIG = OPENCODE_DIR / "oh-my-opencode.json"
RATE_LIMIT_STATE = OPENCODE_DIR / "rate-limit-state.json"
PROJECT_ROOT = Path(__file__).parent.resolve()


# =============================================================================
# Enums and Constants
# =============================================================================

class BudgetTier(Enum):
    FREE = "free"
    CHEAP = "cheap"
    MODERATE = "moderate"
    EXPENSIVE = "expensive"
    MAXIMUM = "maximum"


class Provider(Enum):
    GITHUB_COPILOT = "github-copilot"
    GOOGLE = "google"
    OPENCODE = "opencode"
    AMAZON_BEDROCK = "amazon-bedrock"
    ANTHROPIC = "anthropic"  # Always blocked


BLOCKED_PROVIDERS = {Provider.ANTHROPIC}

DEFAULT_COOLDOWNS = {
    "anthropic": 5,  # 5 minutes
    "default": 1,    # 1 minute
}

BUDGET_TIER_DESCRIPTIONS = {
    BudgetTier.FREE: "Free models only (GLM, Grok)",
    BudgetTier.CHEAP: "Low-cost models (GPT-4o-mini via Copilot)",
    BudgetTier.MODERATE: "Balanced cost/quality (Gemini via Antigravity)",
    BudgetTier.EXPENSIVE: "High-quality (Claude Sonnet via Copilot)",
    BudgetTier.MAXIMUM: "Best available (Claude Opus via Copilot)",
}

PROVIDER_DESCRIPTIONS = {
    Provider.GITHUB_COPILOT: "GitHub Copilot CLI (GPT-4, Claude via Copilot)",
    Provider.GOOGLE: "Google Antigravity (Gemini models, free)",
    Provider.OPENCODE: "OpenCode built-in (GLM, Grok, free)",
    Provider.AMAZON_BEDROCK: "Amazon Bedrock (Claude, paid)",
    Provider.ANTHROPIC: "Direct Anthropic API (BLOCKED)",
}


# =============================================================================
# Configuration Data Classes
# =============================================================================

@dataclass
class RateLimitConfig:
    anthropic_cooldown_minutes: int = 5
    default_cooldown_minutes: int = 1


@dataclass
class ProviderConfig:
    enabled_providers: List[str] = field(default_factory=lambda: [
        "github-copilot", "google", "opencode", "amazon-bedrock"
    ])
    blocked_providers: List[str] = field(default_factory=lambda: ["anthropic"])


@dataclass
class AutoRouterConfig:
    enabled: bool = True
    default_budget: str = "free"
    auto_escalate: bool = True
    max_escalations: int = 3
    quality_threshold: float = 0.7
    verbose_logging: bool = True


@dataclass
class FullConfig:
    auto_router: AutoRouterConfig = field(default_factory=AutoRouterConfig)
    rate_limits: RateLimitConfig = field(default_factory=RateLimitConfig)
    providers: ProviderConfig = field(default_factory=ProviderConfig)


# =============================================================================
# Configuration Management
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
                    default_budget=ar.get("default_budget", "free"),
                    auto_escalate=ar.get("auto_escalate", True),
                    max_escalations=ar.get("max_escalations", 3),
                    quality_threshold=ar.get("quality_threshold", 0.7),
                    verbose_logging=ar.get("verbose_logging", True),
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
                )
        except Exception as e:
            print(f"Warning: Failed to load config: {e}")

    return config


def save_config(config: FullConfig) -> bool:
    """Save configuration to disk."""
    try:
        OPENCODE_DIR.mkdir(parents=True, exist_ok=True)

        # Load existing config to preserve other settings
        existing = {}
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
            "verbose_logging": config.auto_router.verbose_logging,
        }

        existing["rate_limits"] = {
            "anthropic_cooldown_minutes": config.rate_limits.anthropic_cooldown_minutes,
            "default_cooldown_minutes": config.rate_limits.default_cooldown_minutes,
        }

        existing["providers"] = {
            "enabled_providers": config.providers.enabled_providers,
            "blocked_providers": config.providers.blocked_providers,
        }

        with open(PLUGIN_CONFIG, "w") as f:
            json.dump(existing, f, indent=2)

        print(f"Configuration saved to {PLUGIN_CONFIG}")
        return True

    except Exception as e:
        print(f"Error saving config: {e}")
        return False


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
# Display Functions
# =============================================================================

def print_header(title: str):
    """Print a formatted header."""
    width = 60
    print("\n" + "=" * width)
    print(f"  {title}")
    print("=" * width)


def print_section(title: str):
    """Print a section header."""
    print(f"\n--- {title} ---")


def print_status(config: FullConfig):
    """Print current configuration status."""
    print_header("AutoCode Configuration Status")

    print_section("Auto-Router")
    print(f"  Enabled: {'Yes' if config.auto_router.enabled else 'No'}")
    print(f"  Default Budget: {config.auto_router.default_budget.upper()}")
    print(f"  Auto Escalate: {'Yes' if config.auto_router.auto_escalate else 'No'}")
    print(f"  Max Escalations: {config.auto_router.max_escalations}")
    print(f"  Quality Threshold: {config.auto_router.quality_threshold}")
    print(f"  Verbose Logging: {'Yes' if config.auto_router.verbose_logging else 'No'}")

    print_section("Rate Limits")
    print(f"  Anthropic Cooldown: {config.rate_limits.anthropic_cooldown_minutes} minutes")
    print(f"  Default Cooldown: {config.rate_limits.default_cooldown_minutes} minutes")

    print_section("Providers")
    for provider in Provider:
        if provider.value in config.providers.blocked_providers:
            status = "BLOCKED"
        elif provider.value in config.providers.enabled_providers:
            status = "ENABLED"
        else:
            status = "DISABLED"
        print(f"  {provider.value}: {status}")

    # Show rate limit state
    state = load_rate_limit_state()
    if state.get("providers"):
        print_section("Current Rate Limit State")
        import time
        now = time.time() * 1000
        for provider, pstate in state["providers"].items():
            cooldown_left = max(0, (pstate.get("cooldownUntil", 0) - now) / 60000)
            circuit = pstate.get("circuitState", "unknown")
            hits = pstate.get("hitCount", 0)
            print(f"  {provider}: {circuit.upper()} (hits: {hits}, cooldown: {cooldown_left:.1f}m)")

    print()


# =============================================================================
# Interactive CLI Mode (Arrow Navigation)
# =============================================================================

class InteractiveMenu:
    """Interactive menu with arrow key navigation."""

    def __init__(self, title: str, options: List[Tuple[str, str]], allow_back: bool = True):
        self.title = title
        self.options = options
        if allow_back:
            self.options.append(("back", "Go Back"))
        self.selected = 0

    def run(self) -> Optional[str]:
        """Run the menu and return the selected option key."""
        if HAS_CURSES and sys.platform != "win32":
            return self._run_curses()
        elif HAS_READCHAR:
            return self._run_readchar()
        else:
            return self._run_fallback()

    def _run_fallback(self) -> Optional[str]:
        """Fallback to numbered input if no arrow key support."""
        while True:
            print(f"\n{self.title}")
            print("-" * 40)
            for i, (key, label) in enumerate(self.options, 1):
                print(f"  {i}. {label}")
            print()

            try:
                choice = input("Enter number (or 'q' to quit): ").strip()
                if choice.lower() == 'q':
                    return None
                idx = int(choice) - 1
                if 0 <= idx < len(self.options):
                    return self.options[idx][0]
            except (ValueError, KeyboardInterrupt):
                pass
            print("Invalid choice, try again.")

    def _run_readchar(self) -> Optional[str]:
        """Run with readchar for Windows support."""
        import readchar

        while True:
            # Clear screen and draw menu
            os.system('cls' if os.name == 'nt' else 'clear')
            print(f"\n{self.title}")
            print("-" * 40)
            print("(Use arrow keys to navigate, Enter to select, q to quit)\n")

            for i, (key, label) in enumerate(self.options):
                prefix = ">" if i == self.selected else " "
                print(f"  {prefix} {label}")

            # Get keypress
            key = readchar.readkey()

            if key == readchar.key.UP:
                self.selected = (self.selected - 1) % len(self.options)
            elif key == readchar.key.DOWN:
                self.selected = (self.selected + 1) % len(self.options)
            elif key == readchar.key.ENTER:
                return self.options[self.selected][0]
            elif key.lower() == 'q':
                return None

    def _run_curses(self) -> Optional[str]:
        """Run with curses for Unix systems."""
        def menu_loop(stdscr):
            curses.curs_set(0)

            while True:
                stdscr.clear()
                stdscr.addstr(1, 2, self.title)
                stdscr.addstr(2, 2, "-" * 40)
                stdscr.addstr(3, 2, "(Use arrow keys, Enter to select, q to quit)")

                for i, (key, label) in enumerate(self.options):
                    prefix = ">" if i == self.selected else " "
                    if i == self.selected:
                        stdscr.addstr(5 + i, 2, f"{prefix} {label}", curses.A_REVERSE)
                    else:
                        stdscr.addstr(5 + i, 2, f"{prefix} {label}")

                stdscr.refresh()
                key = stdscr.getch()

                if key == curses.KEY_UP:
                    self.selected = (self.selected - 1) % len(self.options)
                elif key == curses.KEY_DOWN:
                    self.selected = (self.selected + 1) % len(self.options)
                elif key == ord('\n'):
                    return self.options[self.selected][0]
                elif key == ord('q'):
                    return None

        return curses.wrapper(menu_loop)


def run_interactive_cli():
    """Run the full interactive CLI wizard."""
    config = load_config()

    while True:
        # Main menu
        menu = InteractiveMenu("AutoCode Setup Wizard - Main Menu", [
            ("status", "View Current Status"),
            ("budget", "Configure Default Budget"),
            ("providers", "Manage Providers"),
            ("rate_limits", "Configure Rate Limits"),
            ("escalation", "Configure Escalation"),
            ("logging", "Toggle Verbose Logging"),
            ("rebuild", "Rebuild Plugin"),
            ("reset_rate_limits", "Reset Rate Limit State"),
            ("save", "Save & Exit"),
        ], allow_back=False)

        choice = menu.run()

        if choice is None or choice == "save":
            if save_config(config):
                print("\nConfiguration saved successfully!")
            break

        elif choice == "status":
            print_status(config)
            input("\nPress Enter to continue...")

        elif choice == "budget":
            budget_menu = InteractiveMenu("Select Default Budget Tier", [
                (tier.value, f"{tier.value.upper()} - {BUDGET_TIER_DESCRIPTIONS[tier]}")
                for tier in BudgetTier
            ])
            budget = budget_menu.run()
            if budget and budget != "back":
                config.auto_router.default_budget = budget
                print(f"\nDefault budget set to: {budget.upper()}")
                input("Press Enter to continue...")

        elif choice == "providers":
            while True:
                provider_menu = InteractiveMenu("Provider Management", [
                    ("toggle", "Toggle Provider On/Off"),
                    ("view", "View Provider Status"),
                ])
                p_choice = provider_menu.run()

                if p_choice == "back" or p_choice is None:
                    break

                elif p_choice == "toggle":
                    toggle_menu = InteractiveMenu("Select Provider to Toggle", [
                        (p.value, f"{p.value} - {PROVIDER_DESCRIPTIONS[p]}")
                        for p in Provider if p not in BLOCKED_PROVIDERS
                    ])
                    provider = toggle_menu.run()
                    if provider and provider != "back":
                        if provider in config.providers.enabled_providers:
                            config.providers.enabled_providers.remove(provider)
                            print(f"\n{provider} DISABLED")
                        else:
                            config.providers.enabled_providers.append(provider)
                            print(f"\n{provider} ENABLED")
                        input("Press Enter to continue...")

                elif p_choice == "view":
                    print_section("Provider Status")
                    for p in Provider:
                        if p.value in config.providers.blocked_providers:
                            status = "BLOCKED (cannot change)"
                        elif p.value in config.providers.enabled_providers:
                            status = "ENABLED"
                        else:
                            status = "DISABLED"
                        print(f"  {p.value}: {status}")
                    input("\nPress Enter to continue...")

        elif choice == "rate_limits":
            print_section("Rate Limit Configuration")
            try:
                print(f"\nCurrent Anthropic cooldown: {config.rate_limits.anthropic_cooldown_minutes} minutes")
                val = input("Enter new value (or press Enter to keep): ").strip()
                if val:
                    config.rate_limits.anthropic_cooldown_minutes = int(val)

                print(f"\nCurrent default cooldown: {config.rate_limits.default_cooldown_minutes} minutes")
                val = input("Enter new value (or press Enter to keep): ").strip()
                if val:
                    config.rate_limits.default_cooldown_minutes = int(val)

                print("\nRate limits updated!")
            except ValueError:
                print("Invalid value, keeping previous settings.")
            input("Press Enter to continue...")

        elif choice == "escalation":
            print_section("Escalation Configuration")
            try:
                print(f"\nAuto-escalate enabled: {config.auto_router.auto_escalate}")
                val = input("Enable auto-escalate? (y/n or Enter to keep): ").strip().lower()
                if val == 'y':
                    config.auto_router.auto_escalate = True
                elif val == 'n':
                    config.auto_router.auto_escalate = False

                print(f"\nMax escalations: {config.auto_router.max_escalations}")
                val = input("Enter new value (or press Enter to keep): ").strip()
                if val:
                    config.auto_router.max_escalations = int(val)

                print(f"\nQuality threshold: {config.auto_router.quality_threshold}")
                val = input("Enter new value 0.0-1.0 (or press Enter to keep): ").strip()
                if val:
                    config.auto_router.quality_threshold = float(val)

                print("\nEscalation settings updated!")
            except ValueError:
                print("Invalid value, keeping previous settings.")
            input("Press Enter to continue...")

        elif choice == "logging":
            config.auto_router.verbose_logging = not config.auto_router.verbose_logging
            status = "ENABLED" if config.auto_router.verbose_logging else "DISABLED"
            print(f"\nVerbose logging {status}")
            input("Press Enter to continue...")

        elif choice == "rebuild":
            print("\nRebuilding plugin...")
            result = subprocess.run(
                ["bun", "run", "build"],
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print("Build successful!")
            else:
                print(f"Build failed:\n{result.stderr}")
            input("\nPress Enter to continue...")

        elif choice == "reset_rate_limits":
            if clear_rate_limit_state():
                print("Rate limit state cleared!")
            input("Press Enter to continue...")


# =============================================================================
# Command Line Options Mode
# =============================================================================

def setup_parser() -> argparse.ArgumentParser:
    """Set up argument parser."""
    parser = argparse.ArgumentParser(
        description="AutoCode Setup Wizard - Configure oh-my-opencode auto-router",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )

    # Mode selection
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--cli", action="store_true", help="Interactive CLI mode (default)")
    mode_group.add_argument("--options", action="store_true", help="Show all available options")
    mode_group.add_argument("--status", action="store_true", help="Show current configuration")

    # Quick actions
    parser.add_argument("--rebuild", action="store_true", help="Rebuild the plugin")
    parser.add_argument("--reset-rate-limits", action="store_true", help="Clear rate limit state")

    # Configuration options
    parser.add_argument("--set-budget", choices=["free", "cheap", "moderate", "expensive", "maximum"],
                        help="Set default budget tier")
    parser.add_argument("--enable-provider", metavar="PROVIDER",
                        help="Enable a provider (github-copilot, google, opencode, amazon-bedrock)")
    parser.add_argument("--disable-provider", metavar="PROVIDER",
                        help="Disable a provider")
    parser.add_argument("--set-cooldown", nargs=2, metavar=("PROVIDER", "MINUTES"),
                        help="Set cooldown for a provider (use 'default' for all others)")
    parser.add_argument("--set-max-escalations", type=int, metavar="N",
                        help="Set maximum escalation count")
    parser.add_argument("--set-quality-threshold", type=float, metavar="THRESHOLD",
                        help="Set quality threshold (0.0-1.0)")
    parser.add_argument("--enable-auto-escalate", action="store_true",
                        help="Enable automatic escalation")
    parser.add_argument("--disable-auto-escalate", action="store_true",
                        help="Disable automatic escalation")
    parser.add_argument("--enable-verbose", action="store_true",
                        help="Enable verbose logging")
    parser.add_argument("--disable-verbose", action="store_true",
                        help="Disable verbose logging")

    return parser


def show_options():
    """Show all available command line options."""
    print_header("AutoCode Setup - Available Options")

    print_section("Mode Selection")
    print("  --cli                    Interactive menu mode (arrow keys)")
    print("  --options                Show this help")
    print("  --status                 Show current configuration")

    print_section("Quick Actions")
    print("  --rebuild                Rebuild the plugin")
    print("  --reset-rate-limits      Clear rate limit state")

    print_section("Budget Configuration")
    print("  --set-budget TIER        Set default budget tier")
    print("                           Options: free, cheap, moderate, expensive, maximum")

    print_section("Provider Configuration")
    print("  --enable-provider NAME   Enable a provider")
    print("  --disable-provider NAME  Disable a provider")
    print("                           Names: github-copilot, google, opencode, amazon-bedrock")
    print("                           Note: anthropic is always blocked")

    print_section("Rate Limit Configuration")
    print("  --set-cooldown PROVIDER MINUTES")
    print("                           Set cooldown time for a provider")
    print("                           Use 'anthropic' or 'default' as PROVIDER")

    print_section("Escalation Configuration")
    print("  --set-max-escalations N  Set maximum escalation count (default: 3)")
    print("  --set-quality-threshold  Set quality threshold 0.0-1.0 (default: 0.7)")
    print("  --enable-auto-escalate   Enable automatic budget escalation")
    print("  --disable-auto-escalate  Disable automatic budget escalation")

    print_section("Logging Configuration")
    print("  --enable-verbose         Enable verbose model/provider logging")
    print("  --disable-verbose        Disable verbose logging")

    print_section("Examples")
    print("  python autocode_setup.py --status")
    print("  python autocode_setup.py --set-budget moderate")
    print("  python autocode_setup.py --set-cooldown anthropic 10")
    print("  python autocode_setup.py --disable-provider amazon-bedrock")
    print("  python autocode_setup.py --enable-verbose --rebuild")
    print()


def handle_options(args: argparse.Namespace) -> bool:
    """Handle command line options. Returns True if any action was taken."""
    config = load_config()
    changed = False

    if args.status:
        print_status(config)
        return True

    if args.options:
        show_options()
        return True

    if args.rebuild:
        print("Rebuilding plugin...")
        result = subprocess.run(
            ["bun", "run", "build"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("Build successful!")
        else:
            print(f"Build failed:\n{result.stderr}")
        return True

    if args.reset_rate_limits:
        clear_rate_limit_state()
        return True

    if args.set_budget:
        config.auto_router.default_budget = args.set_budget
        print(f"Default budget set to: {args.set_budget.upper()}")
        changed = True

    if args.enable_provider:
        provider = args.enable_provider
        if provider == "anthropic":
            print("Error: anthropic is always blocked and cannot be enabled")
        elif provider not in config.providers.enabled_providers:
            config.providers.enabled_providers.append(provider)
            print(f"Enabled provider: {provider}")
            changed = True
        else:
            print(f"Provider {provider} is already enabled")

    if args.disable_provider:
        provider = args.disable_provider
        if provider == "anthropic":
            print("Note: anthropic is always blocked")
        elif provider in config.providers.enabled_providers:
            config.providers.enabled_providers.remove(provider)
            print(f"Disabled provider: {provider}")
            changed = True
        else:
            print(f"Provider {provider} is already disabled")

    if args.set_cooldown:
        provider, minutes = args.set_cooldown
        try:
            minutes = int(minutes)
            if provider == "anthropic":
                config.rate_limits.anthropic_cooldown_minutes = minutes
                print(f"Anthropic cooldown set to: {minutes} minutes")
            elif provider == "default":
                config.rate_limits.default_cooldown_minutes = minutes
                print(f"Default cooldown set to: {minutes} minutes")
            else:
                print(f"Unknown provider: {provider}. Use 'anthropic' or 'default'")
            changed = True
        except ValueError:
            print(f"Invalid minutes value: {minutes}")

    if args.set_max_escalations is not None:
        config.auto_router.max_escalations = args.set_max_escalations
        print(f"Max escalations set to: {args.set_max_escalations}")
        changed = True

    if args.set_quality_threshold is not None:
        config.auto_router.quality_threshold = args.set_quality_threshold
        print(f"Quality threshold set to: {args.set_quality_threshold}")
        changed = True

    if args.enable_auto_escalate:
        config.auto_router.auto_escalate = True
        print("Auto-escalate enabled")
        changed = True

    if args.disable_auto_escalate:
        config.auto_router.auto_escalate = False
        print("Auto-escalate disabled")
        changed = True

    if args.enable_verbose:
        config.auto_router.verbose_logging = True
        print("Verbose logging enabled")
        changed = True

    if args.disable_verbose:
        config.auto_router.verbose_logging = False
        print("Verbose logging disabled")
        changed = True

    if changed:
        save_config(config)

    return changed


# =============================================================================
# Main Entry Point
# =============================================================================

def main():
    """Main entry point."""
    parser = setup_parser()
    args = parser.parse_args()

    # If --options flag, show options and exit
    if args.options:
        show_options()
        return

    # If any specific option was given, handle it
    if handle_options(args):
        return

    # Default to interactive CLI mode
    print_header("AutoCode Setup Wizard")
    print("\nStarting interactive mode...")
    print("(Use --options to see all command line options)")

    if not HAS_CURSES and not HAS_READCHAR:
        print("\nNote: Install 'readchar' for arrow key navigation:")
        print("  pip install readchar")
        print("\nFalling back to numbered menu...")

    run_interactive_cli()


if __name__ == "__main__":
    main()
