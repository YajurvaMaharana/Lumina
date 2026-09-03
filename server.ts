import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { GoogleGenAI } from "@google/genai";

// Initialize Firebase Admin (Uses ADC by default in Google Cloud)
try {
  initializeApp({
    projectId: "gen-lang-client-0576077491",
  });
} catch (error) {
  console.log("Firebase Admin already initialized.");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for JSON body parsing
  app.use(express.json());

  // Middleware for Authentication
  const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await getAuth().verifyIdToken(idToken);
      (req as any).user = decodedToken;
      next();
    } catch (error) {
      console.error("Auth verification failed:", error);
      res.status(401).json({ error: "Unauthorized" });
    }
  };

  // Gemini API Endpoint
  app.post("/api/journal/chat", authenticateUser, async (req, res) => {
    try {
      const { systemPrompt, message, history } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GEMINI_API_KEY is not configured" });
      }

      const ai = new GoogleGenAI({ apiKey });

      // Fallback model ladder
      const models = [
        "gemini-3.6-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      ];

      let responseText = "";
      let success = false;
      let lastError = null;

      for (const model of models) {
        try {
          const chat = ai.chats.create({
            model: model,
            config: {
              systemInstruction: systemPrompt || "You are a helpful, empathetic journaling assistant.",
              temperature: 0.7,
            },
          });

          // Send history sequentially if any
          if (history && history.length > 0) {
            // Note: with the current SDK, managing history directly is better done by sending the entire conversation as contents,
            // or we just rely on passing the current message.
            // A more robust way with @google/genai for single-turn with context is just a simple content array.
          }
          
          const result = await ai.models.generateContent({
            model: model,
            contents: [
              ...(history || []).map((msg: any) => ({
                role: msg.role === 'model' ? 'model' : 'user',
                parts: [{ text: msg.content }]
              })),
              { role: 'user', parts: [{ text: message }] }
            ],
            config: {
               systemInstruction: systemPrompt || "You are a helpful, empathetic journaling assistant.",
            }
          });

          responseText = result.text || "";
          success = true;
          break; // Stop falling back if successful
        } catch (error: any) {
          lastError = error;
          console.warn(`Model ${model} failed, attempting next...`);
        }
      }

      if (!success) {
        console.error("All Gemini models failed:", lastError);
        return res.status(500).json({ error: "Failed to generate AI response." });
      }

      res.json({ text: responseText });
    } catch (error) {
      console.error("Chat error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    // Support React Router HTML5 History API fallback
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
