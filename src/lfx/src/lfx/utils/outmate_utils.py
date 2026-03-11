"""Outmate environment utility functions."""

import importlib.util

from lfx.log.logger import logger


class _OutmateModule:
    # Static variable
    # Tri-state:
    # - None: Outmate check not performed yet
    # - True: Outmate is available
    # - False: Outmate is not available
    _available = None

    @classmethod
    def is_available(cls):
        return cls._available

    @classmethod
    def set_available(cls, value):
        cls._available = value


def has_outmate_memory():
    """Check if outmate memory (with database support) and MessageTable are available."""
    # Use cached check from previous invocation (if applicable)
    is_outmate_available = _OutmateModule.is_available()

    if is_outmate_available is not None:
        return is_outmate_available

    # First check (lazy load and cache check)
    module_spec = None

    try:
        module_spec = importlib.util.find_spec("outmate")
    except ImportError:
        pass
    except (TypeError, ValueError) as e:
        logger.error(f"Error encountered checking for outmate memory: {e}")

    is_outmate_available = module_spec is not None
    _OutmateModule.set_available(is_outmate_available)

    return is_outmate_available
