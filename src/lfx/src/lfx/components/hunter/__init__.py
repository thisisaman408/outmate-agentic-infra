from __future__ import annotations

from typing import TYPE_CHECKING, Any

from lfx.components._importing import import_mod

if TYPE_CHECKING:
    from .hunter_domain_search import HunterDomainSearchComponent
    from .hunter_email_finder import HunterEmailFinderComponent
    from .hunter_email_verifier import HunterEmailVerifierComponent

_dynamic_imports = {
    "HunterDomainSearchComponent": "hunter_domain_search",
    "HunterEmailFinderComponent": "hunter_email_finder",
    "HunterEmailVerifierComponent": "hunter_email_verifier",
}

__all__ = ["HunterDomainSearchComponent", "HunterEmailFinderComponent", "HunterEmailVerifierComponent"]


def __getattr__(attr_name: str) -> Any:
    if attr_name not in _dynamic_imports:
        msg = f"module '{__name__}' has no attribute '{attr_name}'"
        raise AttributeError(msg)
    return import_mod(attr_name, _dynamic_imports[attr_name], __spec__.parent)


def __dir__():
    return __all__
