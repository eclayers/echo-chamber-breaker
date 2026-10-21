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
