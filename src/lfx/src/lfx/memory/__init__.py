"""Memory management for lfx with dynamic loading.

This module automatically chooses between the full outmate implementation
(when available) and the lfx implementation (when standalone).
"""

from lfx.utils.outmate_utils import has_outmate_memory

# Import the appropriate implementation
if has_outmate_memory():
    try:
        # Import full outmate implementation
        from outmate.memory import (
            aadd_messages,
            aadd_messagetables,
            add_messages,
            adelete_messages,
            aget_messages,
            astore_message,
            aupdate_messages,
            delete_message,
            delete_messages,
            get_messages,
            store_message,
        )
    except ImportError:
        # Fallback to lfx implementation if outmate import fails
        from lfx.memory.stubs import (
            aadd_messages,
            aadd_messagetables,
            add_messages,
            adelete_messages,
            aget_messages,
            astore_message,
            aupdate_messages,
            delete_message,
            delete_messages,
            get_messages,
            store_message,
        )
else:
    # Use lfx implementation
    from lfx.memory.stubs import (
        aadd_messages,
        aadd_messagetables,
        add_messages,
        adelete_messages,
        aget_messages,
        astore_message,
        aupdate_messages,
        delete_message,
        delete_messages,
        get_messages,
        store_message,
    )

# Export the available functions
__all__ = [
    "aadd_messages",
    "aadd_messagetables",
    "add_messages",
    "adelete_messages",
    "aget_messages",
    "astore_message",
    "aupdate_messages",
    "delete_message",
    "delete_messages",
    "get_messages",
    "store_message",
]
