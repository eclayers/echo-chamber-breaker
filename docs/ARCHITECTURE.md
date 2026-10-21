# Echo Chamber Breaker — Technical Architecture Specification

## 1. High-Level Topology

```
                  +----------------------------------------------+
                  |         Client Layer                         |
                  |  - Alexa+ MCP Client                         |
                  |  - Web Simulator (Real MCP Client)           |
                  +----------------------------------------------+
                                         |
                                         | Streamable HTTP POST /mcp
                                         | or SSE GET /sse
                                         v
                  +----------------------------------------------+
                  |         Echo Chamber Breaker MCP Server      |
                  |                                              |
                  |  +----------------------------------------+  |
                  |  | MCP Protocol Router                    |  |
                  |  |  - JSON-RPC 2.0 Parser / Dispatcher   |  |
                  |  |  - SSEServerTransport Handler          |  |
                  |  +----------------------------------------+  |
                  |                      |                       |
                  |  +----------------------------------------+  |
                  |  | 9 Tool Handlers                        |  |
                  |  |  - analyze_stance                      |  |
                  |  |  - steelman                            |  |
                  |  |  - record_engagement                   |  |
                  |  |  - start/continue/conclude_debate      |  |
                  |  |  - honesty_report                      |  |
                  |  |  - challenge_me                        |  |
                  |  |  - calibrate_baseline                  |  |
                  |  +----------------------------------------+  |
                  |          |                         |         |
                  |          v                         v         |
                  |  +---------------+      +-----------------+  |
                  |  | Bedrock       |      | Honesty Engine  |  |
                  |  | Adapter       |      | & Event Store   |  |
                  |  +---------------+      +-----------------+  |
                  +----------------------------------------------+
                             |                         |
              +--------------+----------+              v
              |                         |      +------------------+
              v                         v      | Append-Only      |
       Amazon Bedrock             Local Mock   | Honesty Ledger   |
       (Claude / Nova)            Heuristics   | (JSON/DynamoDB)  |
                                               +------------------+
```

## 2. Epistemic Calibration & Machine Learning Methodology

In alignment with `/ml-best-practices`:
- **Expected Calibration Error (ECE)**: Groups confidence scores into 5-10 equal-width bins to assess difference between predicted probability and actual empirical validity.
- **Brier Score**: Evaluates mean squared error of model probabilistic certainty.
- **Steelman Quality Index (SQI)**: Automated scoring function grading generated counter-arguments on:
  - **Voice UX Brevity**: Spoken output strictly $\le$ 40 words.
  - **Charity Index**: Evidence density, zero ad-hominem, acknowledgement of nuance.
  - **Epistemic Depth**: Quality of the dialectical inquiry question.

## 3. Append-Only Ledger Math

The Intellectual Honesty Score is private, longitudinal, and mathematically bounded:
- Score starts at `50.0`.
- Range: `[0.0, 100.0]`.
- Concession reward: `+8.5` points.
- High rationality engagement: `+4.5` points.
- Low-effort dismissal: `-3.0` points.
- Every transaction creates an immutable event in the ledger stream.
