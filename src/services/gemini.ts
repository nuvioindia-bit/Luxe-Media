import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function askAIPilot(prompt: string, context?: any) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `You are "Rexo AI", a highly intelligent assistant for an influencer marketing platform called Rexocollab.
  Your goal is to help both Creators and Brands succeed.
  
  CONTEXT FOR THIS SESSION:
  ${context ? JSON.stringify(context) : 'No specific context provided.'}
  
  For CREATORS, you help with:
  - Improving campaign applications.
  - Suggesting content ideas for campaigns.
  - Analyzing their profile performance.
  
  For BRANDS, you help with:
  - Creating better campaign briefs.
  - Suggesting types of influencers to target.
  - Analyzing campaign performance.
  
  Keep responses concise, professional, and actionable. Use markdown for better readability.
  If the user asks something irrelevant to influencer marketing, politely steer them back to Rexocollab topics.`;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text;
  } catch (error) {
    console.error("AI Pilot Error:", error);
    return "I encountered an error while processing your request. Please try again later.";
  }
}

export async function* streamAIPilot(prompt: string, context?: any) {
    const model = "gemini-3-flash-preview";
    
    const systemInstruction = `You are "Rexo AI", a highly intelligent assistant for an influencer marketing platform called Rexocollab.
    Your goal is to help both Creators and Brands succeed.
    
    CONTEXT FOR THIS SESSION:
    ${context ? JSON.stringify(context) : 'No specific context provided.'}
    
    Keep responses concise, professional, and actionable. Use markdown for better readability.`;

    try {
        const streamResponse = await ai.models.generateContentStream({
            model: model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
            },
        });

        for await (const chunk of streamResponse) {
            yield chunk.text || "";
        }
    } catch (error) {
        console.error("AI Pilot Stream Error:", error);
        yield "An error occurred during streaming.";
    }
}
