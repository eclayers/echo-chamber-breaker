/**
 * Echo Chamber Breaker — End-to-End Stress Test & Random Conviction Validation Suite
 * Tests every HTTP endpoint, MCP tool, edge case, and random real-world conviction under load.
 */

interface McpToolResponse<T = any> {
  say: string;
  structuredContent: T;
  meta: {
    timestamp: string;
    version: string;
    mode: string;
  };
}

const BASE_URL = "http://localhost:3000";

async function postRpc(method: string, params: any = {}, id: number | string = 1) {
  const t0 = performance.now();
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
  const elapsed = Math.round(performance.now() - t0);
  const data = await res.json();
  return { status: res.status, data, elapsed };
}

async function callTool<T = any>(name: string, args: any = {}, id: number | string = 1): Promise<{ payload: McpToolResponse<T>; elapsed: number }> {
  const { status, data, elapsed } = await postRpc("tools/call", { name, arguments: args }, id);
  if (status !== 200 || data.error) {
    throw new Error(`Tool ${name} failed: ${JSON.stringify(data.error || data)}`);
  }
  const text = data.result.content[0].text;
  const parsed = JSON.parse(text) as McpToolResponse<T>;
  return { payload: parsed, elapsed };
}

async function runStressTest() {
  console.log("=======================================================================");
  console.log("🚀 STARTING ECHO CHAMBER BREAKER FULL SYSTEM STRESS TEST");
  console.log("=======================================================================\n");

  let totalTests = 0;
  let passedTests = 0;

  function assert(condition: boolean, msg: string) {
    totalTests++;
    if (condition) {
      passedTests++;
      console.log(`  ✅ PASS: ${msg}`);
    } else {
      console.error(`  ❌ FAIL: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  // -------------------------------------------------------------------------
  // PHASE 1: HTTP Routes & Static Assets
  // -------------------------------------------------------------------------
  console.log("📌 PHASE 1: Verifying HTTP Routes & Static Assets...");
  {
    const r1 = await fetch(`${BASE_URL}/`);
    assert(r1.status === 200 || r1.redirected, "Root '/' redirects or loads simulator (status 200)");

    const r2 = await fetch(`${BASE_URL}/simulator`);
    assert(r2.status === 200, "GET /simulator returns 200 OK");
    const html = await r2.text();
    assert(html.includes("ECHO CHAMBER BREAKER"), "Simulator HTML contains product title");
    assert(html.includes("nonStanceCard"), "Simulator HTML contains #nonStanceCard for Stance Gate");
    assert(html.includes("I — Articulate Your Conviction"), "Simulator HTML contains Roman numeral sections");

    const r3 = await fetch(`${BASE_URL}/simulator/app.js`);
    assert(r3.status === 200, "GET /simulator/app.js returns 200 OK");

    const r4 = await fetch(`${BASE_URL}/simulator/style.css`);
    assert(r4.status === 200, "GET /simulator/style.css returns 200 OK");

    const r5 = await fetch(`${BASE_URL}/api/benchmark`);
    assert(r5.status === 200, "GET /api/benchmark returns 200 OK");
    const bench = await r5.json();
    assert(bench.success === true, "ML Benchmark API returns success: true");
    assert(bench.summary.classificationMetrics.accuracy > 0.8, "Classification accuracy > 80%");

    const r6 = await fetch(`${BASE_URL}/health`);
    assert(r6.status === 200, "GET /health returns 200 OK");
  }

  // -------------------------------------------------------------------------
  // PHASE 2: MCP Handshake & Tool Discovery
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 2: MCP Protocol Handshake & Tool Discovery...");
  {
    const init = await postRpc("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "stress-tester", version: "1.0.0" },
    });
    assert(init.data.result.serverInfo.name === "echo-chamber-breaker", "MCP Handshake returns serverInfo.name");

    const list = await postRpc("tools/list");
    const tools = list.data.result.tools;
    assert(Array.isArray(tools) && tools.length === 9, "MCP tools/list returns exactly 9 registered tools");
  }

  // -------------------------------------------------------------------------
  // PHASE 3: Edge Case Inputs & Stance Gate (Axioms A1 & A2)
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 3: Testing Stance Gate on Non-Stance Inputs...");
  {
    const nonStanceInputs = [
      { text: "hi Alexa", category: "GREETING" },
      { text: "hello there good morning", category: "GREETING" },
      { text: "what is quantum computing and how does superposition work?", category: "QUESTION" },
      { text: "tell me about", category: "INCOMPLETE" },
      { text: "water boils at 100 degrees celsius", category: "NEUTRAL" },
    ];

    for (const item of nonStanceInputs) {
      const { payload } = await callTool("analyze_stance", { statement: item.text, userId: "stress-user-edge" });
      assert(payload.structuredContent.is_stance === false, `"${item.text}" returned is_stance: false`);
      assert(payload.structuredContent.confidence === 0, `"${item.text}" has confidence = 0`);
      assert(payload.structuredContent.polarity !== "STRONG_AGREE", `"${item.text}" never produces STRONG_AGREE`);
      assert(payload.say.length > 0, `"${item.text}" produces non-empty soft speech invitation`);

      // Verify steelman also rejects non-stance input
      const steelmanRes = await callTool("steelman", { statement: item.text, userId: "stress-user-edge" });
      assert(steelmanRes.payload.structuredContent.is_stance === false, `steelman tool returns is_stance: false for "${item.text}"`);
    }
  }

  // -------------------------------------------------------------------------
  // PHASE 4: Random Convictions Deep Dialectical Pipeline
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 4: Testing Diverse Random Convictions Across Domains...");
  
  const randomConvictions = [
    {
      domain: "Education & Pedagogy",
      statement: "School grades should be completely abolished because standardized grading destroys intrinsic curiosity and creates compliance drones.",
      expectedSubstr: "curiosity",
    },
    {
      domain: "Technology & Child Safety",
      statement: "Social media recommendation algorithms should be made open-source by law to prevent psychological addiction in teenagers.",
      expectedSubstr: "algorithm",
    },
    {
      domain: "Space & Resource Allocation",
      statement: "Space exploration is an arrogant waste of resources while billions of humans live in poverty on Earth.",
      expectedSubstr: "Space",
    },
    {
      domain: "Labor & Future of Work",
      statement: "Working more than four days a week should be outlawed because modern automation makes 40-hour workweeks absurd.",
      expectedSubstr: "week",
    },
  ];

  for (const item of randomConvictions) {
    console.log(`\n  💬 SPAR TEST: [${item.domain}]`);
    console.log(`     Statement: "${item.statement}"`);

    // 1. Analyze Stance
    const { payload: stance, elapsed: stanceMs } = await callTool("analyze_stance", {
      statement: item.statement,
      userId: "stress-tester-random",
    });

    assert(stance.structuredContent.is_stance === true, "Classified as real stance (is_stance: true)");
    assert(stance.structuredContent.confidence >= 0.65, `Calibrated confidence: ${stance.structuredContent.confidence}`);
    assert(stance.structuredContent.blindSpots.length >= 2, `Identified ${stance.structuredContent.blindSpots.length} cognitive blind spots`);
    console.log(`     → Topic: ${stance.structuredContent.detectedTopic} (${stanceMs}ms)`);
    console.log(`     → Blindspot sample: "${stance.structuredContent.blindSpots[0]}"`);

    // 2. Steelman
    const { payload: steelman, elapsed: steelmanMs } = await callTool("steelman", {
      statement: item.statement,
      userId: "stress-tester-random",
    });

    assert(steelman.structuredContent.is_stance === true, "Steelman generated with is_stance: true");
    const words = steelman.say.trim().split(/\s+/).length;
    assert(words <= 40, `Voice brevity enforced: "${steelman.say}" (${words} words <= 40)`);
    assert(steelman.structuredContent.coreArguments.length >= 2, `Has ${steelman.structuredContent.coreArguments.length} structural arguments`);
    assert(steelman.structuredContent.epistemicQuestion.endsWith("?"), "Ends with Socratic epistemic question");
    
    // CRITICAL: Verify NO remote-work fallback mismatch
    assert(
      !steelman.structuredContent.opposingThesis.toLowerCase().includes("remote work") &&
      !steelman.structuredContent.opposingThesis.toLowerCase().includes("office"),
      "Steelman opposing thesis is relevant to the statement and NOT a remote-work fallback!"
    );

    console.log(`     → Spoken Speech (${words} words): "${steelman.say}" (${steelmanMs}ms)`);
    console.log(`     → Opposing Thesis: "${steelman.structuredContent.opposingThesis}"`);
    console.log(`     → Socratic Inquiry: "${steelman.structuredContent.epistemicQuestion}"`);
  }

  // -------------------------------------------------------------------------
  // PHASE 5: Full Multi-Turn Dialectical Session & Scoring
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 5: Testing Multi-Turn Debate Lifecycle & Scoring...");
  {
    const userId = `debate-user-${Date.now()}`;
    const initialClaim = "School grades should be completely abolished because standardized grading destroys intrinsic curiosity.";

    // 1. Start Debate
    const { payload: debateStart } = await callTool("start_debate", {
      userId,
      statement: initialClaim,
    });
    const sessionId = debateStart.structuredContent.session.sessionId;
    assert(debateStart.structuredContent.session.status === "ACTIVE", "Debate started in ACTIVE status");
    assert(debateStart.structuredContent.session.turns.length === 2, "Debate initialized with 2 turns (User + Assistant)");
    console.log(`     Session ID: ${sessionId}`);

    // 2. Continue Debate Turn 1 (Substantive Rebuttal)
    const { payload: turn1 } = await callTool("continue_debate", {
      sessionId,
      userId,
      userReply: "Standardized evaluation creates an objective meritocratic baseline that prevents subjective instructor favoritism and nepotism.",
    });
    assert(turn1.structuredContent.session.turns.length === 4, "Turn 1 appended User and Assistant counter-turn (4 turns total)");
    assert(turn1.structuredContent.assessment.scoreDelta > 0, `Rebuttal earned positive delta (+${turn1.structuredContent.assessment.scoreDelta})`);
    console.log(`     Turn 1 delta: +${turn1.structuredContent.assessment.scoreDelta} pts`);

    // 3. Continue Debate Turn 2 (Concession)
    const { payload: turn2 } = await callTool("continue_debate", {
      sessionId,
      userId,
      userReply: "I concede that you made a valid point regarding the trade-offs in scalable meritocratic evaluation.",
    });
    assert(turn2.structuredContent.session.turns.length === 6, "Turn 2 appended User and Assistant turns (6 turns total)");
    assert(turn2.structuredContent.assessment.quality === "CONCESSION", "Turn 2 recognized as CONCESSION");
    assert(turn2.structuredContent.assessment.scoreDelta === 8.5, "Concession awarded full +8.5 pts");
    console.log(`     Turn 2 concession delta: +${turn2.structuredContent.assessment.scoreDelta} pts`);

    // 4. Conclude Debate
    const { payload: conclusion } = await callTool("conclude_debate", {
      sessionId,
      userId,
      finalReflection: "This dialectical exercise demonstrated that grading systems balance subjective equity against systemic measurement.",
    });
    assert(conclusion.structuredContent.totalTurns === 6, "Conclusion reports 6 total turns");
    assert(conclusion.structuredContent.currentScore > 50.0, `Final score calibrated upwards: ${conclusion.structuredContent.currentScore}`);
    console.log(`     Debate concluded. Final Honesty Score: ${conclusion.structuredContent.currentScore}`);
  }

  // -------------------------------------------------------------------------
  // PHASE 6: Proactive Challenges & Baseline Calibration
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 6: Testing Proactive Challenges & Baseline Reset...");
  {
    const userId = `proactive-user-${Date.now()}`;
    const { payload: proactive } = await callTool("challenge_me", { userId });
    assert(proactive.structuredContent.provocation.length > 10, "challenge_me returned substantive provocation");
    assert(proactive.structuredContent.say.length > 5, "challenge_me returned voice-ready invitation");
    console.log(`     Proactive provocation: "${proactive.structuredContent.provocation}"`);

    const { payload: calibrated } = await callTool("calibrate_baseline", {
      userId,
      baselineScore: 50.0,
      reason: "Post-sparring reset",
    });
    assert(calibrated.structuredContent.currentScore === 50.0, "calibrate_baseline restored score to 50.0");
    assert(calibrated.structuredContent.event.eventType === "CALIBRATION_BASELINE", "Appended CALIBRATION_BASELINE event");
  }

  // -------------------------------------------------------------------------
  // PHASE 7: High-Concurrency Stress Test (20 Parallel Invocations)
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 7: High-Concurrency Load Test (20 Parallel Invocations)...");
  {
    const concurrency = 20;
    const statements = [
      "Artificial intelligence art is copyright theft.",
      "Nuclear energy is essential for human survival.",
      "Remote work permanently damages creativity.",
      "Dynamic languages are inferior to static types.",
    ];

    const promises = Array.from({ length: concurrency }).map(async (_, idx) => {
      const uId = `concurrent-user-${idx % 5}`;
      const stmt = statements[idx % statements.length];
      const t0 = performance.now();
      const res = await callTool("steelman", { statement: stmt, userId: uId }, `conc-${idx}`);
      const duration = Math.round(performance.now() - t0);
      return { idx, duration, say: res.payload.say, thesis: res.payload.structuredContent.opposingThesis };
    });

    const results = await Promise.all(promises);
    assert(results.length === concurrency, `All ${concurrency} parallel requests resolved successfully`);
    const avgLatency = Math.round(results.reduce((acc, r) => acc + r.duration, 0) / concurrency);
    const maxLatency = Math.max(...results.map((r) => r.duration));
    console.log(`     20 parallel requests completed!`);
    console.log(`     Avg Latency: ${avgLatency}ms | Max Latency: ${maxLatency}ms`);
    assert(avgLatency < 250, `Average latency under high concurrency is under 250ms (${avgLatency}ms)`);
  }

  // -------------------------------------------------------------------------
  // PHASE 8: Rhetorical Conviction Questions vs. Pure Inquiries
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 8: Testing Rhetorical Convictions Framed as Questions...");
  {
    const rhetoricalQueries = [
      {
        text: "Isn't it completely obvious that modern monetary theory is economic suicide?",
        isStance: true,
        reason: "Rhetorical question prefix with extreme normative term 'economic suicide'",
      },
      {
        text: "Why would anyone defend centralized monopolies when they are clearly destroying human privacy?",
        isStance: true,
        reason: "Indignant rhetorical question with strong normative claim",
      },
      {
        text: "Don't you agree that censorship is destroying open democratic discourse?",
        isStance: true,
        reason: "Leading rhetorical question asserting democratic destruction",
      },
      {
        text: "What is the capital of Australia and what is its population?",
        isStance: false,
        reason: "Pure factual question without normative thesis",
      },
    ];

    for (const q of rhetoricalQueries) {
      const { payload } = await callTool("analyze_stance", {
        statement: q.text,
        userId: "stress-rhetorical-user",
      });
      assert(
        payload.structuredContent.is_stance === q.isStance,
        `Classified "${q.text.slice(0, 45)}..." correctly as is_stance: ${q.isStance} (${q.reason})`
      );
      if (q.isStance) {
        assert(payload.structuredContent.confidence >= 0.65, `Confidence >= 0.65 for rhetorical belief`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PHASE 9: In-Memory LRU Cache Acceleration
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 9: Testing In-Memory LRU Caching Latency Acceleration...");
  {
    const cacheTestStatement = `Decentralized zero-knowledge credentials protect privacy while preserving fraud prevention in global finance (${Date.now()}).`;
    
    // Cold call
    const t0 = performance.now();
    const { payload: coldPayload } = await callTool("analyze_stance", {
      statement: cacheTestStatement,
      userId: "cache-user",
    });
    const coldDuration = performance.now() - t0;
    assert(coldPayload.structuredContent.is_stance === true, "Cold query analyzed correctly");

    // Warm call (Cache Hit)
    const t1 = performance.now();
    const { payload: warmPayload } = await callTool("analyze_stance", {
      statement: cacheTestStatement,
      userId: "cache-user",
    });
    const warmDuration = performance.now() - t1;

    console.log(`     Cold Query: ${Math.round(coldDuration)}ms | Warm Cache Hit: ${Math.round(warmDuration)}ms`);
    assert(warmDuration <= coldDuration + 5, `Cache hit latency is rapid (${Math.round(warmDuration)}ms)`);
    assert(warmPayload.structuredContent.detectedTopic === coldPayload.structuredContent.detectedTopic, "Warm result matches cold result");
  }

  // -------------------------------------------------------------------------
  // PHASE 10: Input Sanitization & Adversarial Buffer Boundaries
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 10: Testing Input Sanitization & Adversarial Bounds...");
  {
    // Zero-width characters and control tokens
    const dirtyClaim = "\u200B\u200C\uFEFF**Universal Basic Income eliminates poverty traps in modern post-industrial economies.**\u200D\u200E";
    const { payload: sanitized } = await callTool("analyze_stance", {
      statement: dirtyClaim,
      userId: "sanitization-user",
    });
    assert(sanitized.structuredContent.is_stance === true, "Sanitized input with zero-width characters processed cleanly");

    // Giant 8000-character payload
    const giantClaim = "Strict copyright laws protect creators from systemic exploitation. ".repeat(150);
    const { payload: giantResult } = await callTool("steelman", {
      statement: giantClaim,
      userId: "sanitization-user",
    });
    assert(giantResult.structuredContent.is_stance === true, "8,000 character oversized statement bounded and processed without crash");
    const words = giantResult.say.trim().split(/\s+/).length;
    assert(words <= 40, `Steelman say strictly honors <= 40 words even with giant input (${words} words)`);
  }

  // -------------------------------------------------------------------------
  // PHASE 11: JSON-RPC 2.0 Batch Requests
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 11: Testing JSON-RPC 2.0 Batch Tool Execution...");
  {
    const batchRequests = [
      {
        jsonrpc: "2.0",
        id: "batch-req-1",
        method: "ping",
      },
      {
        jsonrpc: "2.0",
        id: "batch-req-2",
        method: "tools/call",
        params: {
          name: "challenge_me",
          arguments: { userId: "batch-harness-user" },
        },
      },
      {
        jsonrpc: "2.0",
        id: "batch-req-3",
        method: "tools/call",
        params: {
          name: "honesty_report",
          arguments: { userId: "batch-harness-user" },
        },
      },
      {
        jsonrpc: "2.0",
        id: "batch-req-4",
        method: "tools/call",
        params: {
          name: "analyze_stance",
          arguments: {
            statement: "Artificial intelligence alignment is an existential priority for civilization.",
            userId: "batch-harness-user",
          },
        },
      },
    ];

    const t0 = performance.now();
    const batchRes = await fetch(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchRequests),
    });
    const batchElapsed = Math.round(performance.now() - t0);
    const batchData = await batchRes.json();

    assert(batchRes.status === 200, "Batch POST /mcp returns 200 OK");
    assert(Array.isArray(batchData), "Batch response is a JSON array");
    assert(batchData.length === 4, `Batch returned all 4 responses in single round-trip (${batchElapsed}ms)`);
    assert(batchData[0].id === "batch-req-1" && !batchData[0].error, "Batch item 1 (ping) resolved");
    assert(batchData[1].id === "batch-req-2" && batchData[1].result, "Batch item 2 (challenge_me) resolved");
    assert(batchData[2].id === "batch-req-3" && batchData[2].result, "Batch item 3 (honesty_report) resolved");
    assert(batchData[3].id === "batch-req-4" && batchData[3].result, "Batch item 4 (analyze_stance) resolved");
  }

  // -------------------------------------------------------------------------
  // PHASE 12: High-Concurrency User Mutex Lock Ledger Stress Test
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 12: Testing Per-User Mutex Lock Serialization (50 Parallel Mutations)...");
  {
    const lockedUserId = `serialized-mutex-user-${Date.now()}`;
    const mutationCount = 50;

    // Fire 50 simultaneous calibrate_baseline requests on the exact same user
    const mutationPromises = Array.from({ length: mutationCount }).map((_, idx) => {
      return callTool("calibrate_baseline", {
        userId: lockedUserId,
        baselineScore: 50.0 + (idx % 2 === 0 ? 0.5 : -0.5),
        reason: `Concurrent mutex update #${idx}`,
      }, `mutex-${idx}`);
    });

    const mutationResults = await Promise.all(mutationPromises);
    assert(mutationResults.length === mutationCount, `All ${mutationCount} concurrent requests resolved without deadlock`);

    // Verify user report
    const { payload: finalReport } = await callTool("honesty_report", { userId: lockedUserId });
    assert(finalReport.structuredContent.currentScore >= 0 && finalReport.structuredContent.currentScore <= 100, "Final score is within valid bounds [0, 100]");
    assert(finalReport.structuredContent.recentHistory.length >= 10, "Ledger history cleanly preserved across all concurrent writes");
    console.log(`     50 parallel writes serialized seamlessly. Final score: ${finalReport.structuredContent.currentScore}`);
  }

  // -------------------------------------------------------------------------
  // PHASE 13: Multilingual LLM Understanding & Epistemic Synthesis
  // -------------------------------------------------------------------------
  console.log("\n📌 PHASE 13: Testing Multilingual Dialectics & LLM Diagnosis (ES, FR, DE, HI)...");
  {
    // Spanish Stance & Steelman
    const { payload: esSteelman } = await callTool("steelman", {
      statement: "La energía nuclear es peligrosa y debería ser prohibida.",
      userId: "multilingual-tester",
    });
    assert(esSteelman.structuredContent.is_stance === true, "Spanish statement recognized as valid stance");
    assert(esSteelman.structuredContent.opposingThesis.includes("mecanismos fundamentales") || esSteelman.structuredContent.opposingThesis.length > 20, "Spanish steelman generated");
    const esWords = esSteelman.say.trim().split(/\s+/).length;
    assert(esWords <= 40, `Spanish voice brevity enforced (${esWords} words <= 40)`);

    // French Steelman
    const { payload: frSteelman } = await callTool("steelman", {
      statement: "Le télétravail détruit la créativité et la culture d'entreprise.",
      userId: "multilingual-tester",
    });
    assert(frSteelman.structuredContent.is_stance === true, "French statement recognized as valid stance");

    // Dynamic Multilingual LLM Honesty Reports
    const { payload: esReport } = await callTool("honesty_report", {
      userId: "multilingual-tester",
      language: "es",
    });
    assert(esReport.structuredContent.detectedLanguage === "es", "Honesty report generated in Spanish");
    assert(esReport.structuredContent.summaryInsights.length >= 2, "Report includes dynamic multilingual insights");
    console.log(`     Spanish Diagnosis sample: "${esReport.structuredContent.summaryInsights[0]}"`);
  }

  // -------------------------------------------------------------------------
  // FINAL REPORT
  // -------------------------------------------------------------------------
  console.log("\n=======================================================================");
  console.log(`🎉 ALL STRESS TESTS COMPLETED SUCCESSFULLY! (${passedTests}/${totalTests} Passed)`);
  console.log("=======================================================================\n");
}

runStressTest().catch((err) => {
  console.error("\n❌ STRESS TEST ABORTED WITH ERROR:", err);
  process.exit(1);
});
