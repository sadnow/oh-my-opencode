"""
Interactive CLI Module
======================

Full interactive CLI mode with menu navigation.
"""

from .config_io import (
    apply_profile,
    clear_rate_limit_state,
    clear_usage_stats,
    load_config,
    save_config,
)
from .constants import BUDGET_TIER_DESCRIPTIONS, PROVIDER_DESCRIPTIONS, BudgetTier, Provider, BLOCKED_PROVIDERS
from .display import format_cost, print_expenses, print_profiles, print_section, print_status, print_header
from .menu import InteractiveMenu, has_arrow_key_support
from .profiles import PROFILES, get_profiles_sorted_by_cost
from .runner import run_build, run_tests


def run_fast_setup() -> None:
    """Run fast setup - just profile selection."""
    print_header("Fast Setup - Select a Profile")
    print("\nChoose a configuration profile based on your needs:\n")

    options = []
    for profile in get_profiles_sorted_by_cost():
        cost_range = f"~{format_cost(profile.estimated_cost_moderate)}/task"
        label = f"{profile.name} - {cost_range}"
        options.append((profile.id, label))

    menu = InteractiveMenu("Select Profile", options, allow_back=False)
    choice = menu.run()

    if choice:
        config = load_config()
        if apply_profile(config, choice):
            save_config(config)
            print(f"\n✓ Profile '{choice}' applied successfully!")

            # Show summary
            profile = PROFILES[choice]
            print(f"\n  Budget: {profile.default_budget.upper()}")
            print(f"  Escalation: {'Enabled' if profile.auto_escalate else 'Disabled'}")
            print(f"  Max Tier: {profile.max_budget_tier.upper()}")
            print(f"  Fallback: {' → '.join(profile.fallback_chain)}")
            print()


def run_interactive_cli() -> None:
    """Run the full interactive CLI wizard."""
    config = load_config()

    while True:
        # Main menu
        menu = InteractiveMenu("AutoCode Setup Wizard - Main Menu", [
            ("fast_setup", "⚡ Fast Setup (Profile Selection)"),
            ("status", "📊 View Current Status"),
            ("expenses", "💰 View Expense Breakdown"),
            ("profiles", "📋 Browse All Profiles"),
            ("budget", "💵 Configure Budget Tier"),
            ("providers", "🔌 Manage Providers"),
            ("fallback", "🔄 Configure Fallback Chain"),
            ("escalation", "📈 Configure Escalation"),
            ("logging", "📝 Configure Logging"),
            ("test", "🧪 Run Auto-Router Tests"),
            ("rebuild", "🔨 Rebuild Plugin"),
            ("reset_stats", "🗑️ Reset Usage Statistics"),
            ("reset_rate_limits", "🔓 Reset Rate Limits"),
            ("save", "💾 Save & Exit"),
        ], allow_back=False)

        choice = menu.run()

        if choice is None or choice == "save":
            if save_config(config):
                print("\n✓ Configuration saved successfully!")
            break

        elif choice == "fast_setup":
            run_fast_setup()
            config = load_config()  # Reload after fast setup
            input("\nPress Enter to continue...")

        elif choice == "status":
            print_status(config)
            input("\nPress Enter to continue...")

        elif choice == "expenses":
            print_expenses(config)
            input("\nPress Enter to continue...")

        elif choice == "profiles":
            print_profiles()
            input("\nPress Enter to continue...")

        elif choice == "budget":
            _handle_budget_menu(config)

        elif choice == "providers":
            _handle_providers_menu(config)

        elif choice == "fallback":
            _handle_fallback_menu(config)

        elif choice == "escalation":
            _handle_escalation_menu(config)

        elif choice == "logging":
            _handle_logging_menu(config)

        elif choice == "test":
            print("\nRunning auto-router tests...")
            run_tests()
            input("\nPress Enter to continue...")

        elif choice == "rebuild":
            print("\nRebuilding plugin...")
            run_build()
            input("\nPress Enter to continue...")

        elif choice == "reset_stats":
            confirm = input("Reset all usage statistics? (y/n): ").strip().lower()
            if confirm == 'y':
                clear_usage_stats()
            input("Press Enter to continue...")

        elif choice == "reset_rate_limits":
            if clear_rate_limit_state():
                print("✓ Rate limit state cleared!")
            input("Press Enter to continue...")


def _handle_budget_menu(config) -> None:
    """Handle budget tier configuration."""
    budget_menu = InteractiveMenu("Select Default Budget Tier", [
        (tier.value, f"{tier.value.upper()} - {BUDGET_TIER_DESCRIPTIONS[tier]}")
        for tier in BudgetTier
    ])
    budget = budget_menu.run()
    if budget and budget != "back":
        config.auto_router.default_budget = budget
        print(f"\n✓ Default budget set to: {budget.upper()}")
        input("Press Enter to continue...")


def _handle_providers_menu(config) -> None:
    """Handle provider management."""
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
                    print(f"\n✓ {provider} DISABLED")
                else:
                    config.providers.enabled_providers.append(provider)
                    print(f"\n✓ {provider} ENABLED")
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


def _handle_fallback_menu(config) -> None:
    """Handle fallback chain configuration."""
    print_section("Current Fallback Chain")
    for i, p in enumerate(config.providers.fallback_chain, 1):
        print(f"  {i}. {p}")

    print("\nSelect a preset fallback chain:\n")

    fallback_menu = InteractiveMenu("Fallback Chain Configuration", [
        ("capability", "Capability-First (Copilot → OpenAI → Google → Free)"),
        ("cost", "Cost-First (Free → Google → Copilot → OpenAI)"),
        ("free_only", "Free Only (OpenCode → Google)"),
    ])
    fb_choice = fallback_menu.run()

    if fb_choice == "capability":
        config.providers.fallback_chain = [
            "github-copilot", "openai", "google", "opencode", "amazon-bedrock"
        ]
        print("\n✓ Set to capability-first fallback chain")
    elif fb_choice == "cost":
        config.providers.fallback_chain = [
            "opencode", "google", "github-copilot", "openai", "amazon-bedrock"
        ]
        print("\n✓ Set to cost-first fallback chain")
    elif fb_choice == "free_only":
        config.providers.fallback_chain = ["opencode", "google"]
        print("\n✓ Set to free-only fallback chain")

    if fb_choice and fb_choice != "back":
        input("Press Enter to continue...")


def _handle_escalation_menu(config) -> None:
    """Handle escalation configuration."""
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

        print(f"\nMax budget tier: {config.auto_router.max_budget_tier}")
        val = input("Enter tier (free/cheap/moderate/expensive/maximum): ").strip().lower()
        if val in ["free", "cheap", "moderate", "expensive", "maximum"]:
            config.auto_router.max_budget_tier = val

        print(f"\nQuality threshold: {config.auto_router.quality_threshold}")
        val = input("Enter new value 0.0-1.0 (or press Enter to keep): ").strip()
        if val:
            config.auto_router.quality_threshold = float(val)

        print("\n✓ Escalation settings updated!")
    except ValueError:
        print("Invalid value, keeping previous settings.")
    input("Press Enter to continue...")


def _handle_logging_menu(config) -> None:
    """Handle logging configuration."""
    logging_menu = InteractiveMenu("Logging Configuration", [
        ("verbose_models", f"Toggle Verbose Models (currently: {'ON' if config.logging.verbose_models else 'OFF'})"),
        ("technique", f"Toggle Technique Selection (currently: {'ON' if config.logging.log_technique_selection else 'OFF'})"),
        ("escalation", f"Toggle Escalation Logging (currently: {'ON' if config.logging.log_escalation else 'OFF'})"),
        ("rate_limits", f"Toggle Rate Limit Logging (currently: {'ON' if config.logging.log_rate_limits else 'OFF'})"),
        ("spending", f"Toggle Spending Logging (currently: {'ON' if config.logging.log_spending else 'OFF'})"),
        ("milestone", "Set Spending Milestone Interval"),
        ("all_on", "Enable All Logging"),
        ("all_off", "Disable All Logging"),
    ])
    log_choice = logging_menu.run()

    if log_choice == "verbose_models":
        config.logging.verbose_models = not config.logging.verbose_models
    elif log_choice == "technique":
        config.logging.log_technique_selection = not config.logging.log_technique_selection
    elif log_choice == "escalation":
        config.logging.log_escalation = not config.logging.log_escalation
    elif log_choice == "rate_limits":
        config.logging.log_rate_limits = not config.logging.log_rate_limits
    elif log_choice == "spending":
        config.logging.log_spending = not config.logging.log_spending
    elif log_choice == "milestone":
        print(f"\nCurrent milestone: {format_cost(config.logging.spending_milestone_interval)}")
        val = input("Enter new milestone in dollars (e.g., 0.50, 1.00): ").strip()
        try:
            config.logging.spending_milestone_interval = float(val)
            print(f"\n✓ Spending milestone set to {format_cost(config.logging.spending_milestone_interval)}")
        except ValueError:
            print("Invalid value")
    elif log_choice == "all_on":
        config.logging.verbose_models = True
        config.logging.log_technique_selection = True
        config.logging.log_escalation = True
        config.logging.log_rate_limits = True
        config.logging.log_spending = True
        print("\n✓ All logging enabled")
    elif log_choice == "all_off":
        config.logging.verbose_models = False
        config.logging.log_technique_selection = False
        config.logging.log_escalation = False
        config.logging.log_rate_limits = False
        config.logging.log_spending = False
        print("\n✓ All logging disabled")

    if log_choice and log_choice != "back":
        input("Press Enter to continue...")
