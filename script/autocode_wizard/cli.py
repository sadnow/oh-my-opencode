"""
CLI Module
==========

Command-line argument handling and main entry point.
"""

import argparse
from typing import Optional

from .config_io import (
    apply_profile,
    clear_rate_limit_state,
    clear_usage_stats,
    load_config,
    save_config,
)
from .display import format_cost, print_expenses, print_header, print_profiles, print_section, print_status
from .interactive import run_fast_setup, run_interactive_cli
from .menu import has_arrow_key_support
from .profiles import PROFILES
from .runner import run_build, run_tests


def setup_parser() -> argparse.ArgumentParser:
    """Set up argument parser."""
    parser = argparse.ArgumentParser(
        description="AutoCode Setup Wizard v2.1 - Configure oh-my-opencode auto-router",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    # Mode selection
    mode_group = parser.add_mutually_exclusive_group()
    mode_group.add_argument("--cli", action="store_true", help="Full interactive CLI mode")
    mode_group.add_argument("--fast", action="store_true", help="Fast setup (profile selection only)")
    mode_group.add_argument("--options", action="store_true", help="Show all available options")
    mode_group.add_argument("--status", action="store_true", help="Show current configuration")
    mode_group.add_argument("--expenses", action="store_true", help="Show expense breakdown by provider")
    mode_group.add_argument("--profiles", action="store_true", help="List available profiles")

    # Profile selection
    parser.add_argument("--profile", choices=list(PROFILES.keys()),
                        help="Apply a configuration profile")

    # Quick actions
    parser.add_argument("--test", action="store_true", help="Run auto-router tests")
    parser.add_argument("--rebuild", action="store_true", help="Rebuild the plugin")
    parser.add_argument("--reset-rate-limits", action="store_true", help="Clear rate limit state")
    parser.add_argument("--reset-stats", action="store_true", help="Clear usage statistics")

    # Configuration options
    parser.add_argument("--set-budget", choices=["free", "cheap", "moderate", "expensive", "maximum"],
                        help="Set default budget tier")
    parser.add_argument("--set-max-budget", choices=["free", "cheap", "moderate", "expensive", "maximum"],
                        help="Set maximum budget tier for escalation")
    parser.add_argument("--enable-provider", metavar="PROVIDER",
                        help="Enable a provider")
    parser.add_argument("--disable-provider", metavar="PROVIDER",
                        help="Disable a provider")
    parser.add_argument("--set-fallback-chain", metavar="CHAIN",
                        help="Set fallback chain (comma-separated)")
    parser.add_argument("--set-max-escalations", type=int, metavar="N",
                        help="Set maximum escalation count")
    parser.add_argument("--set-quality-threshold", type=float, metavar="THRESHOLD",
                        help="Set quality threshold (0.0-1.0)")
    parser.add_argument("--enable-auto-escalate", action="store_true",
                        help="Enable automatic escalation")
    parser.add_argument("--disable-auto-escalate", action="store_true",
                        help="Disable automatic escalation")

    # Logging options
    parser.add_argument("--enable-verbose", action="store_true",
                        help="Enable verbose logging")
    parser.add_argument("--disable-verbose", action="store_true",
                        help="Disable verbose logging")
    parser.add_argument("--enable-spending-log", action="store_true",
                        help="Enable spending logging")
    parser.add_argument("--disable-spending-log", action="store_true",
                        help="Disable spending logging")
    parser.add_argument("--set-spending-milestone", type=float, metavar="DOLLARS",
                        help="Set spending milestone interval in dollars")

    return parser


def show_options() -> None:
    """Show all available command line options."""
    print_header("AutoCode Setup - Available Options")

    print_section("Mode Selection")
    print("  --cli                    Full interactive menu mode")
    print("  --fast                   Fast setup (profile selection only)")
    print("  --options                Show this help")
    print("  --status                 Show current configuration & stats")
    print("  --expenses               Show expense breakdown by provider")
    print("  --profiles               List available configuration profiles")

    print_section("Profile Selection")
    print("  --profile PROFILE        Apply a configuration profile")
    print("                           Options: " + ", ".join(PROFILES.keys()))

    print_section("Quick Actions")
    print("  --test                   Run auto-router tests")
    print("  --rebuild                Rebuild the plugin")
    print("  --reset-rate-limits      Clear rate limit state")
    print("  --reset-stats            Clear usage statistics")

    print_section("Budget Configuration")
    print("  --set-budget TIER        Set default budget tier")
    print("  --set-max-budget TIER    Set maximum budget tier for escalation")
    print("                           Tiers: free, cheap, moderate, expensive, maximum")

    print_section("Provider Configuration")
    print("  --enable-provider NAME   Enable a provider")
    print("  --disable-provider NAME  Disable a provider")
    print("  --set-fallback-chain     Set fallback chain (comma-separated)")
    print("                           Example: github-copilot,openai,google")

    print_section("Escalation Configuration")
    print("  --set-max-escalations N  Set maximum escalation count")
    print("  --set-quality-threshold  Set quality threshold 0.0-1.0")
    print("  --enable-auto-escalate   Enable automatic budget escalation")
    print("  --disable-auto-escalate  Disable automatic budget escalation")

    print_section("Logging Configuration")
    print("  --enable-verbose         Enable verbose model/provider logging")
    print("  --disable-verbose        Disable verbose logging")
    print("  --enable-spending-log    Enable spending tracking")
    print("  --disable-spending-log   Disable spending tracking")
    print("  --set-spending-milestone Set spending milestone interval in dollars")

    print_section("Examples")
    print("  python -m autocode_wizard --fast")
    print("  python -m autocode_wizard --profile ultra-frugal")
    print("  python -m autocode_wizard --profile balanced --status")
    print("  python -m autocode_wizard --expenses")
    print("  python -m autocode_wizard --set-budget moderate")
    print("  python -m autocode_wizard --set-fallback-chain opencode,google,github-copilot")
    print("  python -m autocode_wizard --test")
    print()


def handle_options(args: argparse.Namespace) -> bool:
    """Handle command line options. Returns True if any action was taken."""
    config = load_config()
    changed = False
    show_status_after = False

    # Check if we need to show status after applying changes
    if args.status:
        show_status_after = True

    # Handle read-only display options (that don't combine with other actions)
    if args.profiles:
        print_profiles()
        return True

    if args.options:
        show_options()
        return True

    if args.fast:
        run_fast_setup()
        return True

    if args.test:
        run_tests()
        return True

    if args.rebuild:
        run_build()
        return True

    if args.reset_rate_limits:
        clear_rate_limit_state()
        return True

    if args.reset_stats:
        clear_usage_stats()
        return True

    # Apply profile BEFORE showing status (so --profile X --status shows new config)
    if args.profile:
        if apply_profile(config, args.profile):
            changed = True

    if args.set_budget:
        config.auto_router.default_budget = args.set_budget
        print(f"✓ Default budget set to: {args.set_budget.upper()}")
        changed = True

    if args.set_max_budget:
        config.auto_router.max_budget_tier = args.set_max_budget
        print(f"✓ Max budget tier set to: {args.set_max_budget.upper()}")
        changed = True

    if args.enable_provider:
        provider = args.enable_provider
        if provider == "anthropic":
            print("✗ Error: anthropic is always blocked and cannot be enabled")
        elif provider not in config.providers.enabled_providers:
            config.providers.enabled_providers.append(provider)
            print(f"✓ Enabled provider: {provider}")
            changed = True
        else:
            print(f"Provider {provider} is already enabled")

    if args.disable_provider:
        provider = args.disable_provider
        if provider == "anthropic":
            print("Note: anthropic is always blocked")
        elif provider in config.providers.enabled_providers:
            config.providers.enabled_providers.remove(provider)
            print(f"✓ Disabled provider: {provider}")
            changed = True
        else:
            print(f"Provider {provider} is already disabled")

    if args.set_fallback_chain:
        chain = [p.strip() for p in args.set_fallback_chain.split(",")]
        config.providers.fallback_chain = chain
        print(f"✓ Fallback chain set to: {' → '.join(chain)}")
        changed = True

    if args.set_max_escalations is not None:
        config.auto_router.max_escalations = args.set_max_escalations
        print(f"✓ Max escalations set to: {args.set_max_escalations}")
        changed = True

    if args.set_quality_threshold is not None:
        config.auto_router.quality_threshold = args.set_quality_threshold
        print(f"✓ Quality threshold set to: {args.set_quality_threshold}")
        changed = True

    if args.enable_auto_escalate:
        config.auto_router.auto_escalate = True
        print("✓ Auto-escalate enabled")
        changed = True

    if args.disable_auto_escalate:
        config.auto_router.auto_escalate = False
        print("✓ Auto-escalate disabled")
        changed = True

    if args.enable_verbose:
        config.logging.verbose_models = True
        print("✓ Verbose logging enabled")
        changed = True

    if args.disable_verbose:
        config.logging.verbose_models = False
        print("✓ Verbose logging disabled")
        changed = True

    if args.enable_spending_log:
        config.logging.log_spending = True
        print("✓ Spending logging enabled")
        changed = True

    if args.disable_spending_log:
        config.logging.log_spending = False
        print("✓ Spending logging disabled")
        changed = True

    if args.set_spending_milestone is not None:
        config.logging.spending_milestone_interval = args.set_spending_milestone
        print(f"✓ Spending milestone set to: {format_cost(args.set_spending_milestone)}")
        changed = True

    if changed:
        save_config(config)
        # Reload config after saving to show fresh state
        config = load_config()

    # Show status if requested (after all changes are applied)
    if show_status_after:
        print_status(config)
        return True

    # Also show expenses if requested (after changes)
    if args.expenses:
        print_expenses(config)
        return True

    return changed


def main() -> None:
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
    print_header("AutoCode Setup Wizard v2.1")
    print("\nWelcome! This wizard helps you configure oh-my-opencode.")
    print("(Use --options to see all command line options)")
    print("(Use --fast for quick profile selection)")

    if not has_arrow_key_support():
        print("\nNote: Install 'readchar' for arrow key navigation:")
        print("  pip install readchar")
        print("\nFalling back to numbered menu...")

    run_interactive_cli()


if __name__ == "__main__":
    main()
