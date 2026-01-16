"""
Runner Module
=============

Test runner and build utilities.
"""

import subprocess

from .constants import PROJECT_ROOT
from .display import print_header


def run_tests() -> bool:
    """
    Run the auto-router test suite.

    Returns:
        True if all tests passed, False otherwise
    """
    print_header("Auto-Router Test Suite")

    test_file = PROJECT_ROOT / "test-auto-router.ts"
    if not test_file.exists():
        print(f"\n✗ Test file not found: {test_file}")
        return False

    print(f"\nRunning tests from: {test_file}\n")
    print("-" * 60)

    result = subprocess.run(
        ["npx", "tsx", str(test_file)],
        cwd=PROJECT_ROOT,
        capture_output=False,  # Show output in real-time
        text=True
    )

    print("-" * 60)

    if result.returncode == 0:
        print("\n✓ All tests passed!")
        return True
    else:
        print("\n✗ Some tests failed!")
        return False


def run_build() -> bool:
    """
    Run the plugin build.

    Returns:
        True if build succeeded, False otherwise
    """
    print("Rebuilding plugin...")

    result = subprocess.run(
        ["bun", "run", "build"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("✓ Build successful!")
        return True
    else:
        print(f"✗ Build failed:\n{result.stderr}")
        return False


def run_typecheck() -> bool:
    """
    Run TypeScript type checking.

    Returns:
        True if typecheck passed, False otherwise
    """
    print("Running typecheck...")

    result = subprocess.run(
        ["bun", "run", "typecheck"],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True
    )

    if result.returncode == 0:
        print("✓ Typecheck passed!")
        return True
    else:
        print(f"✗ Typecheck failed:\n{result.stderr}")
        return False
