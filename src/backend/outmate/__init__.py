from .version.version import get_version

try:
    __version__ = get_version()
except ValueError:
    __version__ = "unknown"

__all__ = ["__version__"]
