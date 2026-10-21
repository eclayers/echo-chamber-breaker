import { describe, it, expect } from "vitest";
import { handleAlexaRequest, type AlexaRequestBody } from "../src/alexa/adapter.js";

describe("Alexa+ Voice Skill Adapter Suite", () => {
  it("handles LaunchRequest and returns welcoming SSML", async () => {
    const req: AlexaRequestBody = {
      version: "1.0",
      session: {
        sessionId: "session-1",
        application: { applicationId: "amzn1.echo-sdk-ams.app.123" },
        user: { userId: "user-alexa-test" },
        new: true,
      },
      request: {
        type: "LaunchRequest",
        requestId: "req-1",
        timestamp: new Date().toISOString(),
      },
    };

    const res = await handleAlexaRequest(req);
    expect(res.version).toBe("1.0");
    expect(res.response.outputSpeech.type).toBe("SSML");
    expect(res.response.outputSpeech.ssml).toContain("<speak>");
    expect(res.response.outputSpeech.ssml).toContain("Welcome to Echo Chamber Breaker");
    expect(res.response.shouldEndSession).toBe(false);
  });

  it("handles SteelmanIntent with custom statement and produces voice-compliant SSML", async () => {
    const req: AlexaRequestBody = {
      version: "1.0",
      session: {
        sessionId: "session-2",
        application: { applicationId: "amzn1.echo-sdk-ams.app.123" },
        user: { userId: "user-alexa-test" },
        new: false,
      },
      request: {
        type: "IntentRequest",
        requestId: "req-2",
        timestamp: new Date().toISOString(),
        intent: {
          name: "SteelmanIntent",
          slots: {
            statement: {
              name: "statement",
              value: "Remote work is destroying company culture and productivity.",
            },
          },
        },
      },
    };

    const res = await handleAlexaRequest(req);
    expect(res.response.outputSpeech.ssml).toContain("<speak>");
    expect(res.response.card?.title).toContain("Opposing Case");
    expect(res.response.card?.text).toContain("Core Opposing Thesis");
    expect(res.sessionAttributes?.lastStatement).toBe("Remote work is destroying company culture and productivity.");
  });

  it("handles ConcedeIntent and reports updated honesty score", async () => {
    const req: AlexaRequestBody = {
      version: "1.0",
      session: {
        sessionId: "session-3",
        application: { applicationId: "amzn1.echo-sdk-ams.app.123" },
        user: { userId: "user-alexa-concede-test" },
        new: false,
        attributes: {
          lastTopic: "Future of Work",
        },
      },
      request: {
        type: "IntentRequest",
        requestId: "req-3",
        timestamp: new Date().toISOString(),
        intent: {
          name: "ConcedeIntent",
        },
      },
    };

    const res = await handleAlexaRequest(req);
    expect(res.response.outputSpeech.ssml).toContain("Honesty Score is now");
    expect(res.response.card?.title).toBe("Belief Updated");
  });

  it("handles HonestyReportIntent and returns score and breakdown", async () => {
    const req: AlexaRequestBody = {
      version: "1.0",
      session: {
        sessionId: "session-4",
        application: { applicationId: "amzn1.echo-sdk-ams.app.123" },
        user: { userId: "user-alexa-concede-test" },
        new: false,
      },
      request: {
        type: "IntentRequest",
        requestId: "req-4",
        timestamp: new Date().toISOString(),
        intent: {
          name: "HonestyReportIntent",
        },
      },
    };

    const res = await handleAlexaRequest(req);
    expect(res.response.outputSpeech.ssml).toContain("Intellectual Honesty Score is");
    expect(res.response.card?.title).toBe("Intellectual Honesty Report");
  });
});
