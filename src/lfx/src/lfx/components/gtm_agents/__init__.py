from lfx.components._importing import import_mod

_dynamic_imports = {
    "ProspectResearchAgentComponent": "prospect_research_agent",
    "ICPScoringAgentComponent": "icp_scoring_agent",
    "HyperPersonalisationAgentComponent": "hyper_personalisation_agent",
}

__all__ = list(_dynamic_imports.keys())


def __getattr__(attr_name: str):
    if attr_name not in _dynamic_imports:
        msg = f"module '{__name__}' has no attribute '{attr_name}'"
        raise AttributeError(msg)
    return import_mod(attr_name, _dynamic_imports[attr_name], __spec__.parent)


def __dir__():
    return __all__
