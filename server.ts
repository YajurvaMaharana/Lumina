import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Firestore } from "@google-cloud/firestore";
import cron from "node-cron";
import { GoogleGenAI, Type } from "@google/genai";

// We use @google-cloud/firestore directly to specify the databaseId easily
const db = new Firestore({
  projectId: "gen-lang-client-0576077491",
  databaseId: "ai-studio-7c3fd21d-d7a4-4494-b572-5a5a5902d114"
});

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

  // Geocoding API Endpoint
  app.post("/api/geocode", authenticateUser, async (req, res) => {
    try {
      const { lat, lng } = req.body;
      if (!lat || !lng) {
        return res.status(400).json({ error: "Missing coordinates" });
      }

      const apiKey = process.env.GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: "GOOGLE_MAPS_API_KEY is not configured" });
      }

      // We use the Geocoding REST API directly as there is no modern server-side SDK for Reverse Geocoding yet.
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.status !== "OK" || !data.results || data.results.length === 0) {
        console.error("Geocoding failed:", data.status, data.error_message);
        return res.status(400).json({ error: "Failed to reverse geocode" });
      }

      // Get a readable string like neighborhood or city
      let locationString = data.results[0].formatted_address;
      // Try to find a more specific locality/neighborhood component if possible
      const localityComponent = data.results[0].address_components.find((c: any) => c.types.includes("neighborhood") || c.types.includes("locality"));
      if (localityComponent) {
        locationString = localityComponent.long_name;
      }

      res.json({ location: locationString });
    } catch (error) {
      console.error("Geocoding error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

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
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-latest"
      ];

      let responseText = "";
      let success = false;
      let lastError = null;

      for (const model of models) {
        let retries = 3;
        let delay = 1000;
        let modelSuccess = false;

        for (let i = 0; i < retries; i++) {
          try {
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
                 temperature: 0.7,
              }
            });

            responseText = result.text || "";
            modelSuccess = true;
            break; // Break retry loop
          } catch (error: any) {
            lastError = error;
            
            if (i === retries - 1) {
              console.error(`Model ${model} failed after ${retries} attempts:`, error.message || error);
            } else {
              console.log(`Model ${model} failed (Attempt ${i + 1}/${retries}), retrying...`);
              await new Promise(resolve => setTimeout(resolve, delay));
              delay *= 2;
            }
          }
        }

        if (modelSuccess) {
          success = true;
          break; // Stop falling back to other models
        }
      }

      if (!success) {
        console.error("All Gemini models failed:", lastError);
        return res.status(500).json({ error: "Failed to generate AI response." });
      }

      res.json({ text: responseText });

      // --- Background Behavioral Guardrail (runs asynchronously so as not to block the UI) ---
      (async () => {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
          const webhookUrl = process.env.WEBHOOK_URL;
          
          if (!webhookUrl) {
            console.log("WEBHOOK_URL not configured. Skipping behavioral guardrail.");
            return;
          }

          let classificationResponse;
          let retries = 3;
          let delay = 1000;
          let success = false;

          for (let i = 0; i < retries; i++) {
            try {
              classificationResponse = await ai.models.generateContent({
                model: "gemini-3.8-flash",
                contents: `Analyze the following journal entry for highly emotional decision-making, cognitive biases, or sudden FOMO (e.g., regarding financial decisions, crypto like BTC/USD, etc.).
                Entry: "${message}"`,
                config: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                      isFlagged: {
                        type: Type.BOOLEAN,
                        description: "True if the entry indicates highly emotional decision-making or sudden FOMO."
                      },
                      biasType: {
                        type: Type.STRING,
                        description: "A short label for the detected bias (e.g., 'FOMO', 'Loss Aversion', 'Emotional Trading'). Empty if none."
                      },
                      summary: {
                        type: Type.STRING,
                        description: "A 1-2 sentence explanation of the detected bias."
                      }
                    },
                    required: ["isFlagged", "biasType", "summary"]
                  }
                }
              });
              success = true;
              break;
            } catch (err: any) {
              if (i < retries - 1) {
                console.log(`Guardrail API call failed (Attempt ${i + 1}/${retries}), retrying...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
              } else {
                console.error(`Guardrail API call failed after ${retries} attempts:`, err.message);
                throw err;
              }
            }
          }

          if (!success || !classificationResponse) {
             return;
          }

          const jsonText = classificationResponse.text?.trim();
          if (jsonText) {
            const result = JSON.parse(jsonText);
            if (result.isFlagged) {
              console.log("Behavioral bias detected. Sending webhook alert...", result);
              
              // Send structured JSON alert to Discord/Slack
              try {
                const webhookRes = await fetch(webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    content: `🚨 **Behavioral Guardrail Alert** 🚨`,
                    embeds: [
                      {
                        title: `Bias Detected: ${result.biasType}`,
                        description: result.summary,
                        color: 16711680 // Red color
                      }
                    ]
                  })
                });
                console.log(`Webhook sent, status: ${webhookRes.status}`);
              } catch (webhookError) {
                console.error("Error sending webhook alert:", webhookError);
              }
            }
          }
        } catch (guardrailError) {
          console.error("Error running behavioral guardrail:", guardrailError);
        }
      })();
      
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

  // Admin Cron Job: Global Sentiment Analysis (runs daily at 2 AM)
  cron.schedule("0 2 * * *", async () => {
    console.log("Running Global Sentiment Analysis cron job...");
    try {
      // We query all journals across all users using a collectionGroup query
      const journalsSnapshot = await db.collectionGroup("journals").get();
      
      if (journalsSnapshot.empty) {
        console.log("No journals found for analysis.");
        return;
      }

      const entries = journalsSnapshot.docs.map(doc => {
        const data = doc.data();
        if (data.encryptedPayload) return "";
        return data.summary || data.title || "";
      }).filter(text => text.trim() !== "");

      // Limit payload size to avoid blowing up the prompt context unnecessarily for this MVP
      const combinedText = entries.join("\n").substring(0, 30000);

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.error("GEMINI_API_KEY is missing. Cannot run sentiment analysis.");
        return;
      }

      const ai = new GoogleGenAI({ apiKey });
      let result;
      let retries = 3;
      let delay = 1000;
      let success = false;

      for (let i = 0; i < retries; i++) {
        try {
          result = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: `Analyze the overall emotional sentiment and key themes of the following platform journal entries. 
            CRITICAL SECURITY INSTRUCTION: You MUST strictly strip and ignore any Personally Identifiable Information (PII), names, locations, or specific sensitive details. Do NOT include user-specific information in the summary.
            Provide a generalized, high-level summary of the overall platform mood, emerging themes, and general reflections.
            
            Entries:
            ${combinedText}`,
          });
          success = true;
          break;
        } catch (err: any) {
          if (i < retries - 1) {
             console.log(`Sentiment cron job API call failed (Attempt ${i + 1}/${retries}), retrying...`);
             await new Promise(resolve => setTimeout(resolve, delay));
             delay *= 2;
          } else {
             console.error(`Sentiment cron job API call failed after ${retries} attempts:`, err.message);
             throw err;
          }
        }
      }

      if (!success || !result) {
        throw new Error("All sentiment cron job API calls failed.");
      }

      const analysisText = result.text;
      if (analysisText) {
        await db.collection("global_analytics").add({
          timestamp: Date.now(),
          analysis: analysisText,
          entryCount: entries.length
        });
        console.log("Global Sentiment Analysis saved successfully to global_analytics collection.");
      }
    } catch (error) {
      console.error("Error running sentiment cron job:", error);
    }
  });

  app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Send a test payload to the webhook upon app load
    try {
      const testWebhookUrl = process.env.WEBHOOK_URL;
      if (testWebhookUrl) {
        console.log(`Sending startup test webhook...`);
        const testRes = await fetch(testWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: "✅ **Lumina Backend Started** ✅",
            embeds: [
              {
                title: "System Online",
                description: "The behavioral guardrail integration has been successfully initialized and connected.",
                color: 3066993 // Green color
              }
            ]
          })
        });
        console.log(`Startup test webhook sent, status: ${testRes.status}`);
      }
    } catch (err) {
      console.error("Failed to send startup test webhook:", err);
    }
  });
}

startServer();
