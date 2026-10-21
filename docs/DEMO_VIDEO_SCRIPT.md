# Echo Chamber Breaker — 2-Minute Demo Video Script 🎬

> **Track**: Alexa+ Track & AWS Builder Challenge  
> **Target Video Duration**: 2 minutes 15 seconds  
> **Resolution**: 1080p 60fps (Full screen browser at `http://localhost:3000/simulator`)  
> **Audio**: Clear microphone / voiceover  

---

## ⏱️ Video Timeline & Scene Breakdown

### Scene 1: The Problem & The Thesis (0:00 – 0:25)
- **Visual**: Start with the Web Simulator open on screen ([`http://localhost:3000/simulator`](http://localhost:3000/simulator)). Point the mouse at the header badge: `MCP: Connected (Streamable HTTP)`.
- **Narration**:
  > *"Every modern AI assistant is designed to be agreeable. When you express an unexamined opinion, the default response is soft agreement or mild hedging. Comfort over calibration. Over time, conversational AI turns into an invisible echo chamber.*  
  > *This is **Echo Chamber Breaker** — the anti-sycophant layer for Alexa+. It lives as a self-hosted Model Context Protocol server over Streamable HTTP. Instead of nodding along, it detects your cognitive blind spots, steelmans the opposing view, and tracks whether you actually engage with counter-evidence."*

---

### Scene 2: Live MCP Wire Handshake & Opinion (0:25 – 0:50)
- **Visual**: 
  1. Scroll down slightly to show the **Live MCP Protocol Trace** console showing real JSON-RPC 2.0 frames (`initialize` and `tools/list` showing 9 active tools).
  2. Click the preset chip: **`🏢 Remote Work`** (or click the microphone icon and speak: *"Remote work is destroying company culture and productivity, and everyone must return to the office."*).
  3. Click the glowing purple button: **`⚡ Steelman Opposing View`**.
- **Narration**:
  > *"Notice the terminal on the right: our simulator connects as a real MCP client using Streamable HTTP — this isn't simulated in the frontend. When I submit a strong opinion, the server executes two tools: `analyze_stance` and `steelman`."*

---

### Scene 3: Stance Analysis & Voice Steelmanning (0:50 – 1:20)
- **Visual**:
  1. Show the **Stance & Cognitive Certainty** card: 92% conviction, Hasty Generalization fallacy, and the 3 identified blind spots.
  2. Show the **Steelman Card**: Highlight the voice bubble (< 40 words) and listen to the audio playback.
  3. Highlight the structured premises: *Talent Liquidity*, *Documentation over Tribalism*, and the *Epistemic Question*.
- **Narration**:
  > *"First, `analyze_stance` detects my 92% conviction and flags three unstated blind spots. Then, `steelman` generates the strongest, most charitable opposing case. Notice two critical design rules: first, it NEVER strawmans; second, it returns a concise voice-ready summary strictly under 40 words for Alexa, backed by deep structural premises for screen devices."*

---

### Scene 4: The Engagement Loop & Honesty Ledger (1:20 – 1:50)
- **Visual**:
  1. In the response textarea, click **`🤝 Concede Valid Point (+8.5 pts)`**.
  2. Point the mouse to the **Intellectual Honesty Ledger**: watch the radial score jump from 50.0 to 58.5.
  3. Show the **5D Epistemic Radar Chart** animating as *Openness to Evidence* expands.
  4. Point to the **Audit Trail** showing the immutable event logged with reason and timestamp.
- **Narration**:
  > *"Now the core product differentiator: the engagement loop. If I brush off the counter-argument, my score drops. But if I concede a valid point or grapple with the trade-offs, `record_engagement` rewards me with a positive delta. Our append-only Honesty Ledger updates in real time, expanding my Epistemic Radar across Openness, Rigor, and Humility."*

---

### Scene 5: ML Benchmark, Alexa Endpoint & Wrap-Up (1:50 – 2:15)
- **Visual**:
  1. Click **`📊 ML Calibration`** at the top right to open the benchmark modal showing **80% Accuracy**, **0.242 ECE**, and domain slice metrics.
  2. Close the modal, point to the GitHub repo link and `POST /alexa` webhook.
- **Narration**:
  > *"Under the hood, we adhere strictly to machine learning best practices: tracking Expected Calibration Error and Brier scores across domains. With 18 automated tests passing, Docker readiness, Amazon Bedrock compatibility, and a direct Alexa Custom Skill webhook, Echo Chamber Breaker is ready to deploy.*  
  > *Refuse the comfortable opinion. Thank you!"*

---

---

### 🧪 Optional Bonus / Judge Stress-Test: Dynamic Generalization (Live Q&A)
- **Concept**: When judges ask: *"Does this only work on pre-scripted prompts?"*
- **Action**:
  1. Highlight or type an arbitrary or inflammatory statement into the input box (e.g., historical/civilizational conflicts, esoteric tech stack debates, or custom philosophical views).
  2. Click **`⚡ Steelman Opposing View`**.
  3. Show how the input-to-tool pipeline immediately synchronizes:
     - Real-time stance diagnosis updates with no stale remote-work remnants.
     - The steelman produces a charitable, non-strawman counter-case separating foundational contributions from modern grievances.
     - Spoken summary is strictly under 40 words for Alexa compliance.
  4. Click **`↺ Reset Ledger (50.0)`** to reset the profile score and ledger back to baseline at any time.

---

## 💡 Quick Tips for Recording
1. **Resolution**: 1920x1080 at 100% zoom.
2. **Audio**: Ensure speaker volume is moderate so the browser's TTS speech is audible alongside your voice.
3. **Cursor**: Use smooth, deliberate mouse movements.
4. **Recording Tools**: OBS Studio or Windows Snipping Tool (`Win + Shift + R`).
5. **Score Reset**: If you practiced before recording, click `↺ Reset Ledger (50.0)` at the top of the Honesty Ledger to start at a pristine 50.0 score.
