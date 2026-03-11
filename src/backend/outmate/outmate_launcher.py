import os
import platform
import sys
import typer

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

def main():
    if platform.system() == "Darwin":
        _launch_with_exec()
    else:
        from outmate.__main__ import main as outmate_main
        outmate_main()

def _launch_with_exec():
    os.environ["OBJC_DISABLE_INITIALIZE_FORK_SAFETY"] = "YES"
    os.environ["no_proxy"] = "*"
    try:
        os.execv(sys.executable, [sys.executable, "-m", "outmate.__main__", *sys.argv[1:]])
    except OSError as e:
        typer.echo(f"Failed to exec Outmate {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
