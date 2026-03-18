from __future__ import annotations

from typing import TYPE_CHECKING, Any

from lfx.components._importing import import_mod

if TYPE_CHECKING:
    from .builtwith_lookup import BuiltWithLookupComponent

_dynamic_imports = {
    "BuiltWithLookupComponent": "builtwith_lookup",
}

__all__ = ["BuiltWithLookupComponent"]


def __getattr__(attr_name: str) -> Any:
    if attr_name not in _dynamic_imports:
        msg = f"module '{__name__}' has no attribute '{attr_name}'"
        raise AttributeError(msg)
    return import_mod(attr_name, _dynamic_imports[attr_name], __spec__.parent)


def __dir__():
    return __all__
