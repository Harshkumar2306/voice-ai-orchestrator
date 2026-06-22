# 🚀 Multi-Tenant Agentic Voice Orchestrator

An end-to-end cloud-native SaaS for real estate agencies (and other tenants) to automate outbound lead qualification using AI voice agents. 

Built using **FastAPI, LangGraph, MongoDB, Vapi AI, and React + Tailwind CSS**.

---

## 🌟 Features & Architecture

### 1. Multi-Tenant Architecture
- Supports multiple tenants (e.g., *Dream Homes Realty*, *City Rentals LLC*) from a single database.
- Each tenant has custom AI prompt instructions and isolated lead pools.
- **MongoDB** is used for persistent storage of Companies, Customers (Leads), and Call Logs.

### 2. Vapi.ai Outbound Calling & Dynamic Prompting
- Automatically initiates outbound calls through the Vapi REST API.
- **Bonus Achieved (Dynamic Prompting):** The backend dynamically constructs the AI assistant's system prompt right before dialing, securely injecting the tenant's exact instructions and the lead's name. No hard-coded prompts required in the Vapi dashboard!

### 3. Agentic Logic via LangGraph
Our orchestration brain is built using **LangGraph**:
- **Evaluation Node:** When Vapi sends a webhook at the end of the call, this node passes the call transcript and summary to an OpenAI LLM (`gpt-4o-mini`).
- It extracts the exact intent of the customer using *structured output*.
- **Bonus Achieved (Human-in-the-loop):** If the LLM is confused or the call is ambiguous, it returns a `NEEDS_REVIEW` status rather than blindly categorizing it.
- **State Update Node:** Automatically commits the final status (`QUALIFIED`, `NOT_INTERESTED`, `NEEDS_REVIEW`) to MongoDB.

### 4. Ultra-Premium React Dashboard
- Built with React, Vite, Tailwind CSS v4, and Lucide Icons.
- Features **Glassmorphism design**, beautiful gradient backgrounds, and micro-animations to give it a premium, native-app feel.
- Allows admins to filter leads, switch tenants, and launch outbound campaigns with a single click.

### 5. Cloud-Native Deployment
- Provides a **Multi-Stage Dockerfile** that builds the Vite frontend, installs Python dependencies, and serves both via FastAPI in a single lightweight container.
- Contains an infrastructure-as-code script (`deploy.sh`) for rapid Google Cloud Run deployment.

---

## 🛠️ Local Setup & Testing

### 1. Set Up Environment Variables
Copy the provided `.env.example` file to a new file named `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your secure credentials:
- `VAPI_API_KEY`: Your private Vapi.ai API Key.
- `VAPI_PHONE_NUMBER_ID`: The ID of your configured Vapi outbound phone number.
- `OPENAI_API_KEY`: Your OpenAI API key for LangGraph evaluation.

### 2. Run Locally via Docker Compose
Ensure you have Docker installed on your system.
```bash
docker-compose up --build
```
This single command will:
1. Spin up a local MongoDB instance.
2. Build the multi-stage backend container.
3. Seed the database with mock tenants and leads automatically!
4. Expose the API and UI on `http://localhost:8000`.

### 3. Testing the Workflow
1. Open `http://localhost:8000` in your browser.
2. Select a tenant from the dropdown.
3. Click **"Launch Campaign"**.
4. The backend will trigger Vapi AI, which will dial the mock phone numbers. *(If you want to receive the call yourself, update the seeded phone numbers in `backend/database.py` to your actual phone number before running docker-compose).*
5. Answer the call and converse.
6. Once you hang up, Vapi will hit the local webhook endpoint (make sure to expose `localhost:8000` via ngrok and update the Vapi webhook URL in your dashboard if testing webhooks locally).
7. LangGraph will evaluate the transcript and the UI will update the status badge dynamically!

---

## ☁️ Split Cloud Deployment (Render + Vercel)

For maximum flexibility, the architecture is decoupled so the backend runs on Render and the frontend runs on Vercel. 

### 1. Backend Deployment (Render)
1. Push this repository to your GitHub account.
2. Go to **[Render](https://render.com/)** and create a new **Web Service**.
3. Connect your repository.
4. Set the Root Directory to `/` (the root).
5. Ensure the Environment is set to **Docker** (Render will automatically detect the `Dockerfile`).
6. Add the following Environment Variables in the Render dashboard:
   - `MONGODB_URI`
   - `OPENAI_API_KEY` (or `GROQ_API_KEY`)
   - `VAPI_API_KEY`
   - `VAPI_PHONE_NUMBER_ID`
7. Click **Deploy**. Render will build and host your Python FastAPI backend! Copy the backend URL (e.g., `https://your-backend.onrender.com`).

### 2. Frontend Deployment (Vercel)
1. Go to **[Vercel](https://vercel.com/)** and click **Add New Project**.
2. Connect your GitHub repository.
3. In the project setup:
   - Set the **Root Directory** to `frontend`.
   - Vercel will automatically detect that it's a Vite + React project.
4. Expand the **Environment Variables** section and add:
   - Name: `VITE_API_URL`
   - Value: `https://your-backend.onrender.com/api` (Replace with the URL you got from Render).
5. Click **Deploy**!

That's it! Your blazing fast UI will be globally distributed by Vercel, and your AI Orchestrator will be securely running on Render.
