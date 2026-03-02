import asyncio
import logging
import sys
from pathlib import Path
from typing import Any, Dict

logger = logging.getLogger(__name__)


def _ensure_automation_paths_added() -> None:
    """
    Make the 5 CrewAI automation projects importable from the main backend.
    This is a lightweight, local-only sys.path shim.
    """
    base_dir = Path(__file__).resolve().parents[2]  # .../Backend
    automations = base_dir / "automations-agents"

    subprojects = [
        "b2b_viral_growth_engine_v1_crewai-project",
        "global_outreach_compliance_engine_v1_crewai-project",
        "adaptive_icp_command_center_v1_crewai-project",
        "executive_churn_prediction_engine_v1_crewai-project",
        "competitive_intelligence_market_analysis_v1_crewai-project",
    ]

    for name in subprojects:
        src = automations / name / "src"
        if src.is_dir():
            src_str = str(src)
            if src_str not in sys.path:
                sys.path.append(src_str)


_ensure_automation_paths_added()


class GTMAgentsService:
    """
    Thin orchestrator around the 5 CrewAI GTM agents.

    We expose a simple async API that the FastAPI router can call:
    - run_crossfire(inputs)
    - run_compliance_oracle(inputs)
    - run_virality_engine(inputs)
    - run_talent_radar(inputs)
    - run_regime_shifter(inputs)
    """

    def __init__(self) -> None:
        self._crossfire_crew = None
        self._compliance_crew = None
        self._virality_crew = None
        self._talent_radar_crew = None
        self._regime_shifter_crew = None

    def _get_crossfire_crew(self):
        if self._crossfire_crew is None:
            from competitive_intelligence_market_analysis.crew import CompetitiveIntelligenceMarketAnalysisCrew

            self._crossfire_crew = CompetitiveIntelligenceMarketAnalysisCrew().crew()
        return self._crossfire_crew

    def _get_compliance_crew(self):
        if self._compliance_crew is None:
            from global_outreach_compliance_engine.crew import GlobalOutreachComplianceEngineCrew

            self._compliance_crew = GlobalOutreachComplianceEngineCrew().crew()
        return self._compliance_crew

    def _get_virality_crew(self):
        if self._virality_crew is None:
            from b2b_viral_growth_engine.crew import B2bViralGrowthEngineCrew

            self._virality_crew = B2bViralGrowthEngineCrew().crew()
        return self._virality_crew

    def _get_talent_radar_crew(self):
        if self._talent_radar_crew is None:
            from executive_churn_prediction_engine.crew import ExecutiveChurnPredictionEngineCrew

            self._talent_radar_crew = ExecutiveChurnPredictionEngineCrew().crew()
        return self._talent_radar_crew

    def _get_regime_shifter_crew(self):
        if self._regime_shifter_crew is None:
            from adaptive_icp_command_center.crew import AdaptiveIcpCommandCenterCrew

            self._regime_shifter_crew = AdaptiveIcpCommandCenterCrew().crew()
        return self._regime_shifter_crew

    @staticmethod
    def _serialize_result(result: Any) -> Dict[str, Any]:
        """
        CrewAI's kickoff can return strings, dicts, or custom objects.
        Normalize that into a JSON-serializable dict for the API.
        """
        if isinstance(result, dict):
            return result
        if isinstance(result, (list, tuple)):
            return {"results": result}
        return {"result": str(result)}

    async def run_crossfire(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        crew = self._get_crossfire_crew()
        logger.info("Running Crossfire GTM agent with inputs=%s", inputs)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff, inputs)
        return self._serialize_result(result)

    async def run_compliance_oracle(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        crew = self._get_compliance_crew()
        logger.info("Running Compliance Oracle GTM agent with inputs=%s", inputs)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff, inputs)
        return self._serialize_result(result)

    async def run_virality_engine(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        crew = self._get_virality_crew()
        logger.info("Running Virality Engine GTM agent with inputs=%s", inputs)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff, inputs)
        return self._serialize_result(result)

    async def run_talent_radar(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        crew = self._get_talent_radar_crew()
        logger.info("Running Talent Radar GTM agent with inputs=%s", inputs)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff, inputs)
        return self._serialize_result(result)

    async def run_regime_shifter(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        crew = self._get_regime_shifter_crew()
        logger.info("Running Regime Shifter GTM agent with inputs=%s", inputs)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, crew.kickoff, inputs)
        return self._serialize_result(result)


gtm_agents_service = GTMAgentsService()

