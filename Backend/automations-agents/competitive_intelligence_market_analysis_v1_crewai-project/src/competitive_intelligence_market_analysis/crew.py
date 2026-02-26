import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	SerperDevTool,
	JinaScrapeWebsiteTool,
	FileReadTool
)





@CrewBase
class CompetitiveIntelligenceMarketAnalysisCrew:
    """CompetitiveIntelligenceMarketAnalysis crew"""

    
    @agent
    def competitive_intelligence_research_specialist(self) -> Agent:
        
        return Agent(
            config=self.agents_config["competitive_intelligence_research_specialist"],
            
            
            tools=[				SerperDevTool(),
				JinaScrapeWebsiteTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            
            max_execution_time=None,
            llm=LLM(
                model="openai/gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def strategic_market_analyst(self) -> Agent:
        
        return Agent(
            config=self.agents_config["strategic_market_analyst"],
            
            
            tools=[				FileReadTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            
            max_execution_time=None,
            llm=LLM(
                model="openai/gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    
    @agent
    def strategic_implementation_consultant(self) -> Agent:
        
        return Agent(
            config=self.agents_config["strategic_implementation_consultant"],
            
            
            tools=[				FileReadTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            
            max_execution_time=None,
            llm=LLM(
                model="openai/gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    

    
    @task
    def research_competitor_landscape(self) -> Task:
        return Task(
            config=self.tasks_config["research_competitor_landscape"],
            markdown=False,
            
            
        )
    
    @task
    def analyze_market_opportunities(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_market_opportunities"],
            markdown=False,
            
            
        )
    
    @task
    def develop_strategic_recommendations(self) -> Task:
        return Task(
            config=self.tasks_config["develop_strategic_recommendations"],
            markdown=False,
            
            
        )
    
    @task
    def create_actionable_implementation_plan(self) -> Task:
        return Task(
            config=self.tasks_config["create_actionable_implementation_plan"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the CompetitiveIntelligenceMarketAnalysis crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="openai/gpt-4o-mini"),
        )


