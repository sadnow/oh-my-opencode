#!/usr/bin/env python3
"""
oh-my-opencode Fork WebUI Launcher

Starts the WebUI server with real-time usage monitoring for:
- Claude Max subscription (Anthropic OAuth API)
- GitHub Copilot premium requests (GitHub API)
- Budget orchestration with adaptive tier management

Usage:
    python run.py              # Start with defaults
    python run.py --port 8080  # Custom port
    python run.py --bind 0.0.0.0  # Bind to all interfaces
    python run.py --open       # Open browser after start
"""

import argparse
import os
import signal
import subprocess
import sys
import webbrowser
from pathlib import Path
from time import sleep


def get_project_root() -> Path:
    """Get the project root directory (parent of fork/)."""
    return Path(__file__).parent.parent.resolve()


def kill_process_on_port(port: int) -> bool:
    """Kill any process using the specified port.
    
    Returns True if a process was killed, False otherwise.
    """
    import platform
    
    try:
        if platform.system() == "Windows":
            # Find PID using netstat
            result = subprocess.run(
                f'netstat -ano | findstr :{port} | findstr LISTENING',
                capture_output=True,
                text=True,
                shell=True
            )
            
            if result.returncode == 0 and result.stdout.strip():
                # Parse PIDs from output
                pids = set()
                for line in result.stdout.strip().split('\n'):
                    parts = line.split()
                    if len(parts) >= 5:
                        pids.add(parts[-1])
                
                # Kill each PID
                for pid in pids:
                    if pid and pid.isdigit():
                        subprocess.run(f'taskkill /F /PID {pid}', shell=True, capture_output=True)
                        print(f"Killed process {pid} on port {port}")
                return bool(pids)
        else:
            # Unix/Linux/macOS - use lsof
            result = subprocess.run(
                f'lsof -ti :{port}',
                capture_output=True,
                text=True,
                shell=True
            )
            
            if result.returncode == 0 and result.stdout.strip():
                pids = result.stdout.strip().split('\n')
                for pid in pids:
                    if pid.isdigit():
                        subprocess.run(f'kill -9 {pid}', shell=True, capture_output=True)
                        print(f"Killed process {pid} on port {port}")
                return bool(pids)
    except Exception as e:
        print(f"Warning: Could not check/kill process on port {port}: {e}")
    
    return False


def check_bun_installed() -> bool:
    """Check if bun is installed."""
    try:
        result = subprocess.run(
            ["bun", "--version"],
            capture_output=True,
            text=True,
            timeout=5,
            shell=True  # Required on Windows to find commands in PATH
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def start_webui(port: int = 3847, bind: str = "localhost", open_browser: bool = False) -> int:
    """Start the WebUI server.

    Args:
        port: Port to run the server on
        bind: Address to bind to (localhost or 0.0.0.0)
        open_browser: Whether to open browser after start

    Returns:
        Exit code from the server process
    """
    project_root = get_project_root()
    fork_dir = project_root / "fork"

    # Auto-kill any existing process on the port
    if kill_process_on_port(port):
        sleep(0.5)  # Brief pause to let port release

    # Check bun is installed
    if not check_bun_installed():
        print("Error: bun is not installed.")
        print("Install it from: https://bun.sh")
        return 1

    # Set environment variables
    env = os.environ.copy()
    if port != 3847:
        env["WEBUI_PORT"] = str(port)

    # Build command
    script_path = fork_dir / "start-webui.ts"
    cmd = ["bun", "run", str(script_path)]

    print(f"{'=' * 50}")
    print("oh-my-opencode Fork WebUI")
    print(f"{'=' * 50}")
    print(f"Project root: {project_root}")
    print(f"Server URL:   http://{bind}:{port}")
    print(f"Dashboard:    http://{bind}:{port}/budget-dashboard")
    print(f"{'=' * 50}")
    print()

    # Open browser after a short delay
    if open_browser:
        def open_browser_delayed():
            sleep(2)
            webbrowser.open(f"http://{bind}:{port}/budget-dashboard")

        import threading
        threading.Thread(target=open_browser_delayed, daemon=True).start()

    # Start the server
    try:
        process = subprocess.Popen(
            cmd,
            cwd=str(project_root),
            env=env,
            shell=True  # Required on Windows to find commands in PATH
        )

        # Handle Ctrl+C gracefully
        def signal_handler(signum, frame):
            print("\nShutting down...")
            process.terminate()
            process.wait(timeout=5)
            sys.exit(0)

        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)

        # Wait for process
        return process.wait()

    except KeyboardInterrupt:
        print("\nShutting down...")
        return 0
    except Exception as e:
        print(f"Error starting server: {e}")
        return 1


def main():
    parser = argparse.ArgumentParser(
        description="Start the oh-my-opencode Fork WebUI server",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Features:
  - Real-time Claude Max usage tracking (Anthropic OAuth API)
  - Real-time GitHub Copilot usage tracking (GitHub API)
  - Budget orchestration with adaptive tier management
  - Analytics dashboard with spending trends
  - Tier management controls (auto-upgrade/downgrade)

Examples:
  python run.py                    # Start on default port 3847
  python run.py --port 8080        # Use custom port
  python run.py --open             # Open browser automatically
  python run.py --bind 0.0.0.0     # Allow external connections
"""
    )

    parser.add_argument(
        "--port", "-p",
        type=int,
        default=3847,
        help="Port to run the server on (default: 3847)"
    )

    parser.add_argument(
        "--bind", "-b",
        type=str,
        default="localhost",
        choices=["localhost", "0.0.0.0"],
        help="Address to bind to (default: localhost)"
    )

    parser.add_argument(
        "--open", "-o",
        action="store_true",
        help="Open browser after server starts"
    )

    args = parser.parse_args()

    sys.exit(start_webui(
        port=args.port,
        bind=args.bind,
        open_browser=args.open
    ))


if __name__ == "__main__":
    main()
