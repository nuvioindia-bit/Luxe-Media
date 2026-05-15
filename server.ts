import express from "express";
import path from "path";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// API endpoints
app.post("/api/ai/ask", async (req, res) => {
  const { prompt, context } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: "GEMINI_API_KEY not configured" });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
      config: {
        systemInstruction: `You are "Rexo Tool", a highly intelligent assistant for an influencer marketing platform called Rexocollab.
        Your goal is to help both Creators and Brands succeed.
        
        CONTEXT FOR THIS SESSION:
        ${context ? JSON.stringify(context) : 'No specific context provided.'}`,
        temperature: 0.7,
      },
    });
    res.json({ text: response.text });
  } catch (error) {
    console.error("AI Proxy Error:", error);
    res.status(500).json({ error: "Failed to process AI request" });
  }
});

// Vite middleware development / static production
if (process.env.NODE_ENV !== "production") {
    import("vite").then(async (vite) => {
        const server = await vite.createServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(server.middlewares);
    });
} else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
    });
}

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
