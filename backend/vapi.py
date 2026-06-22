import os
import httpx
from dotenv import load_dotenv

load_dotenv()

VAPI_API_KEY = os.getenv("VAPI_API_KEY")
VAPI_PHONE_NUMBER_ID = os.getenv("VAPI_PHONE_NUMBER_ID")
PUBLIC_URL = os.getenv("PUBLIC_URL", "http://localhost:8000")

async def trigger_outbound_call(customer: dict, company: dict) -> dict:
    """
    Triggers an outbound call using Vapi.ai API with dynamic prompting.
    """
    url = "https://api.vapi.ai/call"
    
    headers = {
        "Authorization": f"Bearer {VAPI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Dynamic Prompting: Construct the assistant configuration dynamically
    # based on the company instructions and customer details.
    system_prompt = (
        f"You are an AI assistant calling on behalf of {company['name']}.\n"
        f"You are speaking with {customer['name']}.\n"
        f"{company['instructions']}\n"
        "Your goal is to qualify the lead and collect information. Keep the conversation concise and natural."
    )
    
    # We pass the customer ID so we can match the webhook later
    payload = {
        "phoneNumberId": VAPI_PHONE_NUMBER_ID,
        "customer": {
            "number": customer['phone_number'],
            "name": customer['name']
        },
        "assistant": {
            "model": {
                "provider": "openai",
                "model": "gpt-3.5-turbo",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    }
                ]
            },
            "voice": {
                "provider": "11labs",
                "voiceId": "bIHbv24MWmeRgasZH58o" # generic voice
            },
            "firstMessage": f"Hello {customer['name']}, this is calling from {company['name']}. How are you today?",
            # Important: pass customer id in metadata to be received in webhook
            "metadata": {
                "customer_id": str(customer['_id']),
                "company_id": str(company['_id'])
            }
        }
    }
    
    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload)
        response.raise_for_status()
        return response.json()
