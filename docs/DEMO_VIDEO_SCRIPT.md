# Echo Chamber Breaker — 2-Minute Demo Video Script 🎬

> **Track**: Alexa+ Track & AWS Builder Challenge  
> **Target Video Duration**: 2 minutes 15 seconds  
> **Resolution**: 1080p 60fps (Full screen browser at `http://localhost:3000/simulator`)  
> **Audio**: Clear microphone / voiceover  

---

## ⏱️ Video Timeline & Scene Breakdown

### Scene 1: The Problem & The Anti-Sycophant Thesis (0:00 – 0:25)
- **Visual**: Start on the Web Simulator ([`http://localhost:3000/simulator`](http://localhost:3000/simulator)). Highlight the header badges: `MCP: Connected (Streamable HTTP)` and `Mode: Mock / Bedrock`.
- **Narration**:
  > *"Every modern AI assistant is optimized to be agreeable. When you voice an unexamined opinion, the default response is soft agreement or polite hedging. Comfort over calibration. Over time, conversational AI turns into an invisible echo chamber.*  
  > *This is **Echo Chamber Breaker** — the anti-sycophant cognitive architecture for Alexa+. It runs as a self-hosted Model Context Protocol server over Streamable HTTP. Instead of nodding along, it detects your cognitive blind spots, steelmans the opposing view, and tracks whether you actually engage with counter-evidence."*

---

### Scene 2: Live MCP Wire Handshake & Opinion Articulation (0:25 – 0:50)
- **Visual**: 
  1. Expand the **Live MCP Wire Trace** console at the bottom right: show real JSON-RPC 2.0 frames (`initialize` and `tools/list` showing all 9 registered MCP tools).
  2. In Section I (*Articulate Your Conviction*), click the preset chip: **`🏢 Remote Work`** (or click the microphone icon **`🎙️ Speak to Alexa`** and state: *"Remote work is destroying company culture and productivity, and everyone must return to the office."*).
  3. Click the glowing button: **`⚡ Steelman Opposing View`**.
- **Narration**:
  > *"Notice the wire trace inspector: our simulator connects as a real MCP client using Streamable HTTP. When I articulate a strong opinion, the server executes two sequential tools: `analyze_stance` and `steelman`. Zero frontend illusions — pure protocol execution."*

---

### Scene 3: Stance Analysis, Voice Steelmanning & Socratic CoT (0:50 – 1:20)
- **Visual**:
  1. Show **Section II — Cognitive Stance Diagnosis**: Polarity (`STRONG_AGREE`), Conviction Certainty (`92% Certainty`), Affective Charge, Fallacy tags, and 3 identified cognitive blind spots.
  2. Show **Section III — Steelman Opposing Perspective**: Highlight the Alexa voice speech bubble (< 40 words) and let the browser's TTS audio play for 3 seconds.
  3. Click **`🧠 FORMAL DIALECTICAL REASONING TRACE (5-STEP SOCRATIC CoT)`** to reveal:
     - *Axiomatic Decomposition*
     - *Dennett-Rapoport Charitable Steelman*
     - *Systemic Counter-Causal Mechanism*
     - *Popperian Falsification Criterion*
     - *Irreducible Epistemic Dilemma*
  4. Point to the penetrating Socratic Inquiry question at the bottom.
- **Narration**:
  > *"First, `analyze_stance` calibrates my 92% conviction and surfaces three unexamined blind spots. Next, `steelman` constructs the strongest, most charitable counter-case. Notice two critical design axioms: it NEVER strawmans, and it strictly enforces a voice-ready summary under 40 words for Alexa, backed by a formal 5-step Socratic Chain-of-Thought for screen displays."*

---

### Scene 4: The Engagement Loop, 5D Radar & LLM Epistemic Diagnosis (1:20 – 1:50)
- **Visual**:
  1. In the engagement response chamber, click **`🤝 Concede Valid Point (+8.5 pts)`** (or type a substantive counter-rebuttal and click **`⚡ Submit Counter-Rebuttal (+4.5 pts)`**).
  2. Watch the **Intellectual Honesty Ledger** update live: score jumps from 50.0 to 58.5.
  3. Show the **5D Epistemic Calibration Radar** animate as *Openness to Evidence* and *Humility* expand.
  4. Highlight the **🧠 LLM Epistemic Diagnosis** card: point to the dynamically generated insights synthesizing user concession patterns and epistemic growth edges.
  5. Show the **Append-Only Audit Trail** logging the immutable event with timestamp, delta, and cryptographic ledger integrity.
- **Narration**:
  > *"Here is the core breakthrough: the engagement loop. If I dismiss the counter-argument, my score drops. But if I concede a valid point or grapple with the trade-offs, `record_engagement` rewards me with a positive delta. Our tamper-proof ledger updates in real time, expanding my 5D Epistemic Radar while an integrated LLM synthesizes personalized epistemic diagnostic insights."*

---

### Scene 5: Multilingual Intelligence, ML Benchmark & Wrap-Up (1:50 – 2:15)
- **Visual**:
  1. Briefly demonstrate global language agility: paste a Spanish, French, or Hindi conviction (e.g., *"La energía nuclear es esencial para combatir el cambio climático"*); show instant language detection, authentic native steelmanning, and localized diagnosis (`Lang: ES`).
  2. Click **`📊 ML Calibration`** at the top right to open the benchmark modal showing **80%+ Classification Accuracy**, **0.242 ECE**, and Platt temperature scaling calibration metrics.
  3. Close the modal, point to the GitHub repository, Docker container, and `POST /alexa` endpoint.
- **Narration**:
  > *"Echo Chamber Breaker understands any language in the world, generating native dialectics with zero loss of nuance. Under the hood, we adhere strictly to ML best practices with Platt temperature scaling and Expected Calibration Error benchmarks. With 46 automated Vitest tests, 114 stress test assertions, Amazon Bedrock integration, and a direct Alexa Custom Skill webhook, Echo Chamber Breaker is production-ready.*  
  > *Refuse the comfortable opinion. Break the echo chamber. Thank you!"*

---

---

### 🧪 Optional Bonus / Judge Stress-Test: Live Dynamic Generalization (Q&A)
- **Concept**: When judges ask: *"Does this only work on pre-scripted prompts?"*
- **Action**:
  1. Type any arbitrary, inflammatory, or foreign-language statement into the input box (e.g., complex geopolitical debates, esoteric programming paradigms, or philosophical ethics).
  2. Click **`⚡ Steelman Opposing View`**.
  3. Demonstrate live generalization:
     - Real-time stance classification and blind spot detection without template mismatch.
     - Charitable, non-strawman counter-case separating foundational contributions from modern grievances.
     - Spoken summary strictly under 40 words for Alexa compliance.
     - Immediate update in the LLM Epistemic Diagnosis box.
  4. Click **`↺ Reset (50.0)`** at the top of the Honesty Ledger to reset the profile score and ledger back to baseline at any moment.

---

## 💡 Quick Tips for Recording
1. **Resolution**: 1920x1080 at 100% browser zoom.
2. **Audio**: Ensure speaker volume is moderate so the browser's TTS speech is audible alongside your narration.
3. **Pacing**: Use smooth, deliberate mouse movements; pause 1-2 seconds after clicking buttons to let animations complete.
4. **Recording Tools**: OBS Studio or Windows Snipping Tool (`Win + Shift + R`).
5. **Fresh Baseline**: Before recording, click **`↺ Reset (50.0)`** at the top right of the Intellectual Honesty Ledger to start at a pristine 50.0 score.
