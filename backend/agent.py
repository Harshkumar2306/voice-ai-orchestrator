import os
from typing import TypedDict, Literal, Optional
from langgraph.graph import StateGraph, START, END
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.messages import SystemMessage, HumanMessage
from bson import ObjectId
from pydantic import BaseModel, Field
from enum import Enum

# Local imports
from database import db
from models import LeadStatus


# ---------------------------------------------------------------------------
# Enums & Pydantic Models
# ---------------------------------------------------------------------------

class SentimentLabel(str, Enum):
    """Possible sentiment labels for a call transcript."""
    POSITIVE = "POSITIVE"
    NEUTRAL = "NEUTRAL"
    NEGATIVE = "NEGATIVE"


class SentimentResult(BaseModel):
    """Structured output from the sentiment analysis LLM call."""
    sentiment: SentimentLabel = Field(
        description="The overall emotional tone of the transcript: POSITIVE, NEUTRAL, or NEGATIVE"
    )
    explanation: str = Field(
        description="A one-sentence justification for the chosen sentiment label"
    )


class EvaluationResult(BaseModel):
    """Structured output from the lead-evaluation LLM call."""
    status: LeadStatus = Field(
        description="The evaluated status of the lead: QUALIFIED, NOT_INTERESTED, or NEEDS_REVIEW"
    )
    reasoning: str = Field(
        description="Brief explanation of why this status was chosen"
    )
    confidence_score: float = Field(
        default=0.5,
        ge=0.0,
        le=1.0,
        description="Confidence score between 0.0 and 1.0 indicating how certain the LLM is about the evaluation"
    )
    sentiment: SentimentLabel = Field(
        default=SentimentLabel.NEUTRAL,
        description="The detected sentiment of the call: POSITIVE, NEUTRAL, or NEGATIVE"
    )


# ---------------------------------------------------------------------------
# Agent State
# ---------------------------------------------------------------------------

class AgentState(TypedDict):
    """The state object flowing through every node in the LangGraph pipeline."""
    customer_id: str
    transcript: str
    summary: str
    status_outcome: LeadStatus
    reasoning: str
    confidence_score: float
    sentiment: str          # "POSITIVE" | "NEUTRAL" | "NEGATIVE"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_llm():
    """
    Resolve the best available LLM provider.

    Priority:
        1. OpenAI  (gpt-4o-mini) — if OPENAI_API_KEY is set
        2. Groq    (llama3-70b)  — if GROQ_API_KEY is set

    Raises:
        RuntimeError: when no API key is found in the environment.
    """
    if os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI
        return ChatOpenAI(model="gpt-4o-mini", temperature=0)
    elif os.getenv("GROQ_API_KEY"):
        from langchain_groq import ChatGroq
        # Use Llama 3.1 which has excellent native JSON/structured output support
        return ChatGroq(model="llama-3.1-70b-versatile", temperature=0)
    else:
        raise RuntimeError(
            "No LLM API key provided. Set OPENAI_API_KEY or GROQ_API_KEY."
        )


# ---------------------------------------------------------------------------
# Node 1 — Sentiment Analysis
# ---------------------------------------------------------------------------

async def sentiment_analysis_node(state: AgentState) -> AgentState:
    """
    Analyse the emotional tone of the call transcript BEFORE evaluation.

    Populates the ``sentiment`` field in the state so downstream nodes can
    use it as additional context.
    """
    llm = _get_llm()
    structured_llm = llm.with_structured_output(SentimentResult)

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert communication analyst. Analyse the emotional tone "
            "of the following call transcript and classify it as POSITIVE, "
            "NEUTRAL, or NEGATIVE. Consider the customer's words, enthusiasm, "
            "hesitation, and overall engagement level."
        ),
        (
            "human",
            "Call summary:\n{summary}\n\nFull transcript:\n{transcript}\n\n"
            "Classify the sentiment."
        ),
    ])

    chain = prompt | structured_llm

    try:
        result = await chain.ainvoke({
            "summary": state.get("summary", ""),
            "transcript": state.get("transcript", ""),
        })
        return {
            "sentiment": result.sentiment.value,
        }
    except Exception as e:
        print(f"[sentiment_analysis_node] Error: {e}")
        return {
            "sentiment": SentimentLabel.NEUTRAL.value,
        }


# ---------------------------------------------------------------------------
# Node 2 — Evaluation
# ---------------------------------------------------------------------------

async def evaluation_node(state: AgentState) -> AgentState:
    """
    Evaluate the transcript and summary using an LLM to determine lead status,
    confidence score, and sentiment confirmation.

    Uses the sentiment produced by the previous node as additional context to
    improve accuracy.
    """
    llm = _get_llm()

    # Using structured output to ensure we get the right enum values
    structured_llm = llm.with_structured_output(EvaluationResult)

    detected_sentiment = state.get("sentiment", "NEUTRAL")

    prompt = ChatPromptTemplate.from_messages([
        (
            "system",
            "You are an expert sales analyst evaluating a call transcript between "
            "an AI agent and a potential lead.\n\n"
            "Pre-analysis detected a **{detected_sentiment}** sentiment from the customer.\n\n"
            "Your job:\n"
            "1. Determine if the lead is QUALIFIED (interested in our services, "
            "gave positive signals), NOT_INTERESTED (explicitly declined, asked "
            "to not be called, hung up quickly), or NEEDS_REVIEW (ambiguous "
            "response, needs human intervention).\n"
            "2. Provide a confidence_score between 0.0 and 1.0 reflecting how "
            "certain you are about the status.\n"
            "3. Confirm or override the detected sentiment with your own "
            "assessment (POSITIVE / NEUTRAL / NEGATIVE).\n"
            "4. Provide a brief reasoning."
        ),
        (
            "human",
            "Here is the call summary:\n{summary}\n\n"
            "Here is the full transcript:\n{transcript}\n\n"
            "Evaluate the lead status."
        ),
    ])

    chain = prompt | structured_llm

    try:
        result = await chain.ainvoke({
            "summary": state.get("summary", ""),
            "transcript": state.get("transcript", ""),
            "detected_sentiment": detected_sentiment,
        })
        return {
            "status_outcome": result.status,
            "reasoning": result.reasoning,
            "confidence_score": result.confidence_score,
            "sentiment": result.sentiment.value,
        }
    except Exception as e:
        print(f"[evaluation_node] Error: {e}")
        return {
            "status_outcome": LeadStatus.NEEDS_REVIEW,
            "reasoning": "Failed to parse LLM output.",
            "confidence_score": 0.0,
            "sentiment": state.get("sentiment", SentimentLabel.NEUTRAL.value),
        }


# ---------------------------------------------------------------------------
# Node 3 — Confidence-Based Routing Check
# ---------------------------------------------------------------------------

async def confidence_check_node(state: AgentState) -> AgentState:
    """
    Inspect the confidence_score produced by the evaluation node.

    If confidence is below the threshold (0.6), override the status to
    NEEDS_REVIEW so a human analyst can take over (human-in-the-loop).
    """
    confidence = state.get("confidence_score", 0.0)

    if confidence < 0.6:
        print(
            f"[confidence_check_node] Low confidence ({confidence:.2f}) — "
            f"routing to NEEDS_REVIEW (human-in-the-loop)."
        )
        return {
            "status_outcome": LeadStatus.NEEDS_REVIEW,
            "reasoning": (
                f"Low confidence ({confidence:.2f}). Original reasoning: "
                f"{state.get('reasoning', 'N/A')}. Flagged for human review."
            ),
        }

    # High-confidence: pass through unchanged
    return state


# ---------------------------------------------------------------------------
# Node 4 — Database State Update
# ---------------------------------------------------------------------------

async def state_update_node(state: AgentState) -> AgentState:
    """
    Persist the evaluated status, confidence score, and sentiment back to
    MongoDB so the dashboard reflects the latest outcome.
    """
    customer_id = state["customer_id"]
    status_outcome = state["status_outcome"]

    print(f"[state_update_node] Updating customer {customer_id} → {status_outcome.value}")

    try:
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {
                "$set": {
                    "status": status_outcome.value,
                    "confidence_score": state.get("confidence_score", 0.0),
                    "sentiment": state.get("sentiment", "NEUTRAL"),
                }
            },
        )

        # Also update the corresponding call log with evaluation results
        await db.call_logs.update_one(
            {"customer_id": customer_id, "outcome": "PENDING_EVALUATION"},
            {
                "$set": {
                    "outcome": status_outcome.value,
                    "reasoning": state.get("reasoning", ""),
                    "confidence_score": state.get("confidence_score", 0.0),
                    "sentiment": state.get("sentiment", "NEUTRAL"),
                }
            },
        )
    except Exception as e:
        print(f"[state_update_node] Error updating database: {e}")

    return state


# ---------------------------------------------------------------------------
# Conditional Routing Function
# ---------------------------------------------------------------------------

def route_after_evaluation(state: AgentState) -> Literal["confidence_check", "state_update"]:
    """
    Conditional edge executed after the evaluation node.

    Routes to:
        - ``confidence_check``  when confidence < 0.6  (human-in-the-loop)
        - ``state_update``      when confidence >= 0.6  (auto-approve)
    """
    confidence = state.get("confidence_score", 0.0)
    if confidence < 0.6:
        return "confidence_check"
    return "state_update"


# ---------------------------------------------------------------------------
# Build the LangGraph
# ---------------------------------------------------------------------------

workflow = StateGraph(AgentState)

# Add nodes (4 total)
workflow.add_node("sentiment_analysis", sentiment_analysis_node)
workflow.add_node("evaluate", evaluation_node)
workflow.add_node("confidence_check", confidence_check_node)
workflow.add_node("state_update", state_update_node)

# Set edges
workflow.add_edge(START, "sentiment_analysis")
workflow.add_edge("sentiment_analysis", "evaluate")

# Conditional edge: confidence-based routing after evaluation
workflow.add_conditional_edges(
    "evaluate",
    route_after_evaluation,
    {
        "confidence_check": "confidence_check",
        "state_update": "state_update",
    },
)

# Both branches converge to the database update and then END
workflow.add_edge("confidence_check", "state_update")
workflow.add_edge("state_update", END)

# Compile graph
app_graph = workflow.compile()
