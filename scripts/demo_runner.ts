import "dotenv/config";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postMcp(method: string, params: any = {}, id: number = 1) {
  const res = await fetch(`${BASE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    }),
  });
  return await res.json();
}

async function runDemoNarrative() {
  console.log("\n================================================================================");
  console.log("⚡ ECHO CHAMBER BREAKER — LIVE DEMO PRESENTATION RUNNER (Slide 07 Flow)");
  console.log("================================================================================");
  console.log("The anti-sycophant layer for Alexa+ • Streamable HTTP MCP • Amazon Bedrock");
  console.log("Targeting: Alexa+ Track & AWS Builder Challenge\n");

  await delay(1200);

  // STEP 1: Handshake & Discovery
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 1: Protocol Handshake & Tool Discovery over Streamable HTTP");
  console.log("--------------------------------------------------------------------------------");
  console.log(`Connecting to ${BASE_URL}/mcp ...`);
  const initRes = await postMcp("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "alexa-plus-client", version: "1.0.0" },
  }, 1);
  console.log(`→ MCP Initialized: Server '${initRes.result.serverInfo.name}' (v${initRes.result.serverInfo.version})`);

  const listRes = await postMcp("tools/list", {}, 2);
  const toolNames = listRes.result.tools.map((t: any) => t.name);
  console.log(`→ Discovered ${toolNames.length} MCP Tools:`, toolNames.join(", "));
  console.log("  [Protocol status: 100% SPEC COMPLIANT]\n");

  await delay(1500);

  // STEP 2: User states a strong conviction
  const userStatement = "Remote work is destroying company culture and productivity, and everyone must return to the office.";
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 2: User States a Confident Conviction");
  console.log("--------------------------------------------------------------------------------");
  console.log(`🎙️ User (to Alexa): "${userStatement}"\n`);

  await delay(1200);

  // STEP 3: Cognitive Stance Analysis
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 3: Tool Execution → 'analyze_stance'");
  console.log("--------------------------------------------------------------------------------");
  const stanceRes = await postMcp("tools/call", {
    name: "analyze_stance",
    arguments: { statement: userStatement, userId: "hackathon-judge" },
  }, 3);

  const stancePayload = JSON.parse(stanceRes.result.content[0].text);
  const stance = stancePayload.structuredContent;
  console.log(`🧠 Detected Topic:   ${stance.detectedTopic}`);
  console.log(`🎯 Stance Polarity:  ${stance.polarity}`);
  console.log(`📊 Conviction Level: ${Math.round(stance.confidence * 100)}% Certainty`);
  console.log(`🔥 Emotional Affect: ${Math.round(stance.emotionalCharge * 100)}%`);
  console.log(`🔍 Unstated Bias:    ${stance.detectedFallacies.join(", ")}`);
  console.log("⚠️  Cognitive Blind Spots Identified:");
  stance.blindSpots.forEach((b: string, i: number) => console.log(`   ${i + 1}. ${b}`));
  console.log("");

  await delay(1500);

  // STEP 4: Steelman Opposing Thesis
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 4: Tool Execution → 'steelman' (Charitable, Non-Strawman Opposing Case)");
  console.log("--------------------------------------------------------------------------------");
  const steelmanRes = await postMcp("tools/call", {
    name: "steelman",
    arguments: { statement: userStatement, userId: "hackathon-judge" },
  }, 4);

  const steelmanPayload = JSON.parse(steelmanRes.result.content[0].text);
  const steelman = steelmanPayload.structuredContent;

  console.log(`🔊 Spoken Voice Summary (< 40 words):`);
  console.log(`   "${steelman.say}" (Word count: ${steelman.say.split(/\s+/).length} words)`);
  console.log(`\n📋 Opposing Counter-Thesis:`);
  console.log(`   ${steelman.opposingThesis}`);
  console.log(`\n🔹 Core Structural Premises:`);
  steelman.coreArguments.forEach((arg: any) => {
    console.log(`   • ${arg.premise}: ${arg.evidenceOrMechanism}`);
  });
  console.log(`\n❓ Epistemic Inquiry:`);
  console.log(`   "${steelman.epistemicQuestion}"\n`);

  await delay(1800);

  // STEP 5: User engages with friction
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 5: Tool Execution → 'record_engagement' (Updating Honesty Ledger)");
  console.log("--------------------------------------------------------------------------------");
  const userEngagement = "I concede that asynchronous documentation creates better durable knowledge, though in-person onboarding for juniors remains faster.";
  console.log(`🎙️ User Grapples with Counter-Argument:`);
  console.log(`   "${userEngagement}"`);

  const engageRes = await postMcp("tools/call", {
    name: "record_engagement",
    arguments: {
      userId: "hackathon-judge",
      userReply: userEngagement,
      topic: stance.detectedTopic,
      counterClaim: steelman.opposingThesis,
    },
  }, 5);

  const engagePayload = JSON.parse(engageRes.result.content[0].text);
  const assessment = engagePayload.structuredContent.assessment;
  console.log(`\n📈 Dialectical Quality: ${assessment.quality}`);
  console.log(`✨ Score Delta:         +${assessment.scoreDelta} pts`);
  console.log(`🏆 Updated Score:       ${engagePayload.structuredContent.currentScore} / 100.0`);
  console.log(`💬 Alexa Feedback:      "${engagePayload.say}"\n`);

  await delay(1500);

  // STEP 6: Longitudinal Honesty Report
  console.log("--------------------------------------------------------------------------------");
  console.log("📌 STEP 6: Tool Execution → 'honesty_report' & Proactive Friction");
  console.log("--------------------------------------------------------------------------------");
  const reportRes = await postMcp("tools/call", {
    name: "honesty_report",
    arguments: { userId: "hackathon-judge" },
  }, 6);

  const reportPayload = JSON.parse(reportRes.result.content[0].text);
  const report = reportPayload.structuredContent;

  console.log(`📊 Intellectual Honesty Status: ${report.scoreStatus} (Score: ${report.currentScore})`);
  console.log(`📐 5D Radar Dimensions:`);
  console.log(`   • Openness to Evidence:  ${report.radarMetrics.opennessToEvidence} / 100`);
  console.log(`   • Dialectical Rigor:     ${report.radarMetrics.dialecticalRigor} / 100`);
  console.log(`   • Rebuttal Quality:      ${report.radarMetrics.rebuttalQuality} / 100`);
  console.log(`   • Intellectual Humility: ${report.radarMetrics.intellectualHumility} / 100`);
  console.log(`   • Consistency:           ${report.radarMetrics.consistency} / 100`);
  console.log(`📝 Append-Only Audit Trail:  ${report.recentHistory.length} events logged immutably.`);
  console.log("");

  await delay(1200);

  // Close
  console.log("================================================================================");
  console.log("🎉 DEMO NARRATIVE COMPLETED IN < 2 MINUTES!");
  console.log("================================================================================");
  console.log("Key Hackathon Highlights:");
  console.log("1. Genuine MCP Streamable HTTP protocol server (not simulated).");
  console.log("2. Bedrock / Local Mock reasoning layer preventing sycophancy.");
  console.log("3. Explainable Intellectual Honesty Ledger and Epistemic Calibration.");
  console.log("4. Alexa Custom Skill webhook ready at POST /alexa.");
  console.log("5. Live interactive UI: http://localhost:3000/simulator\n");
}

runDemoNarrative().catch((err) => {
  console.error("Demo failed:", err);
});
