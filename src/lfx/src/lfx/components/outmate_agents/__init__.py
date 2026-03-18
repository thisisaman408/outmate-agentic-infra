from __future__ import annotations

from typing import TYPE_CHECKING, Any

from lfx.components._importing import import_mod

if TYPE_CHECKING:
    from .agentic_search import AgenticSearchComponent
    from .compliance_oracle import ComplianceOracleComponent
    from .crossfire import CrossfireComponent
    from .lookalike_agent import LookalikeAgentComponent
    from .predictive_scoring import PredictiveScoringComponent
    from .regime_shifter import RegimeShifterComponent
    from .research_agent import ResearchAgentComponent
    from .talent_radar import TalentRadarComponent
    from .virality_engine import ViralityEngineComponent

_dynamic_imports = {
    "AgenticSearchComponent": "agentic_search",
    "ResearchAgentComponent": "research_agent",
    "LookalikeAgentComponent": "lookalike_agent",
    "PredictiveScoringComponent": "predictive_scoring",
    "CrossfireComponent": "crossfire",
    "ComplianceOracleComponent": "compliance_oracle",
    "ViralityEngineComponent": "virality_engine",
    "TalentRadarComponent": "talent_radar",
    "RegimeShifterComponent": "regime_shifter",
}

__all__ = list(_dynamic_imports.keys())


def __getattr__(attr_name: str) -> Any:
    if attr_name not in _dynamic_imports:
        msg = f"module '{__name__}' has no attribute '{attr_name}'"
        raise AttributeError(msg)
    return import_mod(attr_name, _dynamic_imports[attr_name], __spec__.parent)


def __dir__():
    return __all__
