#!/usr/bin/env python3
"""
AutoCode Setup Wizard v2.1
==========================

A comprehensive CLI tool for configuring oh-my-opencode's auto-router settings.
Now modularized into the `autocode_wizard` package for better maintainability.

Usage:
    python autocode_setup.py              # Interactive CLI mode (arrow navigation)
    python autocode_setup.py --fast       # Fast setup with profile selection
    python autocode_setup.py --status     # Show current configuration & stats
    python autocode_setup.py --expenses   # Show expense breakdown by provider
    python autocode_setup.py --test       # Run auto-router tests
    python autocode_setup.py --rebuild    # Rebuild the plugin

Profile Selection:
    python autocode_setup.py --profile balanced
    python autocode_setup.py --profile ultra-frugal
    python autocode_setup.py --profile quality-first

Options Mode:
    python autocode_setup.py --options    # Show all available flags

Package Structure:
    autocode_wizard/
    ├── __init__.py       # Package exports
    ├── __main__.py       # Module entry point
    ├── constants.py      # Enums and constants
    ├── models.py         # Data classes
    ├── profiles.py       # Profile definitions
    ├── config_io.py      # File I/O operations
    ├── display.py        # UI display utilities
    ├── menu.py           # Interactive menu
    ├── interactive.py    # Full interactive CLI
    ├── runner.py         # Test/build runner
    └── cli.py            # CLI argument handling

The modular structure allows:
    - Direct imports: `from autocode_wizard import PROFILES`
    - Module execution: `python -m autocode_wizard --fast`
    - Easy extension and maintenance
"""

# Import and run the main function from the modular package
from autocode_wizard import main

if __name__ == "__main__":
    main()
