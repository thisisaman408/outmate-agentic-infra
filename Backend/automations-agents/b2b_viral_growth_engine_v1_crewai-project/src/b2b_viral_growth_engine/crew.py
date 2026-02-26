import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	FirecrawlScrapeWebsiteTool
)





@CrewBase
class B2bViralGrowthEngineCrew:
    """B2bViralGrowthEngine crew"""

    
    @agent
    def b2b_network_virality_engineer(self) -> Agent:
        
        return Agent(
            config=self.agents_config["b2b_network_virality_engineer"],
            
            
            tools=[				FirecrawlScrapeWebsiteTool()],
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
    def map_network_virality_opportunities(self) -> Task:
        return Task(
            config=self.tasks_config["map_network_virality_opportunities"],
            markdown=False,
            
            
        )
    
    @task
    def engineer_self_propagating_referral_hooks(self) -> Task:
        return Task(
            config=self.tasks_config["engineer_self_propagating_referral_hooks"],
            markdown=False,
            
            
        )
    
    @task
    def execute_multi_channel_cascade_strategy(self) -> Task:
        return Task(
            config=self.tasks_config["execute_multi_channel_cascade_strategy"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the B2bViralGrowthEngine crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="openai/gpt-4o-mini"),
        )


