"""
Menu Module
===========

Interactive menu component with arrow key navigation.
Supports curses (Unix), readchar (Windows), and numbered fallback.
"""

import os
import subprocess
import sys
from typing import List, Optional, Tuple

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


def has_arrow_key_support() -> bool:
    """Check if arrow key navigation is available."""
    return HAS_CURSES or HAS_READCHAR


class InteractiveMenu:
    """Interactive menu with arrow key navigation."""

    def __init__(
        self,
        title: str,
        options: List[Tuple[str, str]],
        allow_back: bool = True
    ):
        """
        Initialize the menu.

        Args:
            title: Menu title to display
            options: List of (key, label) tuples
            allow_back: Whether to add a "Go Back" option
        """
        self.title = title
        self.options = list(options)  # Make a copy
        if allow_back:
            self.options.append(("back", "Go Back"))
        self.selected = 0

    def run(self) -> Optional[str]:
        """
        Run the menu and return the selected option key.

        Returns:
            The key of the selected option, or None if cancelled
        """
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
            print("-" * 50)
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
            # Clear screen (using subprocess for security)
            subprocess.run(
                ['cls' if os.name == 'nt' else 'clear'],
                shell=True,
                check=False
            )

            # Draw menu
            print(f"\n{self.title}")
            print("-" * 50)
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
                stdscr.addstr(2, 2, "-" * 50)
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


def select_from_list(
    title: str,
    items: List[Tuple[str, str]],
    allow_back: bool = True
) -> Optional[str]:
    """
    Convenience function to display a menu and get selection.

    Args:
        title: Menu title
        items: List of (key, label) tuples
        allow_back: Whether to add a back option

    Returns:
        Selected key or None if cancelled
    """
    menu = InteractiveMenu(title, items, allow_back)
    return menu.run()
