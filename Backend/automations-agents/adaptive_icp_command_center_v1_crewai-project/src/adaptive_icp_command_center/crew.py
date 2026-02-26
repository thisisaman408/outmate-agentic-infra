import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	SerperDevTool,
	SerplyNewsSearchTool,
	JinaScrapeWebsiteTool,
	BrightDataDatasetTool,
	ContextualAIParseTool,
	AIMindTool,
	FileReadTool
)





@CrewBase
class AdaptiveIcpCommandCenterCrew:
    """AdaptiveIcpCommandCenter crew"""

    
    @agent
    def strategic_icp_war_room_commander(self) -> Agent:
        
        return Agent(
            config=self.agents_config["strategic_icp_war_room_commander"],
            
            
            tools=[				SerperDevTool(),
				AIMindTool()],
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
    def elite_market_intelligence_analyst(self) -> Agent:
        
        return Agent(
            config=self.agents_config["elite_market_intelligence_analyst"],
            
            
            tools=[				SerplyNewsSearchTool(),
				JinaScrapeWebsiteTool(),
				ContextualAIParseTool()],
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
    def rapid_deployment_operations_chief(self) -> Agent:
        
        return Agent(
            config=self.agents_config["rapid_deployment_operations_chief"],
            
            
            tools=[				BrightDataDatasetTool(),
				FileReadTool()],
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
    def deploy_intelligence_surveillance_network(self) -> Task:
        return Task(
            config=self.tasks_config["deploy_intelligence_surveillance_network"],
            markdown=False,
            
            
        )
    
    @task
    def execute_strategic_war_room_analysis(self) -> Task:
        return Task(
            config=self.tasks_config["execute_strategic_war_room_analysis"],
            markdown=False,
            
            
        )
    
    @task
    def launch_rapid_deployment_operations(self) -> Task:
        return Task(
            config=self.tasks_config["launch_rapid_deployment_operations"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the AdaptiveIcpCommandCenter crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="openai/gpt-4o-mini"),
        )


