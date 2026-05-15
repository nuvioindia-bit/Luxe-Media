export async function askAIPilot(prompt: string, context?: any) {
  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, context }),
    });
    const data = await response.json();
    return data.text || "I was unable to generate a response.";
  } catch (error) {
    console.error("AI Pilot Error:", error);
    return "I encountered an error while processing your request.";
  }
}

// TODO: Implement streaming proxy if needed
export async function* streamAIPilot(prompt: string, context?: any) {
    yield "Streaming is not yet implemented via backend proxy.";
}
