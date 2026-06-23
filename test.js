const assistant = {
  model: { provider: "openai" },
  serverUrl: "https://voice-ai-orchestrator.onrender.com/api/webhooks/vapi",
  serverMessages: ["end-of-call-report", "status-update"],
  metadata: {
    customer_id: "test",
  }
};
console.log(assistant);
