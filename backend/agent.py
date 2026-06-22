import os
from typing import TypedDict, Literal
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from bson import ObjectId
from pydantic import BaseModel, Field

# Local imports
from database import db
from models import LeadStatus

class AgentState(TypedDict):
    customer_id: str
    transcript: str
    summary: str
    status_outcome: LeadStatus
    reasoning: str

class EvaluationResult(BaseModel):
    status: LeadStatus = Field(description="The evaluated status of the lead: QUALIFIED, NOT_INTERESTED, or NEEDS_REVIEW")
    reasoning: str = Field(description="Brief explanation of why this status was chosen")

async def evaluation_node(state: AgentState) -> AgentState:
    """
    Evaluates the transcript and summary using an LLM to determine lead status.
    """
    if os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0)
    elif os.getenv("GROQ_API_KEY"):
        from langchain_groq import ChatGroq
        # Using Llama 3 on Groq which is completely free
        llm = ChatGroq(model="llama3-70b-8192", temperature=0)
    else:
        raise Exception("No LLM API key provided. Set OPENAI_API_KEY or GROQ_API_KEY.")
        
    # Using structured output to ensure we get the right enum values
    structured_llm = llm.with_structured_output(EvaluationResult)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert sales analyst evaluating a call transcript between an AI agent and a potential lead. "
                   "Determine if the lead is QUALIFIED (interested in our services, gave positive signals), "
                   "NOT_INTERESTED (explicitly declined, asked to not be called, hung up quickly), or "
                   "NEEDS_REVIEW (ambiguous response, needs human intervention)."),
        ("human", "Here is the call summary:\n{summary}\n\nHere is the full transcript:\n{transcript}\n\nEvaluate the lead status.")
    ])
    
    chain = prompt | structured_llm
    
    try:
        result = await chain.ainvoke({
            "summary": state.get("summary", ""),
            "transcript": state.get("transcript", "")
        })
        return {
            "status_outcome": result.status,
            "reasoning": result.reasoning
        }
    except Exception as e:
        print(f"Error in evaluation: {e}")
        return {
            "status_outcome": LeadStatus.NEEDS_REVIEW,
            "reasoning": "Failed to parse LLM output."
        }

async def state_update_node(state: AgentState) -> AgentState:
    """
    Updates the customer's status in the MongoDB database based on the evaluation outcome.
    """
    customer_id = state["customer_id"]
    status_outcome = state["status_outcome"]
    
    print(f"Updating customer {customer_id} to status {status_outcome.value}")
    
    try:
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {"$set": {"status": status_outcome.value}}
        )
    except Exception as e:
        print(f"Error updating database: {e}")
        
    return state

# Build the LangGraph
workflow = StateGraph(AgentState)

# Add nodes
workflow.add_node("evaluate", evaluation_node)
workflow.add_node("update_db", state_update_node)

# Set edges
workflow.set_entry_point("evaluate")
workflow.add_edge("evaluate", "update_db")
workflow.add_edge("update_db", END)

# Compile graph
app_graph = workflow.compile()
