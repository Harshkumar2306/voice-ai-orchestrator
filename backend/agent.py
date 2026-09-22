import os
import json
import re
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

def _get_llm(model_override: Optional[str] = None):
    """
    Resolve the best available LLM provider.

    Priority:
        1. OpenAI  (gpt-4o-mini)             — if OPENAI_API_KEY is set
        2. Groq    (llama-3.3-70b-versatile) — if GROQ_API_KEY is set
           (Note: llama-3.1-70b was decommissioned by Groq)

    Returns None if no API key is provided, enabling graceful fallback to
    the intelligent heuristic evaluation engine.
    """
    if os.getenv("OPENAI_API_KEY"):
        from langchain_openai import ChatOpenAI
        model_name = model_override or os.getenv("OPENAI_MODEL", "gpt-4o-mini")
        return ChatOpenAI(model=model_name, temperature=0)
    elif os.getenv("GROQ_API_KEY"):
        from langchain_groq import ChatGroq
        # Use active Groq models (llama-3.3-70b-versatile or llama-3.1-8b-instant)
        model_name = model_override or os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        return ChatGroq(model=model_name, temperature=0)
    else:
        return None


def _heuristic_sentiment(transcript: str, summary: str) -> tuple[SentimentLabel, str]:
    """Fallback sentiment analyser using conversational intent heuristics."""
    text = f"{summary} {transcript}".lower()

    positive_cues = [
        "interested", "buy", "buying", "purchase", "purchasing", "invest", "investment",
        "acres", "acre", "sounds good", "great", "excellent", "definitely", "yes",
        "sure", "good", "excited", "happy", "thank you", "thanks", "looking for",
        "thinking to buy", "share details", "send details"
    ]
    negative_cues = [
        "not interested", "don't call", "stop calling", "remove me", "wrong number",
        "hung up", "no thanks", "no thank you", "no interest", "busy", "scam",
        "do not call", "never call", "annoying", "waste of time"
    ]

    pos_score = sum(1 for cue in positive_cues if cue in text)
    neg_score = sum(1 for cue in negative_cues if cue in text)

    if neg_score > pos_score:
        return SentimentLabel.NEGATIVE, "Customer expressed disinterest or reluctance."
    elif pos_score > 0:
        return SentimentLabel.POSITIVE, "Customer engaged positively with purchase/inquiry signals."
    else:
        return SentimentLabel.NEUTRAL, "Conversation was neutral without strong emotional signals."


def _heuristic_evaluate(
    transcript: str, summary: str, detected_sentiment: str = "NEUTRAL"
) -> EvaluationResult:
    """Fallback lead evaluator using domain-specific real-estate & sales heuristics."""
    text = f"{summary} {transcript}".lower()

    # 1. Clear refusal / negative signals
    refusal_cues = [
        "not interested", "don't call", "stop calling", "remove me", "wrong number",
        "no interest", "never call", "do not call", "hang up", "hung up"
    ]
    for cue in refusal_cues:
        if cue in text:
            return EvaluationResult(
                status=LeadStatus.NOT_INTERESTED,
                reasoning=f"Customer clearly declined further contact ('{cue}').",
                confidence_score=0.92,
                sentiment=SentimentLabel.NEGATIVE,
            )

    # 2. High-intent buying / qualification signals
    buying_cues = [
        "buy", "buying", "purchase", "purchasing", "invest", "investment",
        "acre", "acres", "land", "plot", "house", "villa", "apartment", "flat",
        "commercial", "residential", "property", "budget", "looking to buy",
        "interested in purchasing", "thinking to buy"
    ]
    matched_cues = [cue for cue in buying_cues if cue in text]
    if matched_cues:
        intent_desc = ", ".join(matched_cues[:3])
        return EvaluationResult(
            status=LeadStatus.QUALIFIED,
            reasoning=f"Customer expressed direct purchase interest (signals: {intent_desc}). High buying intent confirmed.",
            confidence_score=0.88,
            sentiment=SentimentLabel.POSITIVE if detected_sentiment != "NEGATIVE" else SentimentLabel.NEUTRAL,
        )

    # 3. Ambiguous or insufficient signal
    return EvaluationResult(
        status=LeadStatus.NEEDS_REVIEW,
        reasoning="Call ended without definitive purchase commitment or refusal. Flagged for human review.",
        confidence_score=0.50,
        sentiment=SentimentLabel.NEUTRAL,
    )


# ---------------------------------------------------------------------------
# Node 1 — Sentiment Analysis
# ---------------------------------------------------------------------------

async def sentiment_analysis_node(state: AgentState) -> AgentState:
    """
    Analyse the emotional tone of the call transcript BEFORE evaluation.

    Populates the ``sentiment`` field in the state so downstream nodes can
    use it as additional context. Tries LLM structured output, falls back to
    direct prompting, then domain heuristics.
    """
    summary = state.get("summary", "")
    transcript = state.get("transcript", "")

    llm = _get_llm()
    if llm:
        # Layer 1: Structured output
        try:
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
            result = await chain.ainvoke({"summary": summary, "transcript": transcript})
            return {"sentiment": result.sentiment.value}
        except Exception as e1:
            print(f"[sentiment_analysis_node] Structured output attempt failed: {e1}")
            # Layer 2: Raw text prompt
            try:
                raw_prompt = (
                    f"Analyze this call transcript and respond with ONLY one word: "
                    f"POSITIVE, NEUTRAL, or NEGATIVE.\n\n"
                    f"Summary: {summary}\nTranscript: {transcript}"
                )
                response = await llm.ainvoke(raw_prompt)
                content = (getattr(response, "content", "") or "").strip().upper()
                for label in ["POSITIVE", "NEGATIVE", "NEUTRAL"]:
                    if label in content:
                        return {"sentiment": label}
            except Exception as e2:
                print(f"[sentiment_analysis_node] Raw prompt failed: {e2}")

    # Layer 3: Intelligent heuristic fallback
    sentiment_label, _ = _heuristic_sentiment(transcript, summary)
    return {"sentiment": sentiment_label.value}


# ---------------------------------------------------------------------------
# Node 2 — Evaluation
# ---------------------------------------------------------------------------

async def evaluation_node(state: AgentState) -> AgentState:
    """
    Evaluate the transcript and summary using an LLM to determine lead status,
    confidence score, and sentiment confirmation.

    Multi-layer resilience:
      1. Structured LLM evaluation (OpenAI / Groq llama-3.3-70b-versatile)
      2. Direct JSON prompt LLM fallback (extracts valid JSON even if tool calls fail)
      3. Fast model retry (llama-3.1-8b-instant if Groq 70b is rate-limited or fails)
      4. Intelligent heuristic intent engine fallback (guarantees accurate classification
         even during API outages, rate limits, or missing keys)
    """
    summary = state.get("summary", "")
    transcript = state.get("transcript", "")
    detected_sentiment = state.get("sentiment", "NEUTRAL")

    last_error = None
    llm = _get_llm()

    if llm:
        # Layer 1: Structured LLM output
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

        try:
            structured_llm = llm.with_structured_output(EvaluationResult)
            chain = prompt | structured_llm
            result = await chain.ainvoke({
                "summary": summary,
                "transcript": transcript,
                "detected_sentiment": detected_sentiment,
            })
            return {
                "status_outcome": result.status,
                "reasoning": result.reasoning,
                "confidence_score": result.confidence_score,
                "sentiment": result.sentiment.value,
            }
        except Exception as e:
            last_error = e
            print(f"[evaluation_node] Structured output failed: {e}")

        # Layer 2: Direct JSON prompt with regex extraction & optional fast-model retry
        json_prompt = (
            "You are an expert sales analyst. Evaluate this call transcript and return a VALID JSON object.\n"
            "Output ONLY a raw JSON object matching this schema:\n"
            "{\n"
            '  "status": "QUALIFIED" | "NOT_INTERESTED" | "NEEDS_REVIEW",\n'
            '  "reasoning": "Brief explanation",\n'
            '  "confidence_score": 0.85,\n'
            '  "sentiment": "POSITIVE" | "NEUTRAL" | "NEGATIVE"\n'
            "}\n\n"
            f"Pre-detected Sentiment: {detected_sentiment}\n"
            f"Call summary:\n{summary}\n\n"
            f"Full transcript:\n{transcript}"
        )

        candidate_models = [llm]
        if os.getenv("GROQ_API_KEY"):
            fast_groq = _get_llm(model_override="llama-3.1-8b-instant")
            if fast_groq:
                candidate_models.append(fast_groq)

        for candidate_llm in candidate_models:
            try:
                raw_res = await candidate_llm.ainvoke(json_prompt)
                raw_text = raw_res.content if hasattr(raw_res, "content") else str(raw_res)
                match = re.search(r"\{.*\}", raw_text, re.DOTALL)
                if match:
                    parsed = json.loads(match.group(0))
                    status_raw = str(parsed.get("status", "NEEDS_REVIEW")).upper()
                    status_enum = (
                        LeadStatus.QUALIFIED if "QUALIFIED" in status_raw else
                        LeadStatus.NOT_INTERESTED if "NOT_INTERESTED" in status_raw else
                        LeadStatus.NEEDS_REVIEW
                    )
                    sentiment_raw = str(parsed.get("sentiment", "NEUTRAL")).upper()
                    sentiment_val = (
                        "POSITIVE" if "POSITIVE" in sentiment_raw else
                        "NEGATIVE" if "NEGATIVE" in sentiment_raw else
                        "NEUTRAL"
                    )
                    conf = float(parsed.get("confidence_score", 0.85))
                    conf = max(0.0, min(1.0, conf))
                    return {
                        "status_outcome": status_enum,
                        "reasoning": str(parsed.get("reasoning", "Evaluated via direct LLM JSON analysis.")),
                        "confidence_score": conf,
                        "sentiment": sentiment_val,
                    }
            except Exception as e_json:
                last_error = e_json
                print(f"[evaluation_node] Raw JSON parsing failed: {e_json}")

    # Layer 3: Intelligent Heuristic Fallback Engine
    heuristic_res = _heuristic_evaluate(transcript, summary, detected_sentiment)
    reasoning_text = heuristic_res.reasoning
    if last_error:
        clean_err = str(last_error).replace("\n", " ")[:120]
        reasoning_text += f" (Note: Evaluated via heuristic intent parser; LLM: {clean_err})"

    return {
        "status_outcome": heuristic_res.status,
        "reasoning": reasoning_text,
        "confidence_score": heuristic_res.confidence_score,
        "sentiment": heuristic_res.sentiment.value,
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
    status_outcome = state.get("status_outcome", LeadStatus.NEEDS_REVIEW)
    status_val = status_outcome.value if hasattr(status_outcome, "value") else str(status_outcome)

    print(f"[state_update_node] Updating customer {customer_id} → {status_val}")

    try:
        await db.customers.update_one(
            {"_id": ObjectId(customer_id)},
            {
                "$set": {
                    "status": status_val,
                    "confidence_score": state.get("confidence_score", 0.0),
                    "sentiment": state.get("sentiment", "NEUTRAL"),
                }
            },
        )

        # Update the most recent call log for this customer
        latest_log = await db.call_logs.find_one(
            {"customer_id": customer_id},
            sort=[("_id", -1)]
        )
        if latest_log:
            await db.call_logs.update_one(
                {"_id": latest_log["_id"]},
                {
                    "$set": {
                        "outcome": status_val,
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
