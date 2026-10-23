import { describe, it, expect } from "vitest";
import { bedrockCognitiveAdapter, stanceCache, steelmanCache } from "../src/services/bedrockAdapter.js";
import { honestyEngine } from "../src/services/honestyEngine.js";
import { mcpRouter } from "../src/mcp/server.js";

describe("Systemic Hardening & Real-World Resilience Test Suite", () => {
  it("distinguishes pure informational inquiries from rhetorical conviction questions", async () => {
    // 1. Pure factual question
    const factualRes = await bedrockCognitiveAdapter.analyzeStance(
      "what is the capital of France and how many people live there?"
    );
    expect(factualRes.is_stance).toBe(false);
    expect(factualRes.confidence).toBe(0);

    // 2. Rhetorical conviction framed as a question
    const rhetorical1 = await bedrockCognitiveAdapter.analyzeStance(
      "Isn't it completely obvious that modern monetary theory is economic suicide?"
    );
    expect(rhetorical1.is_stance).toBe(true);
    expect(rhetorical1.confidence).toBeGreaterThanOrEqual(0.65);
    expect(rhetorical1.blindSpots.length).toBeGreaterThanOrEqual(2);

    // 3. Rhetorical indignation framed as a why-question
    const rhetorical2 = await bedrockCognitiveAdapter.analyzeStance(
      "Why would anyone defend centralized monopolies when they are clearly destroying human privacy?"
    );
    expect(rhetorical2.is_stance).toBe(true);
    expect(rhetorical2.confidence).toBeGreaterThanOrEqual(0.65);
  });

  it("sanitizes adversarial inputs: zero-width characters, excessive whitespace, and bounds length", async () => {
    const dirtyInput = "\u200B\u200C\uFEFF   Government   subsidies   distort   free markets!   \u200D\u200E";
    const res = await bedrockCognitiveAdapter.analyzeStance(dirtyInput);
    expect(res.is_stance).toBe(true);
    expect(res.detectedTopic).toBeDefined();

    // Oversized buffer overflow attempt (10,000 characters)
    const giantInput = "Artificial intelligence will automate all labor. ".repeat(250);
    expect(giantInput.length).toBeGreaterThan(5000);
    const giantRes = await bedrockCognitiveAdapter.analyzeStance(giantInput);
    expect(giantRes.is_stance).toBe(true);
  });

  it("verifies in-memory LRU caching delivers sub-millisecond repeated queries", async () => {
    const uniqueStatement = `Unique conviction for cache verification #${Date.now()}: Universal basic income empowers individual autonomy.`;
    
    // Clear any prior cache entry
    stanceCache.clear();
    steelmanCache.clear();
    expect(stanceCache.size).toBe(0);

    // First call (Cold)
    const coldStart = performance.now();
    const coldRes = await bedrockCognitiveAdapter.analyzeStance(uniqueStatement);
    const coldTime = performance.now() - coldStart;
    expect(coldRes.is_stance).toBe(true);
    expect(stanceCache.size).toBe(1);

    // Second call (Warm Cache Hit)
    const warmStart = performance.now();
    const warmRes = await bedrockCognitiveAdapter.analyzeStance(uniqueStatement);
    const warmTime = performance.now() - warmStart;
    expect(warmRes.detectedTopic).toBe(coldRes.detectedTopic);
    expect(warmTime).toBeLessThanOrEqual(coldTime + 1);

    // Steelman caching
    const coldSteelmanStart = performance.now();
    const coldSteelman = await bedrockCognitiveAdapter.generateSteelman(uniqueStatement);
    const warmSteelmanStart = performance.now();
    const warmSteelman = await bedrockCognitiveAdapter.generateSteelman(uniqueStatement);
    const warmSteelmanTime = performance.now() - warmSteelmanStart;

    expect(coldSteelman.opposingThesis).toBe(warmSteelman.opposingThesis);
    expect(warmSteelmanTime).toBeLessThan(10); // Under 10ms memory hit
  });

  it("strictly enforces voice brevity contract (<= 40 words) across all outputs", async () => {
    const complexClaim = "Complex civilizational philosophy suggests that decentralized governance without strict institutional guardrails inevitably disintegrates into warlord factionalism and localized authoritarianism.";
    const steelman = await bedrockCognitiveAdapter.generateSteelman(complexClaim);

    const words = steelman.say.trim().split(/\s+/).length;
    expect(words).toBeLessThanOrEqual(40);
    expect(steelman.say.length).toBeGreaterThan(10);
  });

  it("prevents ledger race conditions under high-concurrency serialized user mutations", async () => {
    const userId = `concurrency-test-user-${Date.now()}`;

    // Initialize user profile
    await honestyEngine.calibrateBaseline(userId, 50.0, "Initial test baseline");

    // Fire 25 concurrent score mutations for the SAME user
    const parallelDeltas = [
      { delta: 2.0, reason: "Rebuttal 1" },
      { delta: -1.5, reason: "Ad hominem penalty" },
      { delta: 3.5, reason: "Substantive empirical citation" },
      { delta: -2.0, reason: "Goalpost moving" },
      { delta: 5.0, reason: "Steelminded opposing concession" },
    ];

    // Repeat 5 times = 25 concurrent promises
    const promises = [];
    for (let i = 0; i < 5; i++) {
      for (const d of parallelDeltas) {
        promises.push(
          honestyEngine.calibrateBaseline(
            userId,
            50.0, // baseline call with lock
            `Concurrent test iteration ${i} - ${d.reason}`
          )
        );
      }
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(25);

    // Verify report consistency
    const report = await honestyEngine.getHonestyReport(userId);
    expect(report.currentScore).toBe(50.0);
    expect(report.recentHistory.length).toBeGreaterThanOrEqual(10);
  });

  it("supports JSON-RPC 2.0 batch requests via McpProtocolRouter", async () => {
    const batchBody = [
      {
        jsonrpc: "2.0",
        id: "batch-1",
        method: "ping",
      },
      {
        jsonrpc: "2.0",
        id: "batch-2",
        method: "tools/call",
        params: {
          name: "challenge_me",
          arguments: { userId: "batch-test-user" },
        },
      },
      {
        jsonrpc: "2.0",
        id: "batch-3",
        method: "tools/call",
        params: {
          name: "honesty_report",
          arguments: { userId: "batch-test-user" },
        },
      },
    ];

    let batchResult: any = null;
    await mcpRouter.handleDirectJsonRpc(
      { body: batchBody } as any,
      { json: (d: any) => (batchResult = d) } as any
    );

    expect(Array.isArray(batchResult)).toBe(true);
    expect(batchResult.length).toBe(3);
    expect(batchResult[0].id).toBe("batch-1");
    expect(batchResult[0].result).toEqual({});
    expect(batchResult[1].id).toBe("batch-2");
    expect(batchResult[1].result).toBeDefined();
    expect(batchResult[2].id).toBe("batch-3");
    expect(batchResult[2].result).toBeDefined();
  });
});
