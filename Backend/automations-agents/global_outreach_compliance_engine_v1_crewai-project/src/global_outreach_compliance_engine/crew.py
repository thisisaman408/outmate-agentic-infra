import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	ScrapeWebsiteTool
)





@CrewBase
class GlobalOutreachComplianceEngineCrew:
    """GlobalOutreachComplianceEngine crew"""

    
    @agent
    def global_outreach_compliance_architect(self) -> Agent:
        
        return Agent(
            config=self.agents_config["global_outreach_compliance_architect"],
            
            
            tools=[				ScrapeWebsiteTool()],
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
    def analyze_jurisdiction_compliance_requirements(self) -> Task:
        return Task(
            config=self.tasks_config["analyze_jurisdiction_compliance_requirements"],
            markdown=False,
            
            
        )
    
    @task
    def review_and_optimize_outreach_messaging(self) -> Task:
        return Task(
            config=self.tasks_config["review_and_optimize_outreach_messaging"],
            markdown=False,
            
            
        )
    
    @task
    def generate_compliance_risk_assessment_report(self) -> Task:
        return Task(
            config=self.tasks_config["generate_compliance_risk_assessment_report"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the GlobalOutreachComplianceEngine crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="openai/gpt-4o-mini"),
        )


