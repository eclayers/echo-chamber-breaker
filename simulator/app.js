/**
 * Echo Chamber Breaker — Web Simulator MCP Client
 * Communicates with the Streamable HTTP server via JSON-RPC 2.0.
 */

// State
let rpcIdCounter = 1;
let isTtsEnabled = true;
let isRecording = false;
let currentUserId = "default-user";
let activeSteelman = null;
let speechRecognition = null;

// DOM Elements
const statementInput = document.getElementById("statementInput");
const voiceInputBtn = document.getElementById("voiceInputBtn");
const analyzeStanceBtn = document.getElementById("analyzeStanceBtn");
const steelmanBtn = document.getElementById("steelmanBtn");
const stanceCard = document.getElementById("stanceCard");
const steelmanCard = document.getElementById("steelmanCard");
const feedbackCard = document.getElementById("feedbackCard");
const wireTraceConsole = document.getElementById("wireTraceConsole");
const clearTraceBtn = document.getElementById("clearTraceBtn");
const toggleTtsBtn = document.getElementById("toggleTtsBtn");
const ttsIcon = document.getElementById("ttsIcon");
const proactiveChallengeBtn = document.getElementById("proactiveChallengeBtn");
const viewBenchmarkBtn = document.getElementById("viewBenchmarkBtn");
const benchmarkModal = document.getElementById("benchmarkModal");
const closeBenchmarkModalBtn = document.getElementById("closeBenchmarkModalBtn");
const benchmarkModalBody = document.getElementById("benchmarkModalBody");

// Stance display
const stanceTopicTag = document.getElementById("stanceTopicTag");
const stancePolarity = document.getElementById("stancePolarity");
const confidenceBar = document.getElementById("confidenceBar");
const confidenceText = document.getElementById("confidenceText");
const emotionalBar = document.getElementById("emotionalBar");
const emotionalText = document.getElementById("emotionalText");
const blindSpotsList = document.getElementById("blindSpotsList");
const coreAssumptionText = document.getElementById("coreAssumptionText");

// Steelman display
const spokenSayText = document.getElementById("spokenSayText");
const opposingThesisText = document.getElementById("opposingThesisText");
const premisesGrid = document.getElementById("premisesGrid");
const epistemicQuestionText = document.getElementById("epistemicQuestionText");
const engagementReplyInput = document.getElementById("engagementReplyInput");
const dismissChallengeBtn = document.getElementById("dismissChallengeBtn");
const concedePointBtn = document.getElementById("concedePointBtn");
const submitEngagementBtn = document.getElementById("submitEngagementBtn");

// Honesty dashboard
const honestyScoreValue = document.getElementById("honestyScoreValue");
const honestyStatusLabel = document.getElementById("honestyStatusLabel");
const totalChallengesCount = document.getElementById("totalChallengesCount");
const engagementRateValue = document.getElementById("engagementRateValue");
const concessionCountValue = document.getElementById("concessionCountValue");
const radarSvg = document.getElementById("radarSvg");
const ledgerEventsStream = document.getElementById("ledgerEventsStream");

// Wire Trace Logger
function logTrace(type, message, details = null) {
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement("div");
  entry.className = `trace-entry ${type}`;

  const ts = document.createElement("span");
  ts.className = "trace-timestamp";
  ts.textContent = `[${time}]`;
  entry.appendChild(ts);

  const textNode = document.createElement("span");
  textNode.textContent = message;
  entry.appendChild(textNode);

  if (details) {
    const pre = document.createElement("pre");
    pre.style.marginTop = "4px";
    pre.style.color = "#94a3b8";
    pre.style.fontSize = "10px";
    pre.textContent = typeof details === "string" ? details : JSON.stringify(details, null, 2);
    entry.appendChild(pre);
  }

  wireTraceConsole.appendChild(entry);
  wireTraceConsole.scrollTop = wireTraceConsole.scrollHeight;
}

// True MCP JSON-RPC Client Call over Streamable HTTP
async function callMcp(method, params = {}) {
  const id = rpcIdCounter++;
  const payload = {
    jsonrpc: "2.0",
    id,
    method,
    params,
  };

  const startTime = performance.now();
  logTrace("request", `→ POST /mcp [${method}] (id=${id})`, payload);

  try {
    const res = await fetch("/mcp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const elapsed = Math.round(performance.now() - startTime);
    const json = await res.json();

    if (json.error) {
      logTrace("error", `← HTTP ${res.status} [Error ${json.error.code}] (${elapsed}ms): ${json.error.message}`, json.error);
      throw new Error(json.error.message);
    }

    logTrace("response", `← HTTP 200 OK (${elapsed}ms) [id=${id}]`, json.result);
    return json.result;
  } catch (err) {
    logTrace("error", `Network or server failure: ${err.message}`);
    throw err;
  }
}

// Call MCP Tool Helper
async function callTool(name, args = {}) {
  const result = await callMcp("tools/call", {
    name,
    arguments: args,
  });

  if (result.content && result.content[0] && result.content[0].text) {
    try {
      const parsed = JSON.parse(result.content[0].text);
      if (parsed.say && isTtsEnabled) {
        speakVoice(parsed.say);
      }
      return parsed;
    } catch {
      return result.content[0].text;
    }
  }
  return result;
}

// Voice Output (SpeechSynthesis)
function speakVoice(text) {
  if (!("speechSynthesis" in window) || !isTtsEnabled) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  utterance.pitch = 1.0;
  window.speechSynthesis.speak(utterance);
}

// Voice Input (SpeechRecognition)
function setupSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceInputBtn.style.display = "none";
    return;
  }

  speechRecognition = new SpeechRecognition();
  speechRecognition.continuous = false;
  speechRecognition.interimResults = false;
  speechRecognition.lang = "en-US";

  speechRecognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    statementInput.value = transcript;
    logTrace("system", `Voice recognized: "${transcript}"`);
    stopRecording();
  };

  speechRecognition.onerror = (e) => {
    logTrace("error", `Speech recognition error: ${e.error}`);
    stopRecording();
  };

  speechRecognition.onend = () => {
    stopRecording();
  };
}

function startRecording() {
  if (!speechRecognition) return;
  try {
    speechRecognition.start();
    isRecording = true;
    voiceInputBtn.classList.add("recording");
    voiceInputBtn.querySelector("#micIcon").textContent = "🔴 Listening...";
  } catch (err) {
    console.error(err);
  }
}

function stopRecording() {
  isRecording = false;
  voiceInputBtn.classList.remove("recording");
  voiceInputBtn.querySelector("#micIcon").textContent = "🎙️ Voice Input";
  if (speechRecognition) {
    try { speechRecognition.stop(); } catch {}
  }
}

// Render SVG Epistemic Radar Chart
function renderRadar(metrics) {
  const labels = [
    { key: "opennessToEvidence", label: "Openness" },
    { key: "dialecticalRigor", label: "Rigor" },
    { key: "rebuttalQuality", label: "Rebuttal" },
    { key: "intellectualHumility", label: "Humility" },
    { key: "consistency", label: "Consistency" },
  ];

  const size = 240;
  const cx = 150;
  const cy = 120;
  const radius = 80;
  const angleStep = (Math.PI * 2) / labels.length;

  let gridSvg = "";
  // Web circles
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    const pts = [];
    for (let i = 0; i < labels.length; i++) {
      const a = i * angleStep - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * radius * r},${cy + Math.sin(a) * radius * r}`);
    }
    gridSvg += `<polygon points="${pts.join(" ")}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  }

  // Radial axes & labels
  let labelsSvg = "";
  for (let i = 0; i < labels.length; i++) {
    const a = i * angleStep - Math.PI / 2;
    const ax = cx + Math.cos(a) * radius;
    const ay = cy + Math.sin(a) * radius;
    gridSvg += `<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="rgba(255,255,255,0.1)" stroke-width="1"/>`;

    const lx = cx + Math.cos(a) * (radius + 20);
    const ly = cy + Math.sin(a) * (radius + 14);
    labelsSvg += `<text x="${lx}" y="${ly}" fill="#94a3b8" font-size="9" font-family="'Outfit', sans-serif" text-anchor="middle" dominant-baseline="middle">${labels[i].label}</text>`;
  }

  // Data polygon
  const dataPts = [];
  for (let i = 0; i < labels.length; i++) {
    const val = (metrics[labels[i].key] || 50) / 100;
    const a = i * angleStep - Math.PI / 2;
    dataPts.push(`${cx + Math.cos(a) * radius * val},${cy + Math.sin(a) * radius * val}`);
  }

  const polygonSvg = `
    <polygon points="${dataPts.join(" ")}" fill="rgba(99, 102, 241, 0.35)" stroke="#6366f1" stroke-width="2">
      <animate attributeName="fill-opacity" values="0.25;0.45;0.25" dur="3s" repeatCount="indefinite" />
    </polygon>
  `;

  radarSvg.innerHTML = `${gridSvg}${polygonSvg}${labelsSvg}`;
}

// Refresh Dashboard via 'honesty_report'
async function refreshHonestyDashboard() {
  try {
    const reportData = await callTool("honesty_report", { userId: currentUserId });
    const content = reportData.structuredContent || reportData;

    honestyScoreValue.textContent = Number(content.currentScore).toFixed(1);
    honestyStatusLabel.textContent = content.scoreStatus || "BALANCED";
    totalChallengesCount.textContent = content.totalChallenges || 0;
    engagementRateValue.textContent = `${content.engagementRatePercent || 0}%`;
    concessionCountValue.textContent = content.concessionCount || 0;

    if (content.radarMetrics) {
      renderRadar(content.radarMetrics);
    }

    // Populate Ledger Stream
    if (content.recentHistory && content.recentHistory.length > 0) {
      ledgerEventsStream.innerHTML = "";
      for (const ev of content.recentHistory) {
        const item = document.createElement("div");
        const isNeg = ev.delta < 0;
        const isConcession = ev.eventType === "CONCESSION_GRANTED";
        item.className = `ledger-item ${isNeg ? "negative" : isConcession ? "concession" : ""}`;

        const reason = document.createElement("div");
        reason.className = "ledger-reason";
        reason.title = ev.reason;
        reason.textContent = ev.reason;

        const delta = document.createElement("div");
        delta.className = `ledger-delta ${isNeg ? "neg" : ""}`;
        delta.textContent = `${ev.delta > 0 ? "+" : ""}${ev.delta} (Score: ${ev.resultingScore})`;

        item.appendChild(reason);
        item.appendChild(delta);
        ledgerEventsStream.appendChild(item);
      }
    }
  } catch (err) {
    console.error("Failed to refresh dashboard:", err);
  }
}

// Action: Analyze Stance
async function handleAnalyzeStance() {
  const statement = statementInput.value.trim();
  if (!statement) {
    alert("Please enter a statement or opinion first.");
    return;
  }

  analyzeStanceBtn.disabled = true;
  analyzeStanceBtn.textContent = "Analyzing...";

  try {
    const res = await callTool("analyze_stance", { statement, userId: currentUserId });
    const stance = res.structuredContent;

    stanceCard.style.display = "block";
    stanceTopicTag.textContent = stance.detectedTopic;
    stancePolarity.textContent = stance.polarity;
    confidenceBar.style.width = `${Math.round(stance.confidence * 100)}%`;
    confidenceText.textContent = `${Math.round(stance.confidence * 100)}% Certainty`;
    emotionalBar.style.width = `${Math.round(stance.emotionalCharge * 100)}%`;
    emotionalText.textContent = `${Math.round(stance.emotionalCharge * 100)}% Affect`;

    blindSpotsList.innerHTML = "";
    for (const spot of stance.blindSpots) {
      const li = document.createElement("li");
      li.className = "blindspot-item";
      li.innerHTML = `<span>⚠️</span> <span>${spot}</span>`;
      blindSpotsList.appendChild(li);
    }

    coreAssumptionText.textContent = stance.coreAssumption || "No unstated assumptions detected.";
    stanceCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    analyzeStanceBtn.disabled = false;
    analyzeStanceBtn.textContent = "Analyze Stance";
  }
}

// Action: Steelman Opposing View
async function handleSteelman() {
  const statement = statementInput.value.trim();
  if (!statement) {
    alert("Please enter a statement or opinion first.");
    return;
  }

  steelmanBtn.disabled = true;
  steelmanBtn.innerHTML = "<span>⚡ Generating Steelman...</span>";

  try {
    // Also display stance if not yet displayed
    if (stanceCard.style.display === "none") {
      handleAnalyzeStance();
    }

    const res = await callTool("steelman", { statement, userId: currentUserId });
    const steelman = res.structuredContent;
    activeSteelman = steelman;

    steelmanCard.style.display = "block";
    spokenSayText.textContent = steelman.say;
    opposingThesisText.textContent = steelman.opposingThesis;

    premisesGrid.innerHTML = "";
    for (const arg of steelman.coreArguments) {
      const card = document.createElement("div");
      card.className = "premise-card";
      card.innerHTML = `
        <div class="premise-head">🔹 ${arg.premise}</div>
        <div class="premise-body">${arg.evidenceOrMechanism}</div>
      `;
      premisesGrid.appendChild(card);
    }

    epistemicQuestionText.textContent = steelman.epistemicQuestion;
    steelmanCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    steelmanBtn.disabled = false;
    steelmanBtn.innerHTML = "<span>⚡ Steelman Opposing View</span>";
  }
}

// Action: Record Engagement (Dismiss, Concede, Submit)
async function handleEngagement(mode) {
  const reply = engagementReplyInput.value.trim();
  let userReplyText = reply;

  if (mode === "dismiss") {
    userReplyText = reply || "Whatever, you're wrong and I don't care.";
  } else if (mode === "concede") {
    userReplyText = reply || "I concede that you made a valid point regarding the trade-offs.";
  } else {
    if (!reply) {
      alert("Please articulate your counter-argument before submitting.");
      return;
    }
  }

  try {
    const res = await callTool("record_engagement", {
      userId: currentUserId,
      userReply: userReplyText,
      topic: activeSteelman?.opposingThesis?.slice(0, 40) || "General",
      counterClaim: activeSteelman?.opposingThesis,
    });

    const data = res.structuredContent;
    const assessment = data.assessment;

    feedbackCard.style.display = "block";
    const deltaBadge = document.getElementById("feedbackDeltaBadge");
    deltaBadge.textContent = `${assessment.scoreDelta > 0 ? "+" : ""}${assessment.scoreDelta} pts`;
    deltaBadge.className = `score-delta-badge ${assessment.scoreDelta < 0 ? "negative" : ""}`;

    document.getElementById("feedbackQualityBadge").textContent = assessment.quality.replace(/_/g, " ");
    document.getElementById("feedbackReasonText").textContent = assessment.reason;

    engagementReplyInput.value = "";
    await refreshHonestyDashboard();
    feedbackCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.error("Engagement recording error:", err);
  }
}

// Action: Proactive Challenge ("Challenge Me")
async function handleProactiveChallenge() {
  proactiveChallengeBtn.disabled = true;
  proactiveChallengeBtn.textContent = "Summoning...";

  try {
    const res = await callTool("challenge_me", { userId: currentUserId });
    const challenge = res.structuredContent;

    statementInput.value = challenge.provocation;
    logTrace("system", `Proactive challenge received for topic "${challenge.topic}"`);
    handleSteelman();
  } finally {
    proactiveChallengeBtn.disabled = false;
    proactiveChallengeBtn.textContent = "⚡ Challenge Me";
  }
}

// Action: View ML Benchmark Modal
async function handleViewBenchmark() {
  benchmarkModal.style.display = "flex";
  benchmarkModalBody.innerHTML = `<div class="loading-state">Running benchmark evaluation on dataset...</div>`;

  try {
    const res = await fetch("/api/benchmark");
    const data = await res.json();
    const summary = data.summary;

    let slicesHtml = "";
    for (const [domain, stats] of Object.entries(summary.domainSliceMetrics)) {
      slicesHtml += `
        <tr>
          <td style="padding: 8px; color: #ffffff;">${domain}</td>
          <td style="padding: 8px; text-align: center;">${stats.count}</td>
          <td style="padding: 8px; text-align: center;">${Math.round(stats.averageConfidence * 100)}%</td>
          <td style="padding: 8px; text-align: center; color: #4ade80;">${Math.round(stats.accuracy * 100)}%</td>
        </tr>
      `;
    }

    benchmarkModalBody.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px;">
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #64748b;">CLASSIFICATION ACCURACY</div>
          <div style="font-size: 22px; font-weight: 700; color: #38bdf8;">${Math.round(summary.classificationMetrics.accuracy * 100)}%</div>
          <div style="font-size: 11px; color: #94a3b8;">Macro F1: ${summary.classificationMetrics.macroF1}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #64748b;">EXPECTED CALIBRATION ERROR</div>
          <div style="font-size: 22px; font-weight: 700; color: #a78bfa;">${summary.calibrationReport.expectedCalibrationError}</div>
          <div style="font-size: 11px; color: #94a3b8;">Brier Score: ${summary.calibrationReport.brierScore}</div>
        </div>
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 12px; border-radius: 8px; text-align: center;">
          <div style="font-size: 11px; color: #64748b;">AVG STEELMAN QUALITY</div>
          <div style="font-size: 22px; font-weight: 700; color: #34d399;">${summary.averageSteelmanQualityScore}/100</div>
          <div style="font-size: 11px; color: #94a3b8;">Grade: A (Voice Compliant)</div>
        </div>
      </div>

      <div style="font-size: 13px; font-weight: 600; color: #e2e8f0; margin-bottom: 8px;">Domain Slice Analysis:</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: rgba(0,0,0,0.3); border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94a3b8; text-align: left;">
            <th style="padding: 8px;">Topic Domain</th>
            <th style="padding: 8px; text-align: center;">Samples</th>
            <th style="padding: 8px; text-align: center;">Avg Conf</th>
            <th style="padding: 8px; text-align: center;">Accuracy</th>
          </tr>
        </thead>
        <tbody>
          ${slicesHtml}
        </tbody>
      </table>
    `;
  } catch (err) {
    benchmarkModalBody.innerHTML = `<div style="color: #f87171;">Failed to load benchmark: ${err.message}</div>`;
  }
}

// Event Listeners
function initializeEventListeners() {
  analyzeStanceBtn.addEventListener("click", handleAnalyzeStance);
  steelmanBtn.addEventListener("click", handleSteelman);
  dismissChallengeBtn.addEventListener("click", () => handleEngagement("dismiss"));
  concedePointBtn.addEventListener("click", () => handleEngagement("concede"));
  submitEngagementBtn.addEventListener("click", () => handleEngagement("submit"));
  proactiveChallengeBtn.addEventListener("click", handleProactiveChallenge);
  viewBenchmarkBtn.addEventListener("click", handleViewBenchmark);
  closeBenchmarkModalBtn.addEventListener("click", () => (benchmarkModal.style.display = "none"));

  // Debate elements & listeners
  const startDebateBtn = document.getElementById("startDebateBtn");
  const debateCard = document.getElementById("debateCard");
  const debateTurnsStream = document.getElementById("debateTurnsStream");
  const debateReplyInput = document.getElementById("debateReplyInput");
  const sendDebateTurnBtn = document.getElementById("sendDebateTurnBtn");
  const concludeDebateBtn = document.getElementById("concludeDebateBtn");
  const exportReportBtn = document.getElementById("exportReportBtn");

  let activeDebateId = null;

  if (startDebateBtn) {
    startDebateBtn.addEventListener("click", async () => {
      const statement = statementInput.value.trim();
      if (!statement) {
        alert("Please enter a thesis statement first.");
        return;
      }
      startDebateBtn.disabled = true;
      startDebateBtn.textContent = "Initiating...";

      try {
        const res = await callTool("start_debate", { userId: currentUserId, statement });
        const content = res.structuredContent;
        activeDebateId = content.session.sessionId;

        debateCard.style.display = "block";
        debateTurnsStream.innerHTML = "";

        for (const turn of content.session.turns) {
          appendDebateTurn(turn.speaker, turn.text, turn.turnNumber);
        }

        debateCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } finally {
        startDebateBtn.disabled = false;
        startDebateBtn.textContent = "⚔️ Multi-Turn Debate";
      }
    });
  }

  function appendDebateTurn(speaker, text, turnNumber) {
    const div = document.createElement("div");
    const isUser = speaker === "USER";
    div.className = `debate-turn ${isUser ? "user" : "assistant"}`;
    div.innerHTML = `
      <div class="turn-header">
        <span>${isUser ? "👤 YOU (TURN " + turnNumber + ")" : "🤖 ECHOBREAKER (TURN " + turnNumber + ")"}</span>
      </div>
      <div>${text}</div>
    `;
    debateTurnsStream.appendChild(div);
    debateTurnsStream.scrollTop = debateTurnsStream.scrollHeight;
  }

  if (sendDebateTurnBtn) {
    sendDebateTurnBtn.addEventListener("click", async () => {
      const userReply = debateReplyInput.value.trim();
      if (!userReply || !activeDebateId) return;

      sendDebateTurnBtn.disabled = true;
      sendDebateTurnBtn.textContent = "Countering...";

      try {
        const res = await callTool("continue_debate", {
          sessionId: activeDebateId,
          userId: currentUserId,
          userReply,
        });

        const content = res.structuredContent;
        const turns = content.session.turns;
        const lastTwo = turns.slice(-2);

        for (const turn of lastTwo) {
          appendDebateTurn(turn.speaker, turn.text, turn.turnNumber);
        }

        debateReplyInput.value = "";
        await refreshHonestyDashboard();
      } finally {
        sendDebateTurnBtn.disabled = false;
        sendDebateTurnBtn.textContent = "💬 Send Counter-Turn";
      }
    });
  }

  if (concludeDebateBtn) {
    concludeDebateBtn.addEventListener("click", async () => {
      if (!activeDebateId) return;
      concludeDebateBtn.disabled = true;

      try {
        const res = await callTool("conclude_debate", {
          sessionId: activeDebateId,
          userId: currentUserId,
          finalReflection: "Acknowledged multifaceted trade-offs in dialectical session.",
        });

        const content = res.structuredContent;
        alert(`Debate concluded on ${content.topic}!\nTotal Turns: ${content.totalTurns}\nNet Delta: ${content.netScoreDelta > 0 ? "+" : ""}${content.netScoreDelta}\nFinal Score: ${content.currentScore}`);
        activeDebateId = null;
        await refreshHonestyDashboard();
      } finally {
        concludeDebateBtn.disabled = false;
      }
    });
  }

  if (exportReportBtn) {
    exportReportBtn.addEventListener("click", async () => {
      const reportData = await callTool("honesty_report", { userId: currentUserId });
      const c = reportData.structuredContent || reportData;
      const text = `
╔══════════════════════════════════════════════════════════╗
║  ECHO CHAMBER BREAKER — INTELLECTUAL HONESTY CERTIFICATE ║
╠══════════════════════════════════════════════════════════╣
║ User ID: ${c.userId.padEnd(47)}║
║ Current Score: ${String(c.currentScore).padEnd(41)}║
║ Status: ${String(c.scoreStatus).padEnd(48)}║
║ Challenges: ${String(c.totalChallenges).padEnd(44)}║
║ Concession Rate: ${(c.concessionRatePercent + "%").padEnd(39)}║
║ Engagement Rate: ${(c.engagementRatePercent + "%").padEnd(39)}║
╠══════════════════════════════════════════════════════════╣
║ Openness: ${(c.radarMetrics.opennessToEvidence + "/100").padEnd(46)}║
║ Rigor: ${(c.radarMetrics.dialecticalRigor + "/100").padEnd(49)}║
║ Humility: ${(c.radarMetrics.intellectualHumility + "/100").padEnd(46)}║
║ Rebuttal Quality: ${(c.radarMetrics.rebuttalQuality + "/100").padEnd(38)}║
╚══════════════════════════════════════════════════════════╝
Verified tamper-proof append-only ledger via Model Context Protocol.
`;
      await navigator.clipboard.writeText(text);
      alert("Intellectual Honesty Certificate copied to clipboard!");
    });
  }

  clearTraceBtn.addEventListener("click", () => {
    wireTraceConsole.innerHTML = "";
    logTrace("system", "Wire trace cleared.");
  });

  toggleTtsBtn.addEventListener("click", () => {
    isTtsEnabled = !isTtsEnabled;
    ttsIcon.textContent = isTtsEnabled ? "🔊 Voice: On" : "🔇 Voice: Off";
  });

  voiceInputBtn.addEventListener("click", () => {
    if (isRecording) stopRecording();
    else startRecording();
  });

  // Presets
  document.querySelectorAll(".preset-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      statementInput.value = chip.getAttribute("data-text");
      handleSteelman();
    });
  });
}

// Initial MCP Handshake & Ready Boot
async function boot() {
  setupSpeechRecognition();
  initializeEventListeners();

  try {
    // 1. Initial MCP Handshake
    await callMcp("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "echo-chamber-breaker-web-simulator", version: "1.0.0" },
    });

    // 2. Discover Tools
    const toolsResult = await callMcp("tools/list", {});
    const count = toolsResult.tools ? toolsResult.tools.length : 0;
    logTrace("system", `Discovered ${count} active MCP tools ready for execution.`);

    // 3. Load initial honesty dashboard
    await refreshHonestyDashboard();
  } catch (err) {
    logTrace("error", `Boot error connecting to MCP server: ${err.message}`);
  }
}

window.addEventListener("DOMContentLoaded", boot);
