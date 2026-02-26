import os

from crewai import LLM
from crewai import Agent, Crew, Process, Task
from crewai.project import CrewBase, agent, crew, task
from crewai_tools import (
	ScrapeWebsiteTool
)





@CrewBase
class ExecutiveChurnPredictionEngineCrew:
    """ExecutiveChurnPredictionEngine crew"""

    
    @agent
    def executive_churn_prediction_strategist(self) -> Agent:
        
        return Agent(
            config=self.agents_config["executive_churn_prediction_strategist"],
            
            
            tools=[				ScrapeWebsiteTool()],
            reasoning=False,
            max_reasoning_attempts=None,
            inject_date=True,
            allow_delegation=False,
            max_iter=25,
            max_rpm=None,
            
            apps=[
                    "salesforce/search_records_account",
                    
                    "google_gmail/send_email",
                    
                    "hubspot/search_companies",
                    
                    "slack/send_message",
                    
                    "microsoft_excel/create_workbook",
                    ],
            
            max_execution_time=None,
            llm=LLM(
                model="openai/gpt-4o-mini",
                temperature=0.7,
            ),
            
        )
    

    
    @task
    def monitor_customer_hiring_signals_market_intelligence(self) -> Task:
        return Task(
            config=self.tasks_config["monitor_customer_hiring_signals_market_intelligence"],
            markdown=False,
            
            
        )
    
    @task
    def cross_platform_account_analysis_risk_scoring(self) -> Task:
        return Task(
            config=self.tasks_config["cross_platform_account_analysis_risk_scoring"],
            markdown=False,
            
            
        )
    
    @task
    def execute_multi_channel_retention_campaign(self) -> Task:
        return Task(
            config=self.tasks_config["execute_multi_channel_retention_campaign"],
            markdown=False,
            
            
        )
    

    @crew
    def crew(self) -> Crew:
        """Creates the ExecutiveChurnPredictionEngine crew"""
        return Crew(
            agents=self.agents,  # Automatically created by the @agent decorator
            tasks=self.tasks,  # Automatically created by the @task decorator
            process=Process.sequential,
            verbose=True,
            chat_llm=LLM(model="openai/gpt-4o-mini"),
        )


