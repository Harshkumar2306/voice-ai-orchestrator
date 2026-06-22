#!/bin/bash
set -e

# Configuration
PROJECT_ID=$(gcloud config get-value project)
SERVICE_NAME="voice-ai-orchestrator"
REGION="us-central1"

echo "Deploying to Google Cloud Run..."
echo "Project: $PROJECT_ID"
echo "Service: $SERVICE_NAME"
echo "Region: $REGION"

# Make sure we have a project ID
if [ -z "$PROJECT_ID" ]; then
    echo "Error: No GCP project ID found. Run 'gcloud config set project YOUR_PROJECT_ID' first."
    exit 1
fi

# Enable required APIs
echo "Enabling Cloud Run and Cloud Build APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com

# Deploy
echo "Building and deploying..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --allow-unauthenticated \
    --set-env-vars "DB_NAME=krid_ai_db" \
    --update-secrets="MONGODB_URI=mongodb-uri:latest,VAPI_API_KEY=vapi-api-key:latest,VAPI_PHONE_NUMBER_ID=vapi-phone-id:latest,OPENAI_API_KEY=openai-api-key:latest"

echo "Deployment complete!"
