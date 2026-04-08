from lfx.components._importing import import_mod

_dynamic_imports = {
    "ProspectResearchAgentComponent": "prospect_research_agent",
    "ICPScoringAgentComponent": "icp_scoring_agent",
    "ICPBuilderAgentComponent": "icp_builder_agent",
    "HyperPersonalisationAgentComponent": "hyper_personalisation_agent",
    "TAMDiscoveryAgentComponent": "tam_discovery_agent",
    "WaterfallEnrichmentAgentComponent": "waterfall_enrichment_agent",
    "IntentSignalAgentComponent": "intent_signal_agent",
    "OutboundCampaignAgentComponent": "outbound_campaign_agent",
    "VoiceOutreachAgentComponent": "voice_outreach_agent",
    "OutMateVoiceCallComponent": "outmate_voice_call",
    "CRMAutoFillAgentComponent": "crm_autofill_agent",
    "LinkedInOutreachAgentComponent": "linkedin_outreach_agent",
    "ReplyHandlerAgentComponent": "reply_handler_agent",
    "MeetingPrepAgentComponent": "meeting_prep_agent",
    "ChampionTrackerAgentComponent": "champion_tracker_agent",
    "TeamFinderAgentComponent": "team_finder_agent",
    "LeadDiscoveryOutreachAgentComponent": "lead_discovery_outreach_agent",
}

__all__ = list(_dynamic_imports.keys())


def __getattr__(attr_name: str):
    if attr_name not in _dynamic_imports:
        msg = f"module '{__name__}' has no attribute '{attr_name}'"
        raise AttributeError(msg)
    return import_mod(attr_name, _dynamic_imports[attr_name], __spec__.parent)


def __dir__():
    return __all__
