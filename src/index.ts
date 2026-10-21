import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mcpRouter } from "./mcp/server.js";
import { cognitiveAdapter } from "./services/bedrockAdapter.js";
import { sessionStore } from "./services/sessionStore.js";
import { honestyEngine } from "./services/honestyEngine.js";
import { BENCHMARK_DATASET, runBenchmarkEvaluation } from "./ml/evaluation.js";
import { handleAlexaRequest } from "./alexa/adapter.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || "0.0.0.0";

app.use(cors());
app.use(express.json());

// Serve simulator static assets
const simulatorPath = path.resolve(process.cwd(), "simulator");
app.use("/simulator", express.static(simulatorPath));
app.use("/static", express.static(simulatorPath));
app.use(express.static(simulatorPath));

app.get("/", (_req, res) => {
  res.redirect("/simulator");
});

app.get(["/simulator", "/simulator/*"], (_req, res) => {
  res.sendFile(path.join(simulatorPath, "index.html"));
});

// Health & Status endpoint
app.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    server: "Echo Chamber Breaker MCP Server",
    version: "1.0.0",
    mode: cognitiveAdapter.getMode(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/status", async (_req, res) => {
  const profile = await sessionStore.getProfile("default-user");
  res.json({
    name: "Echo Chamber Breaker",
    description: "Self-hosted MCP server for intellectual honesty and anti-sycophancy",
    protocol: "Model Context Protocol (Streamable HTTP)",
    llmMode: cognitiveAdapter.getMode(),
    port: PORT,
    endpoints: {
      directMcp: "POST /mcp",
      sseStream: "GET /sse or GET /mcp",
      sseMessages: "POST /mcp/messages?sessionId=<id>",
      webSimulator: "GET /simulator",
    },
    defaultUserProfile: {
      userId: profile.userId,
      currentScore: profile.currentScore,
      totalChallenges: profile.totalChallenges,
    },
  });
});

// Run ML Benchmark & Calibration endpoint
app.get("/api/benchmark", async (_req, res) => {
  try {
    const predictions = [];
    for (const bCase of BENCHMARK_DATASET) {
      const stance = await cognitiveAdapter.analyzeStance(bCase.statement);
      const steelman = await cognitiveAdapter.generateSteelman(bCase.statement, stance);
      predictions.push({
        caseId: bCase.id,
        predictedPolarity: stance.polarity,
        predictedConfidence: stance.confidence,
        steelman,
      });
    }

    const summary = runBenchmarkEvaluation(predictions);
    res.json({
      success: true,
      mode: cognitiveAdapter.getMode(),
      summary,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// MCP Protocol Routes
// 1. Direct JSON-RPC HTTP POST /mcp
app.post("/mcp", async (req, res) => {
  await mcpRouter.handleDirectJsonRpc(req, res);
});

// 2. Streamable HTTP SSE Streams: GET /sse or GET /mcp
app.get(["/sse", "/mcp"], async (req, res) => {
  // If client specifically requests text/event-stream or GET request
  await mcpRouter.handleSse(req, res, "/mcp/messages");
});

// 3. SSE session message ingestion endpoint
app.post("/mcp/messages", async (req, res) => {
  await mcpRouter.handleSseMessage(req, res);
});

// Alexa Custom Skill HTTPS Endpoint
app.post("/alexa", async (req, res) => {
  try {
    const alexaResponse = await handleAlexaRequest(req.body);
    res.json(alexaResponse);
  } catch (err: any) {
    console.error("[Alexa Adapter Error]", err);
    res.status(500).json({ error: err?.message || "Internal error in Alexa adapter" });
  }
});

// Root serves simulator index.html directly
app.get("/", (_req, res) => {
  res.sendFile(path.join(simulatorPath, "index.html"));
});

const server = app.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Echo Chamber Breaker MCP Server Running`);
  console.log(`======================================================`);
  console.log(`📡 Streamable HTTP MCP Endpoint: http://${HOST}:${PORT}/mcp`);
  console.log(`⚡ SSE Transport Stream:        http://${HOST}:${PORT}/sse`);
  console.log(`🎯 Real MCP Web Simulator:     http://localhost:${PORT}/simulator`);
  console.log(`🧠 Reasoning Mode:              ${cognitiveAdapter.getMode().toUpperCase()}`);
  console.log(`📊 ML Calibration Benchmark:    http://localhost:${PORT}/api/benchmark`);
  console.log(`======================================================\n`);
});

process.on("SIGTERM", () => {
  console.log("SIGTERM received, closing server...");
  server.close(() => process.exit(0));
});

process.on("SIGINT", () => {
  console.log("SIGINT received, closing server...");
  server.close(() => process.exit(0));
});

export { app, server };
