# Hackathon Submission: Echo Chamber Breaker ⚡

**Track**: Alexa+ Track & AWS Builder Challenge  
**Live Simulator Demo**: `http://localhost:3000/simulator`  
**Protocol Endpoint**: `POST http://localhost:3000/mcp` | `GET http://localhost:3000/sse`  
**License**: MIT  

---

## 💡 Pitch & Tagline

> **"Most AI makes you feel smarter in the moment. Echo Chamber Breaker makes you actually harder to fool — including by yourself."**

Echo Chamber Breaker is a self-hosted **Model Context Protocol (MCP)** server that turns Alexa+ into an intellectual honesty coach. When a user expresses a strong conviction, the system detects stance strength and cognitive blind spots, generates a high-quality **steelmanned** opposing argument, tracks whether the user actually grapples with the counter-view, and maintains a private **Intellectual Honesty Score** over time.

---

## 🎯 The Problem

1. **The Sycophancy Epidemic**: Modern conversational AI and voice assistants are optimized for helpfulness and agreeableness. When a user expresses an unexamined opinion, the default response is soft agreement or polite hedging. This creates an invisible opinion bubble where opinions harden and reasoning degrades.
2. **Weak Counters are Easy to Dismiss**: Most attempts at counter-arguments are strawmen that users dismiss in seconds. A true sparring partner must articulate the *strongest possible version* of the opposing case.
3. **No Longitudinal Honesty Signal**: There is no existing mainstream voice interface that measures whether someone actually engages with opposing evidence over weeks and months.

---

## 🛠️ How It Works (The 4-Step Loop)

1. **Detect Stance (`analyze_stance`)**:
   - Detects polarity, certainty confidence (0.0 to 1.0), and emotional affect.
   - Identifies cognitive fallacies (e.g. *Confirmation Bias*, *False Dichotomy*, *Hasty Generalization*).
   - Names unstated blind spots and assumptions directly.

2. **Steelman Opposing Thesis (`steelman`)**:
   - Invokes Amazon Bedrock (`Claude 3.5 Sonnet` or `Amazon Nova Pro`) with prompt engineering engineered to never strawman.
   - Enforces a **strict voice UX rule**: the spoken summary (`say`) is always $\le 40$ words for auditory comprehension, while screen devices receive deep structural premises and evidence mechanisms.
   - Closes with a provocative epistemic inquiry question.

3. **Evaluate Real Engagement (`record_engagement`)**:
   - Analyzes user reply: Did they grapple with the opposing premise? Concede a valid point? Or dismiss it with a low-effort brush-off?
   - Awards significant positive deltas (`+8.5` pts) for genuine concessions and updates.
   - Decrements score (`-3.0` pts) for unengaged dismissals.

4. **Maintain Intellectual Honesty Ledger (`honesty_report`)**:
   - Maintains an append-only event store where every score change is explainable with a delta and human-readable reason.
   - Renders a 5D Epistemic Radar Chart:
     - **Openness to Evidence** (willingness to update beliefs)
     - **Dialectical Rigor** (depth of counter-rebuttals)
     - **Rebuttal Quality** (absence of ad-hominem)
     - **Intellectual Humility** (acknowledging valid counter-points)
     - **Consistency** (longitudinal volume of challenges completed)

---

## 🏗️ Technical Architecture & Stack

- **Protocol**: Model Context Protocol (MCP) Streamable HTTP & SSE (2024-11-05+ specification compliant) using `@modelcontextprotocol/sdk`.
- **Reasoning Layer**: Amazon Bedrock SDK (`@aws-sdk/client-bedrock-runtime`) for Claude 3.5 Sonnet and Amazon Nova Pro, backed by an embedded deterministic cognitive engine for zero-dependency local runs.
- **Voice Surface**: Complete Alexa Custom Skill manifest (`skill.json`, `interactionModel.json`) and webhook adapter (`src/alexa/adapter.ts`) delivering SSML audio and Echo Show cards.
- **Web Simulator**: Real MCP Client built with modern cybernetic glassmorphism, Web Speech API (STT & TTS), and a live packet trace terminal.
- **Containerization**: Hardened multi-stage `Dockerfile` and `docker-compose.yml` for 1-click cloud deployment on AWS ECS/EC2.
- **Epistemic Calibration & ML**: Expected Calibration Error (ECE) and Brier Score tracking evaluating model confidence vs semantic reality.

---

## 🧪 Verification & Done Criteria Met

- [x] **MCP Server**: Starts with one command, responds to `initialize` and `tools/list` with 9 production tools.
- [x] **Real or Mocked Bedrock**: Switches seamlessly via `BEDROCK_MODEL_ID` in `.env`.
- [x] **Simulator Speaks Real MCP**: Real JSON-RPC 2.0 wire trace inspectable in real-time.
- [x] **Honesty Score Append-Only Ledger**: Auditable, tamper-proof, bounded `[0, 100]`.
- [x] **Automated Tests**: 18 of 18 tests passing (`npm test`).
- [x] **2-Minute Demo Script**: Executable via `npm run demo`.

---

## 👥 What's Next

- **Household Multi-Speaker Debate Mode**: Allowing multiple family members on an Echo device to spar collaboratively and compare calibration scores.
- **Personalized Epistemic Memory**: Proactively recalling claims made weeks prior when new contradictory real-world data emerges.
- **Open-Source MCP Ecosystem Integration**: Publishing to the official Model Context Protocol registry as the standard anti-sycophancy layer for all agentic assistants.
