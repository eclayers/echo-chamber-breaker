/**
 * Echo Chamber Breaker — Amazon Bedrock & Alexa+ Web Simulator MCP Client
 * Communicates with the Streamable HTTP server via JSON-RPC 2.0.
 */

// Customization & Client State
let rpcIdCounter = 1;
let isTtsEnabled = true;
let isRecording = false;
let currentUserId = "default-user";
let activeSteelman = null;
let speechRecognition = null;
let audioCtx = null;

// Studio Settings
let currentTheme = "theme-amazon";
let activeRigor = "standard";
let activePersona = "economist";
let voiceSpeed = 1.0;
let voicePitch = 1.0;
let isChimesEnabled = true;
let lastKnownMetrics = {
  opennessToEvidence: 50,
  dialecticalRigor: 50,
  rebuttalQuality: 50,
  intellectualHumility: 50,
  consistency: 50,
};

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

// Synthesized Echo Chimes via Web Audio API
function playEchoChime(type = "wake") {
  if (!isChimesEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") audioCtx.resume();

    const now = audioCtx.currentTime;

    if (type === "wake") {
      // Classic Alexa dual-tone wake chime (523Hz -> 659Hz)
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.12);
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === "concession") {
      // Harmonic triad chord for +8.5 pts (C5 - E5 - G5)
      [523.25, 659.25, 783.99].forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.type = "triangle";
        const delay = idx * 0.08;
        osc.frequency.setValueAtTime(freq, now + delay);
        gain.gain.setValueAtTime(0.09, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.5);
        osc.start(now + delay);
        osc.stop(now + delay + 0.5);
      });
    } else if (type === "dismiss") {
      // Subtle downward dismissal chime (392Hz -> 329Hz)
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.type = "sine";
      osc.frequency.setValueAtTime(392.0, now);
      osc.frequency.setValueAtTime(329.63, now + 0.1);
      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch (err) {
    // Audio context may require initial user gesture
  }
}

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

// Call MCP Tool Helper with Customization Context
async function callTool(name, args = {}) {
  // Inject active customizations into metadata or arguments
  const enhancedArgs = {
    ...args,
    rigor: activeRigor,
    persona: activePersona,
  };

  const result = await callMcp("tools/call", {
    name,
    arguments: enhancedArgs,
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

// Alexa Voice Output (SpeechSynthesis)
function speakVoice(text) {
  if (!("speechSynthesis" in window) || !isTtsEnabled) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = voiceSpeed;
  utterance.pitch = voicePitch;

  const alexaWaveform = document.getElementById("alexaWaveform");
  if (alexaWaveform) {
    alexaWaveform.style.opacity = "1";
  }

  utterance.onend = () => {
    if (alexaWaveform) alexaWaveform.style.opacity = "0.4";
  };
  utterance.onerror = () => {
    if (alexaWaveform) alexaWaveform.style.opacity = "0.4";
  };

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
  playEchoChime("wake");
  try {
    speechRecognition.start();
    isRecording = true;
    voiceInputBtn.classList.add("recording");
    const micLabel = document.getElementById("micLabel");
    if (micLabel) micLabel.textContent = "Listening...";
  } catch (err) {
    console.error(err);
  }
}

function stopRecording() {
  isRecording = false;
  voiceInputBtn.classList.remove("recording");
  const micLabel = document.getElementById("micLabel");
  if (micLabel) micLabel.textContent = "Speak to Alexa";
  if (speechRecognition) {
    try { speechRecognition.stop(); } catch {}
  }
}

// Render SVG Epistemic Radar Chart with Dynamic Theme Accents
function renderRadar(metrics) {
  lastKnownMetrics = metrics || lastKnownMetrics;
  const m = lastKnownMetrics;

  const labels = [
    { key: "opennessToEvidence", label: "Openness" },
    { key: "dialecticalRigor", label: "Rigor" },
    { key: "rebuttalQuality", label: "Rebuttal" },
    { key: "intellectualHumility", label: "Humility" },
    { key: "consistency", label: "Consistency" },
  ];

  const cx = 150;
  const cy = 115;
  const radius = 75;
  const angleStep = (Math.PI * 2) / labels.length;

  // Determine colors based on active theme
  let strokeColor = "#ff9900";
  let fillColor = "rgba(255, 153, 0, 0.22)";
  let pointColor = "#ffb84d";
  let gridColor = "rgba(255, 153, 0, 0.15)";

  if (document.body.classList.contains("theme-alexa")) {
    strokeColor = "#00e5ff";
    fillColor = "rgba(0, 229, 255, 0.22)";
    pointColor = "#67e8f9";
    gridColor = "rgba(0, 229, 255, 0.15)";
  } else if (document.body.classList.contains("theme-aws")) {
    strokeColor = "#10b981";
    fillColor = "rgba(16, 185, 129, 0.22)";
    pointColor = "#34d399";
    gridColor = "rgba(16, 185, 129, 0.15)";
  } else if (document.body.classList.contains("theme-socratic")) {
    strokeColor = "#d4af37";
    fillColor = "rgba(212, 175, 55, 0.25)";
    pointColor = "#f7e7b4";
    gridColor = "rgba(212, 175, 55, 0.15)";
  }

  let gridSvg = "";
  // Web concentric polygons
  for (let r = 0.25; r <= 1.0; r += 0.25) {
    const pts = [];
    for (let i = 0; i < labels.length; i++) {
      const a = i * angleStep - Math.PI / 2;
      pts.push(`${cx + Math.cos(a) * radius * r},${cy + Math.sin(a) * radius * r}`);
    }
    gridSvg += `<polygon points="${pts.join(" ")}" fill="none" stroke="${gridColor}" stroke-width="1"/>`;
  }

  // Radial axes & labels
  let labelsSvg = "";
  for (let i = 0; i < labels.length; i++) {
    const a = i * angleStep - Math.PI / 2;
    const ax = cx + Math.cos(a) * radius;
    const ay = cy + Math.sin(a) * radius;
    gridSvg += `<line x1="${cx}" y1="${cy}" x2="${ax}" y2="${ay}" stroke="${gridColor}" stroke-width="1"/>`;

    const lx = cx + Math.cos(a) * (radius + 22);
    const ly = cy + Math.sin(a) * (radius + 14);
    labelsSvg += `<text x="${lx}" y="${ly}" fill="#94a3b8" font-size="9.5" font-family="'Plus Jakarta Sans', sans-serif" font-weight="600" text-anchor="middle" dominant-baseline="middle">${labels[i].label}</text>`;
  }

  // Data polygon & vertices
  const dataPts = [];
  let pointsSvg = "";
  for (let i = 0; i < labels.length; i++) {
    const val = (m[labels[i].key] || 50) / 100;
    const a = i * angleStep - Math.PI / 2;
    const px = cx + Math.cos(a) * radius * val;
    const py = cy + Math.sin(a) * radius * val;
    dataPts.push(`${px},${py}`);
    pointsSvg += `<circle cx="${px}" cy="${py}" r="3" fill="${pointColor}" stroke="${strokeColor}" stroke-width="1.5" />`;
  }

  const polygonSvg = `
    <polygon points="${dataPts.join(" ")}" fill="${fillColor}" stroke="${strokeColor}" stroke-width="2">
      <animate attributeName="fill-opacity" values="0.2;0.38;0.2" dur="3.5s" repeatCount="indefinite" />
    </polygon>
  `;

  radarSvg.innerHTML = `${gridSvg}${polygonSvg}${pointsSvg}${labelsSvg}`;
}

// Refresh Dashboard via 'honesty_report'
async function refreshHonestyDashboard() {
  try {
    const reportData = await callTool("honesty_report", { userId: currentUserId });
    const content = reportData.structuredContent || reportData;

    const score = Number(content.currentScore);
    honestyScoreValue.textContent = score.toFixed(1);

    // Derived label according to Normative Logic Spec § 5.2 and UI Spec § 4.1:
    let derivedStatus = content.scoreStatus;
    if (score > 65) derivedStatus = "OPEN_MINDED";
    else if (score < 35) derivedStatus = "CONFIRMATION_TRAPPED";
    else derivedStatus = "CALIBRATING";

    honestyStatusLabel.textContent = derivedStatus;
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

// Guided 4-Step Journey Stepper
function updateStepper(stepNumber) {
  for (let i = 1; i <= 4; i++) {
    const node = document.getElementById(`stepNode${i}`);
    if (node) {
      node.classList.toggle("active", i === stepNumber);
    }
  }
}

// Action: Analyze Stance
async function handleAnalyzeStance() {
  const statement = statementInput.value.trim();
  if (!statement) {
    alert("Please articulate a conviction, judgment, or opinion first.");
    return null;
  }

  playEchoChime("wake");
  analyzeStanceBtn.disabled = true;
  analyzeStanceBtn.textContent = "Analyzing...";

  const nonStanceCard = document.getElementById("nonStanceCard");

  try {
    const res = await callTool("analyze_stance", { statement, userId: currentUserId });
    const stance = res.structuredContent;

    // Normative Logic Spec § 2.4 & UI Spec § 6 & § 7.2:
    // If input is not a stance (greeting, question, fragment, neutral), NEVER invent conviction
    if (stance.is_stance === false) {
      // Invariant § 7.2: Clear any residual diagnosis, steelman, feedback, or arena panels
      stanceCard.style.display = "none";
      steelmanCard.style.display = "none";
      if (feedbackCard) feedbackCard.style.display = "none";
      const debateCardEl = document.getElementById("debateCard");
      if (debateCardEl) debateCardEl.style.display = "none";

      if (nonStanceCard) {
        nonStanceCard.style.display = "block";
        const sayEl = document.getElementById("nonStanceSayText");
        if (sayEl) sayEl.textContent = stance.say || "Please state a conviction or belief you hold with high certainty.";
        const reasonEl = document.getElementById("nonStanceReasonText");
        if (reasonEl) reasonEl.textContent = stance.coreAssumption || stance.calibrationNotes || "The system does not invent convictions or alter your honesty score for greetings, questions, or neutral descriptions.";
        const catTitle = document.getElementById("nonStanceCategoryTitle");
        if (catTitle) catTitle.textContent = stance.category ? `${stance.category} Detected` : "Conversational Input";
        const badge = document.getElementById("nonStanceBadge");
        if (badge) badge.textContent = stance.category ? `${stance.category}_REPLY` : "NON_STANCE_REPLY";
        nonStanceCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      return stance;
    }

    // Input IS a stance
    if (nonStanceCard) nonStanceCard.style.display = "none";

    stanceCard.style.display = "block";
    stanceTopicTag.textContent = stance.topic_label || stance.detectedTopic;
    stancePolarity.textContent = stance.polarity;
    const cert = stance.conviction_certainty !== undefined ? stance.conviction_certainty : Math.round(stance.confidence * 100);
    confidenceBar.style.width = `${cert}%`;
    confidenceText.textContent = `${cert}% Certainty`;
    const aff = stance.emotional_charge !== undefined ? stance.emotional_charge : Math.round(stance.emotionalCharge * 100);
    emotionalBar.style.width = `${aff}%`;
    emotionalText.textContent = `${aff}% Affect`;

    blindSpotsList.innerHTML = "";
    const spots = stance.blind_spots || stance.blindSpots || [];
    for (const spot of spots) {
      const li = document.createElement("li");
      li.className = "blindspot-item";
      li.innerHTML = `<span>⚠️</span> <span>${spot}</span>`;
      blindSpotsList.appendChild(li);
    }

    coreAssumptionText.textContent = stance.unexamined_assumption || stance.coreAssumption || "No unstated assumptions detected.";

    // Guard against content mismatch: if steelmanCard or debateCard were displaying an older statement, hide them
    if (activeSteelman && activeSteelman.originalClaim !== statement) {
      steelmanCard.style.display = "none";
      if (feedbackCard) feedbackCard.style.display = "none";
      const debateCardEl = document.getElementById("debateCard");
      if (debateCardEl) debateCardEl.style.display = "none";
    }

    updateStepper(2);
    stanceCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    return stance;
  } finally {
    analyzeStanceBtn.disabled = false;
    analyzeStanceBtn.textContent = "🔍 Analyze Stance";
  }
}

// Action: Steelman Opposing View
async function handleSteelman() {
  const statement = statementInput.value.trim();
  if (!statement) {
    alert("Please articulate a conviction, judgment, or opinion first.");
    return;
  }

  playEchoChime("wake");
  steelmanBtn.disabled = true;
  steelmanBtn.innerHTML = "<span>⚡ Generating Steelman...</span>";

  try {
    // 1. ALWAYS classify and synchronize Stance Diagnosis for CURRENT statement first!
    const stance = await handleAnalyzeStance();

    // Invariant Axioms A1 & A2: Non-stance inputs MUST NEVER receive a steelman
    if (!stance || stance.is_stance === false) {
      return;
    }

    const res = await callTool("steelman", { statement, userId: currentUserId });
    const steelman = res.structuredContent;

    if (steelman.is_stance === false) {
      return;
    }

    activeSteelman = steelman;

    steelmanCard.style.display = "block";
    spokenSayText.textContent = steelman.say;
    opposingThesisText.textContent = steelman.foundational_counter_thesis || steelman.opposingThesis;

    premisesGrid.innerHTML = "";
    const args = steelman.coreArguments || [];
    for (const arg of args) {
      const card = document.createElement("div");
      card.className = "premise-card";
      card.innerHTML = `
        <div class="premise-head">🔹 ${arg.premise}</div>
        <div class="premise-body">${arg.evidenceOrMechanism}</div>
      `;
      premisesGrid.appendChild(card);
    }

    epistemicQuestionText.textContent = steelman.socratic_inquiry || steelman.epistemicQuestion;

    // Render Socratic Reasoning Chain (CoT)
    const cotAxiom = document.getElementById("cotAxiom");
    const cotRapoport = document.getElementById("cotRapoport");
    const cotMechanism = document.getElementById("cotMechanism");
    const cotPopper = document.getElementById("cotPopper");
    const cotDilemma = document.getElementById("cotDilemma");
    const socraticCotChamber = document.getElementById("socraticCotChamber");

    if (steelman.reasoning_chain) {
      if (socraticCotChamber) socraticCotChamber.style.display = "block";
      const chain = steelman.reasoning_chain;
      if (cotAxiom) cotAxiom.textContent = chain.axiomaticDecomposition;
      if (cotRapoport) cotRapoport.textContent = chain.charitableReconstruction;
      if (cotMechanism) cotMechanism.textContent = chain.systemicMechanism;
      if (cotPopper) cotPopper.textContent = chain.popperianFalsificationCriterion;
      if (cotDilemma) cotDilemma.textContent = chain.epistemicDilemma;
    } else if (socraticCotChamber) {
      socraticCotChamber.style.display = "none";
    }

    // Reset debate arena and feedback if they belonged to an earlier statement
    const debateCardEl = document.getElementById("debateCard");
    if (debateCardEl) debateCardEl.style.display = "none";
    if (feedbackCard) feedbackCard.style.display = "none";

    updateStepper(3);
    steelmanCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } finally {
    steelmanBtn.disabled = false;
    steelmanBtn.innerHTML = `
      <div class="btn-text-block">
        <span class="btn-headline">⚡ Steelman Opposing View</span>
        <span class="btn-subtext">Alexa Audio (&lt; 40 words) • 3 Pillars</span>
      </div>
    `;
  }
}

// Action: Record Engagement (Dismiss, Concede, Submit)
let isEngaging = false;

async function handleEngagement(mode) {
  if (isEngaging) return;
  const reply = engagementReplyInput.value.trim();
  let userReplyText = reply;

  if (mode === "dismiss") {
    playEchoChime("dismiss");
    userReplyText = reply || "Whatever, you're wrong and I don't care.";
  } else if (mode === "concede") {
    playEchoChime("concession");
    userReplyText = reply || "I concede that you made a valid point regarding the trade-offs.";
  } else {
    playEchoChime("wake");
    if (!reply) {
      alert("Please articulate your counter-argument before submitting.");
      return;
    }
  }

  isEngaging = true;
  dismissChallengeBtn.disabled = true;
  concedePointBtn.disabled = true;
  submitEngagementBtn.disabled = true;

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
    deltaBadge.textContent = `${assessment.scoreDelta > 0 ? "+" : ""}${assessment.scoreDelta} PTS`;
    deltaBadge.className = `toast-delta ${assessment.scoreDelta < 0 ? "negative" : ""}`;

    document.getElementById("feedbackQualityBadge").textContent = assessment.quality.replace(/_/g, " ");
    document.getElementById("feedbackReasonText").textContent = assessment.reason;

    engagementReplyInput.value = "";
    await refreshHonestyDashboard();
    updateStepper(4);
    feedbackCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (err) {
    console.error("Engagement recording error:", err);
  } finally {
    isEngaging = false;
    dismissChallengeBtn.disabled = false;
    concedePointBtn.disabled = false;
    submitEngagementBtn.disabled = false;
  }
}

// Action: Reset Ledger Baseline
async function handleResetLedger() {
  const confirmReset = confirm("Reset your Intellectual Honesty score and baseline back to 50.0 (Balanced)?");
  if (!confirmReset) return;

  const resetBtn = document.getElementById("resetLedgerBtn");
  if (resetBtn) {
    resetBtn.disabled = true;
    resetBtn.textContent = "Resetting...";
  }

  try {
    await callTool("calibrate_baseline", {
      userId: currentUserId,
      baselineScore: 50.0,
      reason: "Manual baseline calibration to 50.0",
    });
    playEchoChime("concession");
    if (feedbackCard) feedbackCard.style.display = "none";
    await refreshHonestyDashboard();
    logTrace("system", `Honesty ledger reset to baseline 50.0 for user "${currentUserId}".`);
  } catch (err) {
    console.error("Failed to reset ledger:", err);
  } finally {
    if (resetBtn) {
      resetBtn.disabled = false;
      resetBtn.innerHTML = "<span>↺ Reset Ledger (50.0)</span>";
    }
  }
}

// Action: Proactive Challenge ("Challenge Me")
async function handleProactiveChallenge() {
  playEchoChime("wake");
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
  benchmarkModalBody.innerHTML = `<div class="loading-state" style="padding: 20px; text-align: center; color: #94a3b8;">Running benchmark evaluation across stratified domain slices...</div>`;

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

// Setup Customization Studio Listeners
function setupCustomizationStudio() {
  const toggleStudioBtn = document.getElementById("toggleStudioBtn");
  const customizationStudio = document.getElementById("customizationStudio");

  if (toggleStudioBtn && customizationStudio) {
    toggleStudioBtn.addEventListener("click", () => {
      const isVisible = customizationStudio.style.display !== "none";
      customizationStudio.style.display = isVisible ? "none" : "flex";
      toggleStudioBtn.classList.toggle("active-studio", !isVisible);
    });
  }

  // Theme Switcher
  document.querySelectorAll(".theme-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".theme-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const theme = btn.getAttribute("data-theme");
      document.body.className = theme;
      currentTheme = theme;
      renderRadar();
      logTrace("system", `Applied theme: ${theme}`);
    });
  });

  // Sparring Rigor Switcher
  document.querySelectorAll(".rigor-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".rigor-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeRigor = btn.getAttribute("data-rigor");
      logTrace("system", `Sparring rigor set to: ${activeRigor.toUpperCase()}`);
    });
  });

  // Persona Switcher
  document.querySelectorAll(".persona-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".persona-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activePersona = btn.getAttribute("data-persona");
      logTrace("system", `Cognitive perspective lens set to: ${activePersona.toUpperCase()}`);
    });
  });

  // Voice Speed & Pitch Sliders
  const voiceSpeedSlider = document.getElementById("voiceSpeedSlider");
  const voiceSpeedVal = document.getElementById("voiceSpeedVal");
  if (voiceSpeedSlider && voiceSpeedVal) {
    voiceSpeedSlider.addEventListener("input", (e) => {
      voiceSpeed = parseFloat(e.target.value);
      voiceSpeedVal.textContent = `${voiceSpeed.toFixed(1)}x`;
    });
  }

  const voicePitchSlider = document.getElementById("voicePitchSlider");
  const voicePitchVal = document.getElementById("voicePitchVal");
  if (voicePitchSlider && voicePitchVal) {
    voicePitchSlider.addEventListener("input", (e) => {
      voicePitch = parseFloat(e.target.value);
      voicePitchVal.textContent = voicePitch.toFixed(1);
    });
  }

  // Sound Chime Toggle
  const toggleChimesBtn = document.getElementById("toggleChimesBtn");
  if (toggleChimesBtn) {
    toggleChimesBtn.addEventListener("click", () => {
      isChimesEnabled = !isChimesEnabled;
      toggleChimesBtn.classList.toggle("active", isChimesEnabled);
      toggleChimesBtn.textContent = isChimesEnabled ? "🔔 Echo Chimes: ON" : "🔕 Echo Chimes: OFF";
      if (isChimesEnabled) playEchoChime("wake");
    });
  }

  // Profile Chips Switcher
  const customUserIdInput = document.getElementById("customUserIdInput");
  const applyUserIdBtn = document.getElementById("applyUserIdBtn");

  document.querySelectorAll(".profile-chip").forEach((chip) => {
    chip.addEventListener("click", async () => {
      document.querySelectorAll(".profile-chip").forEach((c) => c.classList.remove("active"));
      chip.classList.add("active");
      const user = chip.getAttribute("data-user");
      currentUserId = user;
      if (customUserIdInput) customUserIdInput.value = user;
      logTrace("system", `Switched active device profile to: ${user}`);
      await refreshHonestyDashboard();
    });
  });

  const closeStudio = () => {
    customizationStudio.style.display = "none";
    if (toggleStudioBtn) toggleStudioBtn.classList.remove("active-studio");
    const chamberCard = document.getElementById("chamberCard") || document.querySelector(".sparring-stage");
    if (chamberCard) chamberCard.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const backToSparringBtn = document.getElementById("backToSparringBtn");
  const bottomBackToSparringBtn = document.getElementById("bottomBackToSparringBtn");
  if (closeStudioBtn) closeStudioBtn.addEventListener("click", closeStudio);
  if (backToSparringBtn) backToSparringBtn.addEventListener("click", closeStudio);
  if (bottomBackToSparringBtn) bottomBackToSparringBtn.addEventListener("click", closeStudio);

  if (applyUserIdBtn && customUserIdInput) {
    applyUserIdBtn.addEventListener("click", async () => {
      const val = customUserIdInput.value.trim();
      if (!val) return;
      currentUserId = val;
      document.querySelectorAll(".profile-chip").forEach((c) => {
        c.classList.toggle("active", c.getAttribute("data-user") === val);
      });
      logTrace("system", `Switched active user ID to: ${currentUserId}`);
      await refreshHonestyDashboard();
    });
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
  const resetLedgerBtn = document.getElementById("resetLedgerBtn");
  if (resetLedgerBtn) resetLedgerBtn.addEventListener("click", handleResetLedger);
  viewBenchmarkBtn.addEventListener("click", handleViewBenchmark);
  closeBenchmarkModalBtn.addEventListener("click", () => (benchmarkModal.style.display = "none"));

  // Socratic CoT Reasoning Chain Drawer Toggle
  const cotToggleBar = document.getElementById("cotToggleBar");
  const cotDrawer = document.getElementById("cotDrawer");
  const cotIndicator = document.getElementById("cotIndicator");
  if (cotToggleBar && cotDrawer) {
    cotToggleBar.addEventListener("click", () => {
      const isClosed = cotDrawer.style.display === "none";
      cotDrawer.style.display = isClosed ? "flex" : "none";
      if (cotIndicator) cotIndicator.textContent = isClosed ? "[Click to Collapse ▴]" : "[Click to Expand ▾]";
    });
  }

  // About & Architecture Modal
  const aboutModal = document.getElementById("aboutModal");
  const closeAboutModalBtn = document.getElementById("closeAboutModalBtn");
  const toggleHowItWorksBtn = document.getElementById("toggleHowItWorksBtn");

  if (toggleHowItWorksBtn && aboutModal) {
    toggleHowItWorksBtn.addEventListener("click", () => {
      aboutModal.style.display = "flex";
      playEchoChime("wake");
    });
  }

  if (closeAboutModalBtn && aboutModal) {
    closeAboutModalBtn.addEventListener("click", () => {
      aboutModal.style.display = "none";
    });
  }

  if (aboutModal) {
    aboutModal.addEventListener("click", (e) => {
      if (e.target === aboutModal) {
        aboutModal.style.display = "none";
      }
    });
  }

  // Collapsible wire trace toggle
  const traceToggleHeader = document.getElementById("traceToggleHeader");
  const wireTraceConsole = document.getElementById("wireTraceConsole");
  const traceToggleIndicator = document.getElementById("traceToggleIndicator");
  if (traceToggleHeader && wireTraceConsole) {
    traceToggleHeader.addEventListener("click", () => {
      const isHidden = wireTraceConsole.style.display === "none";
      wireTraceConsole.style.display = isHidden ? "block" : "none";
      if (traceToggleIndicator) {
        traceToggleIndicator.textContent = isHidden ? "[Collapse]" : "[Click to Toggle]";
      }
    });
  }

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
      playEchoChime("wake");
      startDebateBtn.disabled = true;
      startDebateBtn.textContent = "Initiating...";

      try {
        // ALWAYS synchronize Stance and Steelman cards so every card on screen reflects this exact statement
        if (stanceCard.style.display === "none" || !activeSteelman || activeSteelman.originalClaim !== statement) {
          await handleSteelman();
        }

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
        <span>${isUser ? "👤 YOU (TURN " + turnNumber + ")" : "🤖 ALEXA+ (TURN " + turnNumber + ")"}</span>
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

      playEchoChime("wake");
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
        sendDebateTurnBtn.textContent = "💬 Submit Turn";
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
║  POWERED BY AMAZON BEDROCK & ALEXA+ MODEL CONTEXT PROTO  ║
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
Verified append-only tamper-proof ledger via Model Context Protocol.
`;
      await navigator.clipboard.writeText(text);
      playEchoChime("concession");
      alert("Intellectual Honesty Certificate copied to clipboard!");
    });
  }

  clearTraceBtn.addEventListener("click", () => {
    wireTraceConsole.innerHTML = "";
    logTrace("system", "Wire trace cleared.");
  });

  toggleTtsBtn.addEventListener("click", () => {
    isTtsEnabled = !isTtsEnabled;
    ttsIcon.textContent = isTtsEnabled ? "🔊" : "🔇";
    const ttsLabel = document.getElementById("ttsLabel");
    if (ttsLabel) ttsLabel.textContent = isTtsEnabled ? "Voice: Enabled" : "Voice: Muted";
  });

  voiceInputBtn.addEventListener("click", () => {
    if (isRecording) stopRecording();
    else startRecording();
  });

  // Typing input listener on statementInput
  statementInput.addEventListener("input", () => {
    updateStepper(1);
    const currentVal = statementInput.value.trim();
    document.querySelectorAll(".preset-card").forEach((card) => {
      if (card.getAttribute("data-text") !== currentVal) {
        card.classList.remove("active");
      }
    });
  });

  // Presets (Topic Chips: Pre-fills text area only per Normative Logic Spec § 2.3 & UI Spec § 7.3)
  const presetCards = document.querySelectorAll(".preset-card");
  presetCards.forEach((card) => {
    card.addEventListener("click", () => {
      presetCards.forEach((c) => c.classList.remove("active"));
      card.classList.add("active");
      statementInput.value = card.getAttribute("data-text");
      updateStepper(1);
    });
  });

  // Setup Customization Studio
  setupCustomizationStudio();

  // Setup ML Calibration & Training Studio
  setupMLStudio();
}

function setupMLStudio() {
  if (!viewBenchmarkBtn || !benchmarkModal) return;

  // Open modal
  viewBenchmarkBtn.addEventListener("click", async () => {
    benchmarkModal.style.display = "flex";
    await refreshMLStudio();
  });

  // Close modal
  if (closeBenchmarkModalBtn) {
    closeBenchmarkModalBtn.addEventListener("click", () => {
      benchmarkModal.style.display = "none";
    });
  }

  // Close on backdrop click
  benchmarkModal.addEventListener("click", (e) => {
    if (e.target === benchmarkModal) {
      benchmarkModal.style.display = "none";
    }
  });

  // Tab switching
  const mlTabBtns = document.querySelectorAll(".ml-tab-btn");
  mlTabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      mlTabBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const target = btn.getAttribute("data-mltab");
      const overviewPane = document.getElementById("mlTabOverview");
      const trainPane = document.getElementById("mlTabTrain");
      const sandboxPane = document.getElementById("mlTabSandbox");

      if (overviewPane) overviewPane.style.display = target === "tab-overview" ? "block" : "none";
      if (trainPane) trainPane.style.display = target === "tab-train" ? "block" : "none";
      if (sandboxPane) sandboxPane.style.display = target === "tab-sandbox" ? "block" : "none";
    });
  });

  // Retrain button
  const runTrainBtn = document.getElementById("runTrainBtn");
  if (runTrainBtn) {
    runTrainBtn.addEventListener("click", async () => {
      const epochsInput = document.getElementById("mlEpochsInput");
      const lrInput = document.getElementById("mlLrInput");
      const l2Input = document.getElementById("mlL2Input");
      const trainBtnText = document.getElementById("trainBtnText");
      const trainProgressBox = document.getElementById("trainProgressBox");
      const lossCurveSummary = document.getElementById("lossCurveSummary");

      const epochs = epochsInput ? epochsInput.value : 30;
      const learningRate = lrInput ? lrInput.value : 0.15;
      const l2Lambda = l2Input ? l2Input.value : 0.005;

      try {
        runTrainBtn.disabled = true;
        if (trainBtnText) trainBtnText.textContent = "Training Epochs...";
        if (trainProgressBox) trainProgressBox.style.display = "block";
        if (lossCurveSummary) lossCurveSummary.textContent = "Running Mini-batch Gradient Descent with L2 regularizer...";

        const res = await fetch("/api/ml/train", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ epochs, learningRate, l2Lambda }),
        });
        const data = await res.json();
        if (data.success && data.result) {
          const r = data.result;
          playEchoChime("concession");
          if (lossCurveSummary) {
            const firstLoss = r.lossHistory[0]?.loss || 0;
            const lastLoss = r.finalTrainLoss;
            const reduction = Math.round(((firstLoss - lastLoss) / Math.max(firstLoss, 0.001)) * 100);
            lossCurveSummary.innerHTML = `✅ <strong>Training Converged!</strong> Cross-entropy loss reduced from ${firstLoss} to ${lastLoss} (↓${reduction}%).<br>` +
              `• Platt Calibration Temperature: <strong>T = ${r.temperatureParameter}</strong><br>` +
              `• Expected Calibration Error (ECE) Reduced: <span style="color:#10b981; font-weight:700;">↓${r.eceImprovementPercent}%</span><br>` +
              `• Quadratic Brier Score Improved: <span style="color:#10b981; font-weight:700;">↓${r.brierImprovementPercent}%</span><br>` +
              `• Held-Out Test Accuracy: <strong>${Math.round(r.testMetrics.accuracy * 100)}%</strong> (Macro-F1: ${Math.round(r.testMetrics.macroF1 * 100)}%)`;
          }
          await refreshMLStudio();
        }
      } catch (err) {
        if (lossCurveSummary) lossCurveSummary.textContent = `Training failed: ${err.message}`;
      } finally {
        runTrainBtn.disabled = false;
        if (trainBtnText) trainBtnText.textContent = "Retrain ML Model";
      }
    });
  }

  // Predict Sandbox button
  const runPredictBtn = document.getElementById("runPredictBtn");
  const mlSandboxInput = document.getElementById("mlSandboxInput");
  const mlSandboxResults = document.getElementById("mlSandboxResults");
  if (runPredictBtn && mlSandboxInput && mlSandboxResults) {
    runPredictBtn.addEventListener("click", async () => {
      const stmt = mlSandboxInput.value.trim();
      if (!stmt) return;
      try {
        runPredictBtn.disabled = true;
        runPredictBtn.textContent = "Computing...";
        const res = await fetch("/api/ml/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statement: stmt }),
        });
        const data = await res.json();
        if (data.success && data.prediction) {
          const p = data.prediction;
          mlSandboxResults.innerHTML = `
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <span class="mcp-tool-pill" style="background: rgba(255,153,0,0.15); border-color: rgba(255,153,0,0.4); color: #ff9900;">
                Polarity: ${p.predictedPolarity}
              </span>
              <span class="mcp-tool-pill" style="background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #10b981;">
                Calibrated Confidence: ${Math.round(p.calibratedConfidence * 100)}%
              </span>
              <span class="mcp-tool-pill" style="background: rgba(139,92,246,0.15); border-color: rgba(139,92,246,0.4); color: #a78bfa;">
                Bias: ${p.predictedBias}
              </span>
              <span class="mcp-tool-pill" style="background: rgba(56,189,248,0.15); border-color: rgba(56,189,248,0.4); color: #38bdf8;">
                Domain: ${p.matchedDomain || "General"}
              </span>
            </div>
            <div style="font-size: 11.5px; color: #94a3b8; margin-top: 6px;">
              Top Extracted Feature Weights:
              <div class="ml-feature-chips">
                ${p.topFeatures.map(f => `<span class="ml-feature-chip">${f.feature} (${f.weight})</span>`).join("")}
              </div>
            </div>
            <div style="font-size: 12px; color: #cbd5e1; margin-top: 6px; padding: 8px; background: rgba(0,0,0,0.25); border-radius: 6px;">
              <strong>Socratic Counter-Inquiry:</strong> "${p.suggestedSocraticInquiry}"
            </div>
          `;
        }
      } catch (err) {
        mlSandboxResults.textContent = `Inference failed: ${err.message}`;
      } finally {
        runPredictBtn.disabled = false;
        runPredictBtn.textContent = "Predict";
      }
    });
  }
}

async function refreshMLStudio() {
  try {
    const res = await fetch("/api/ml/status");
    const data = await res.json();
    if (data.success && data.result) {
      const r = data.result;
      const eceEl = document.getElementById("mlStatEce");
      const brierEl = document.getElementById("mlStatBrier");
      const f1El = document.getElementById("mlStatF1");
      const tempEl = document.getElementById("mlStatTemp");

      if (eceEl) eceEl.textContent = (r.calibratedReport.expectedCalibrationError * 100).toFixed(1) + "%";
      if (brierEl) brierEl.textContent = r.calibratedReport.brierScore.toFixed(3);
      if (f1El) f1El.textContent = Math.round(r.testMetrics.macroF1 * 100) + "%";
      if (tempEl) tempEl.textContent = "T = " + r.temperatureParameter;

      // Render Reliability Diagram Bins
      const binsChart = document.getElementById("mlBinsChart");
      if (binsChart && r.calibratedReport.bins) {
        binsChart.innerHTML = r.calibratedReport.bins.map((b, i) => {
          const lower = Math.round(b.confidenceLower * 100);
          const upper = Math.round(b.confidenceUpper * 100);
          const predWidth = Math.round(b.avgConfidence * 100);
          const accWidth = Math.round(b.accuracy * 100);
          return `
            <div class="ml-bin-row">
              <span style="font-family: monospace; color: #94a3b8;">Bin ${i + 1} (${lower}-${upper}%)</span>
              <div class="ml-bin-bar-track" title="Confidence: ${predWidth}% | Accuracy: ${accWidth}%">
                <div class="ml-bin-bar-pred" style="width: ${predWidth}%;"></div>
                <div class="ml-bin-bar-acc" style="width: ${accWidth}%;"></div>
              </div>
              <span style="text-align: right; font-family: monospace; color: #cbd5e1;">N = ${b.count}</span>
            </div>
          `;
        }).join("");
      }
    }
  } catch (err) {
    console.error("Failed to refresh ML studio:", err);
  }
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
      clientInfo: { name: "echo-chamber-breaker-amazon-simulator", version: "1.0.0" },
    });

    // 2. Discover Tools
    const toolsResult = await callMcp("tools/list", {});
    const count = toolsResult.tools ? toolsResult.tools.length : 0;
    logTrace("system", `Discovered ${count} active MCP tools ready for Amazon Bedrock.`);

    // 3. Load initial honesty dashboard
    await refreshHonestyDashboard();
  } catch (err) {
    logTrace("error", `Boot error connecting to MCP server: ${err.message}`);
  }
}

window.addEventListener("DOMContentLoaded", boot);
