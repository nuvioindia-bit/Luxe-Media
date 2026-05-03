import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    // Try Vite env first (Vercel client side), then process.env (AI Studio environment)
    const apiKey = import.meta.env?.VITE_GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : null);
    
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined. AI features will be limited.");
      return null;
    }
    genAI = new GoogleGenAI({ apiKey });
  }
  return genAI;
}

export async function askAIPilot(prompt: string, context?: any) {
  const model = "gemini-1.5-flash";
  
  const systemInstruction = `You are "Rexo Tool", a highly intelligent assistant for an influencer marketing platform called Rexocollab.
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
    const ai = getAI();
    if (!ai) return "I need an API Key to function correctly on your custom deployment. Please set VITE_GEMINI_API_KEY in your environment.";
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "I was unable to generate a response.";
  } catch (error) {
    console.error("AI Pilot Error:", error);
    return "I encountered an error while processing your request. Please try again later. Make sure the GEMINI_API_KEY is configured correctly.";
  }
}

export async function* streamAIPilot(prompt: string, context?: any) {
    const model = "gemini-1.5-flash";
    
    const systemInstruction = `You are "Rexo Tool", a highly intelligent assistant for an influencer marketing platform called Rexocollab.
    Your goal is to help both Creators and Brands succeed.
    
    CONTEXT FOR THIS SESSION:
    ${context ? JSON.stringify(context) : 'No specific context provided.'}
    
    Keep responses concise, professional, and actionable. Use markdown for better readability.`;

    try {
        const ai = getAI();
        if (!ai) {
            yield "API Key is missing. Please configure VITE_GEMINI_API_KEY for Vercel deployment.";
            return;
        }
        
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
        yield "An error occurred during streaming. Please verify API key.";
    }
}
