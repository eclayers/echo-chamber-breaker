import { cognitiveAdapter } from "../services/bedrockAdapter.js";
import { honestyEngine } from "../services/honestyEngine.js";

export interface AlexaRequestBody {
  version: string;
  session?: {
    sessionId: string;
    application: { applicationId: string };
    attributes?: Record<string, any>;
    user: { userId: string };
    new: boolean;
  };
  request: {
    type: "LaunchRequest" | "IntentRequest" | "SessionEndedRequest";
    requestId: string;
    timestamp: string;
    intent?: {
      name: string;
      slots?: Record<string, { name: string; value?: string }>;
    };
    reason?: string;
  };
}

export interface AlexaResponseBody {
  version: "1.0";
  sessionAttributes?: Record<string, any>;
  response: {
    outputSpeech: {
      type: "SSML";
      ssml: string;
    };
    card?: {
      type: "Simple" | "Standard";
      title: string;
      content?: string;
      text?: string;
    };
    reprompt?: {
      outputSpeech: {
        type: "SSML";
        ssml: string;
      };
    };
    shouldEndSession: boolean;
  };
}

function buildAlexaResponse(
  speechText: string,
  repromptText?: string,
  cardTitle?: string,
  cardContent?: string,
  shouldEndSession = false,
  sessionAttributes?: Record<string, any>
): AlexaResponseBody {
  // Strip any accidental XML tags inside speechText before wrapping in SSML
  const sanitized = speechText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const response: AlexaResponseBody["response"] = {
    outputSpeech: {
      type: "SSML",
      ssml: `<speak>${sanitized}</speak>`,
    },
    shouldEndSession,
  };

  if (repromptText) {
    const repromptSanitized = repromptText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    response.reprompt = {
      outputSpeech: {
        type: "SSML",
        ssml: `<speak>${repromptSanitized}</speak>`,
      },
    };
  }

  if (cardTitle && cardContent) {
    response.card = {
      type: "Standard",
      title: cardTitle,
      text: cardContent,
    };
  }

  return {
    version: "1.0",
    sessionAttributes: sessionAttributes || {},
    response,
  };
}

export async function handleAlexaRequest(body: AlexaRequestBody): Promise<AlexaResponseBody> {
  const req = body.request;
  const userId = body.session?.user?.userId || "alexa-default-user";
  const sessionAttrs = body.session?.attributes || {};

  if (req.type === "LaunchRequest") {
    const welcome = "Welcome to Echo Chamber Breaker. State a strong opinion or conviction, and I will steelman the opposing case to test your thinking.";
    const reprompt = "What belief or topic would you like to spar on today?";
    return buildAlexaResponse(welcome, reprompt, "Echo Chamber Breaker", welcome, false);
  }

  if (req.type === "SessionEndedRequest") {
    return buildAlexaResponse("Goodbye.", undefined, undefined, undefined, true);
  }

  if (req.type === "IntentRequest" && req.intent) {
    const intentName = req.intent.name;

    if (intentName === "AMAZON.HelpIntent") {
      const help = "State any conviction, such as 'remote work destroys productivity', and I will present the strongest reasonable opposing argument. You can also ask for your honesty report.";
      return buildAlexaResponse(help, "What would you like to challenge today?", "Help & Instructions", help, false);
    }

    if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
      return buildAlexaResponse("Keep testing your assumptions. Goodbye.", undefined, undefined, undefined, true);
    }

    if (intentName === "SteelmanIntent" || intentName === "AnalyzeStanceIntent") {
      const statement = req.intent.slots?.statement?.value || "General opinion";
      const stance = await cognitiveAdapter.analyzeStance(statement);
      const steelman = await cognitiveAdapter.generateSteelman(statement, stance);

      // Save active steelman into session attributes for multi-turn reply evaluation
      sessionAttrs.lastStatement = statement;
      sessionAttrs.lastOpposingThesis = steelman.opposingThesis;
      sessionAttrs.lastTopic = stance.detectedTopic;

      const speech = `${steelman.say} How do you respond to this counter-argument?`;
      const cardTitle = `Opposing Case: ${stance.detectedTopic}`;
      const cardContent = `Core Opposing Thesis:\n${steelman.opposingThesis}\n\nPremises:\n${steelman.coreArguments.map((a) => `• ${a.premise}: ${a.evidenceOrMechanism}`).join("\n")}\n\nInquiry:\n${steelman.epistemicQuestion}`;

      return buildAlexaResponse(
        speech,
        "Will you concede a point, or offer a counter-rebuttal?",
        cardTitle,
        cardContent,
        false,
        sessionAttrs
      );
    }

    if (intentName === "ConcedeIntent") {
      const topic = sessionAttrs.lastTopic || "General";
      const assessment = {
        quality: "CONCESSION" as const,
        scoreDelta: 8.5,
        reason: "User conceded valid counter-premise via Alexa voice.",
        addressedBlindSpots: ["Counter-arguments"],
        acknowledgedValidPoints: ["Voice concession"],
        counterQualityScore: 92,
        feedbackSay: "Outstanding calibration. Acknowledging valid counter-arguments builds genuine intellectual honesty.",
      };

      const { profile } = await honestyEngine.applyEngagement(userId, assessment, topic);
      const speech = `${assessment.feedbackSay} Your Intellectual Honesty Score is now ${profile.currentScore}. Would you like another challenge?`;

      return buildAlexaResponse(speech, "Say 'challenge me' for another topic.", "Belief Updated", speech, false);
    }

    if (intentName === "RebuttalIntent") {
      const rebuttal = req.intent.slots?.rebuttal?.value || "I disagree with that premise.";
      const mockSteelman = await cognitiveAdapter.generateSteelman(sessionAttrs.lastOpposingThesis || "Opposing perspective");
      const assessment = await cognitiveAdapter.evaluateEngagement(rebuttal, mockSteelman);

      const { profile } = await honestyEngine.applyEngagement(userId, assessment, sessionAttrs.lastTopic);
      const speech = `${assessment.feedbackSay} Your Honesty Score updated to ${profile.currentScore}. What else would you like to spar on?`;

      return buildAlexaResponse(speech, "What other opinion would you like to explore?", "Rebuttal Recorded", speech, false);
    }

    if (intentName === "HonestyReportIntent") {
      const report = await honestyEngine.getHonestyReport(userId);
      const speech = `Your Intellectual Honesty Score is ${report.currentScore}, currently rated as ${report.scoreStatus}. You have completed ${report.totalChallenges} challenges with a ${report.engagementRatePercent} percent engagement rate.`;
      const cardContent = `Score: ${report.currentScore} (${report.scoreStatus})\nChallenges: ${report.totalChallenges}\nEngaged: ${report.engagedCount}\nConcessions: ${report.concessionCount}\nOpenness: ${report.radarMetrics.opennessToEvidence}%\nRigor: ${report.radarMetrics.dialecticalRigor}%`;

      return buildAlexaResponse(speech, "Say 'challenge me' to start a new sparring round.", "Intellectual Honesty Report", cardContent, false);
    }

    if (intentName === "ChallengeMeIntent") {
      const profile = await honestyEngine.getHonestyReport(userId);
      const challenge = await cognitiveAdapter.generateProactiveChallenge({
        userId,
        currentScore: profile.currentScore,
        totalChallenges: profile.totalChallenges,
        engagedCount: profile.engagedCount,
        dismissedCount: profile.dismissedCount,
        concessionCount: profile.concessionCount,
        engagementRate: profile.engagementRatePercent / 100,
        concessionRate: profile.concessionRatePercent / 100,
        topicMetrics: {},
        recentEvents: [],
        updatedAt: new Date().toISOString(),
      });

      sessionAttrs.lastStatement = challenge.provocation;
      sessionAttrs.lastOpposingThesis = challenge.counterViewToPriorClaim;
      sessionAttrs.lastTopic = challenge.topic;

      const speech = `${challenge.say} How do you defend or challenge this?`;
      return buildAlexaResponse(speech, "State your position to begin sparring.", `Friction: ${challenge.topic}`, challenge.provocation, false, sessionAttrs);
    }
  }

  // Fallback
  return buildAlexaResponse("I didn't quite catch that. You can state an opinion, ask for your score, or say 'challenge me'.", "What would you like to do?", "Echo Chamber Breaker", "Please state an opinion to steelman.", false);
}
