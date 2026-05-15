import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import pkg from 'agora-token';
// @ts-ignore
const RtcTokenBuilder = pkg.RtcTokenBuilder;
// @ts-ignore
const RtcRole = pkg.RtcRole;
// @ts-ignore
const ChatTokenBuilder = pkg.ChatTokenBuilder;

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Health Check ---
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // --- Agora Token Generation ---
  app.get("/api/agora/token", (req, res) => {
    const channelName = req.query.channelName as string;
    if (!channelName) {
      return res.status(400).json({ error: "channelName is required" });
    }

    const {
      AGORA_APP_ID = "9067bf9edd9c4c29ac4078c1c7d31601",
      AGORA_PRIMARY_CERTIFICATE = "70ce7527ddb74c72843f0d97396135a5"
    } = process.env;

    const uid = 0; // 0 means dynamic uid assignment by Agora
    const role = RtcRole.PUBLISHER;
    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    try {
      const token = RtcTokenBuilder.buildTokenWithUid(
        AGORA_APP_ID,
        AGORA_PRIMARY_CERTIFICATE,
        channelName,
        uid,
        role,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
      res.json({ token, appId: AGORA_APP_ID });
    } catch (error) {
      console.error("Agora Token Generation Error:", error);
      res.status(500).json({ error: "Failed to generate token" });
    }
  });

  // --- Agora Chat Token Generation ---
  app.get("/api/agora/chat-token", (req, res) => {
    const userId = req.query.userId as string;
    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const {
      AGORA_APP_ID = "9067bf9edd9c4c29ac4078c1c7d31601",
      AGORA_PRIMARY_CERTIFICATE = "70ce7527ddb74c72843f0d97396135a5",
      AGORA_APP_KEY = "711200504#1446700"
    } = process.env;

    const expirationTimeInSeconds = 3600 * 24; // 24 hours
    
    try {
      if (ChatTokenBuilder) {
        const token = ChatTokenBuilder.buildUserToken(
          AGORA_APP_ID,
          AGORA_PRIMARY_CERTIFICATE,
          userId,
          expirationTimeInSeconds
        );
        res.json({ token, appId: AGORA_APP_ID, appKey: AGORA_APP_KEY });
      } else {
        res.status(500).json({ error: "ChatTokenBuilder not found in package" });
      }
    } catch (error) {
      console.error("Agora Chat Token Error:", error);
      res.status(500).json({ error: "Failed to generate chat token" });
    }
  });

  // --- Meta API Proxies ---
  app.get("/api/meta/facebook/page", async (req, res) => {
    const { 
      FB_PAGE_ID = "1087056644498361", 
      FB_PAGE_ACCESS_TOKEN = "EAAMzG3sgp2IBRZAWedp9Xn8KlAvZBEphouTYrENP4ZARyqGu5kQylrcaBwzbrGR57dAlsDes5K6Djh7Uxkr3lm16rkyQ4lrFZAbc3GlKMzlOFvDBJamDZBjgGQM1mdls2NHhikkJKbVdInMnomfJERPqFSWUGXT4dblzZCkRvPc635ff5ZBbrhnvUL92SmMSx7MhxINjOzJlSt54uEcGbW7ofct",
      META_API_VERSION = "v21.0"
    } = process.env;

    try {
      const response = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/${FB_PAGE_ID}`, {
        params: {
          fields: "name,about,fan_count,followers_count,category,picture",
          access_token: FB_PAGE_ACCESS_TOKEN
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("FB API Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch Facebook Page info" });
    }
  });

  app.get("/api/meta/instagram/profile", async (req, res) => {
    const { 
      IG_USER_ID = "17841432601102704", 
      IG_ACCESS_TOKEN = "EAAMzG3sgp2IBRWySWpFQgL6yFzZBZBgkumLxyonXGRGD8tDzGLMoxxCYSe4zxRVd6JGt1TFxj6E9XFWZCvLa7BkLT45MSoKc3BJcfJkMYT8JZB7nqQQhtY4xcY3sjdqh0qU03GGfg3BzlDbu8sLcvY58yTzWKIfb0sgY8UKBummuRNV7ooVZCRG4N6d5ipqWlFF9ZAUTRpdv3pAPtf",
      META_API_VERSION = "v21.0"
    } = process.env;

    try {
      const response = await axios.get(`https://graph.facebook.com/${META_API_VERSION}/${IG_USER_ID}`, {
        params: {
          fields: "username,name,biography,followers_count,follows_count,media_count,profile_picture_url",
          access_token: IG_ACCESS_TOKEN
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("IG API Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch Instagram profile" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
