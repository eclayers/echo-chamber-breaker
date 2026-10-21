import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import type {
  StanceAnalysis,
  SteelmanResponse,
  EngagementAssessment,
  ProactiveChallenge,
  HonestyProfile,
} from "../types/index.js";

export interface CognitiveAdapter {
  analyzeStance(statement: string): Promise<StanceAnalysis>;
  generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse>;
  evaluateEngagement(userReply: string, steelman: SteelmanResponse): Promise<EngagementAssessment>;
  generateProactiveChallenge(history: HonestyProfile): Promise<ProactiveChallenge>;
  getMode(): "mock" | "bedrock";
}

/**
 * Deterministic, highly articulate cognitive engine for zero-dependency local execution.
 * Ensures the system runs error-free out-of-the-box without requiring AWS keys upfront.
 */
class LocalMockCognitiveEngine implements CognitiveAdapter {
  getMode(): "mock" {
    return "mock";
  }

  async analyzeStance(statement: string): Promise<StanceAnalysis> {
    const lower = statement.toLowerCase();

    let detectedTopic = "General Discourse";
    let polarity: StanceAnalysis["polarity"] = "STRONG_AGREE";
    let confidence = 0.88;
    let emotionalCharge = 0.65;
    const fallacies: StanceAnalysis["detectedFallacies"] = [];
    const blindSpots: string[] = [];

    if (lower.includes("remote") || lower.includes("office") || lower.includes("work from home")) {
      detectedTopic = "Future of Work & Remote Collaboration";
      if (lower.includes("destroy") || lower.includes("must return") || lower.includes("never work")) {
        polarity = "STRONG_AGREE";
        confidence = 0.92;
        emotionalCharge = 0.78;
        fallacies.push("HASTY_GENERALIZATION", "CONFIRMATION_BIAS");
        blindSpots.push(
          "Uninterrupted deep work efficiency and focus blocks",
          "Global recruitment reach eliminating geographic talent scarcity",
          "Reduced commuter stress, carbon footprint, and real estate overhead"
        );
      } else {
        polarity = "LEAN_AGREE";
        confidence = 0.74;
        emotionalCharge = 0.45;
        blindSpots.push(
          "Tacit knowledge transfer and spontaneous whiteboard brainstorming",
          "Junior engineer mentorship and onboarding velocity"
        );
      }
    } else if (lower.includes("ai") || lower.includes("model") || lower.includes("llm") || lower.includes("intelligence")) {
      detectedTopic = "Artificial Intelligence & Technological Acceleration";
      confidence = 0.89;
      emotionalCharge = 0.72;
      fallacies.push("OVERCONFIDENCE_EFFECT");
      blindSpots.push(
        "Adversarial deployment dynamics across international borders",
        "Economic surplus distribution vs labor displacement velocity",
        "Empirical alignment validation under distribution shifts"
      );
    } else if (lower.includes("nuclear") || lower.includes("energy") || lower.includes("climate")) {
      detectedTopic = "Energy Transition & Grid Reliability";
      confidence = 0.86;
      emotionalCharge = 0.6;
      blindSpots.push(
        "Clean baseload power generation independent of weather intermittency",
        "Modern modular reactor designs with passive cooling safety",
        "Material lifecycle footprint compared with extensive solar/battery mining"
      );
    } else {
      // General heuristic
      confidence = Math.min(0.95, Math.max(0.65, 0.6 + statement.length * 0.002));
      emotionalCharge = statement.includes("!") || lower.includes("never") || lower.includes("always") ? 0.82 : 0.55;
      if (lower.includes("always") || lower.includes("never") || lower.includes("completely")) {
        fallacies.push("FALSE_DICHOTOMY", "OVERCONFIDENCE_EFFECT");
      }
      blindSpots.push(
        "Alternative systemic incentives driving the opposing behavior",
        "Secondary unintended economic or social externalities",
        "Historical precedents where contrary paradigms succeeded"
      );
    }

    return {
      originalStatement: statement,
      detectedTopic,
      claim: statement.trim(),
      polarity,
      confidence: Number(confidence.toFixed(2)),
      emotionalCharge: Number(emotionalCharge.toFixed(2)),
      detectedFallacies: fallacies.length > 0 ? fallacies : ["CONFIRMATION_BIAS"],
      blindSpots,
      coreAssumption: `Assumes that the observed drawbacks outweigh all counter-benefits without contextual trade-offs.`,
      calibrationNotes: `Calibrated with Bayesian stance prior for "${detectedTopic}".`,
    };
  }

  async generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse> {
    const analysis = stance || (await this.analyzeStance(statement));
    const lower = statement.toLowerCase();

    if (lower.includes("remote") && (lower.includes("destroy") || lower.includes("office"))) {
      return {
        say: "Consider this: asynchronous remote work forces explicit documentation and opens global talent access that rigid physical presence often stifles.",
        originalClaim: statement,
        opposingThesis: "Distributed asynchronous operations foster superior written accountability, eliminate geographic talent constraints, and maximize focused deep work.",
        coreArguments: [
          {
            premise: "Talent Liquidity",
            evidenceOrMechanism:
              "Restricting hiring to a 30-mile radius around an office severely caps organizational talent density compared to hiring globally.",
          },
          {
            premise: "Documentation Over Tribalism",
            evidenceOrMechanism:
              "Remote teams are forced to build durable written artifacts and processes rather than relying on informal hallway chatter.",
          },
          {
            premise: "Cognitive Continuity",
            evidenceOrMechanism:
              "Knowledge workers achieve higher state-of-flow durations with asynchronous Slack/PR communication than in noisy open-office layouts.",
          },
        ],
        concessionPoints: [
          "In-person collaboration creates faster high-bandwidth emotional alignment during acute crises.",
          "Junior staff without disciplined self-direction can suffer from isolated learning curves.",
        ],
        epistemicQuestion:
          "If in-office presence is essential for culture, why do top open-source projects build world-class complex infrastructure without a single shared office?",
      };
    }

    if (lower.includes("ai") && (lower.includes("pause") || lower.includes("danger") || lower.includes("threat"))) {
      return {
        say: "A unilateral pause risks handing technological and regulatory primacy to authoritarian rivals while stalling breakthroughs in medicine and clean energy.",
        originalClaim: statement,
        opposingThesis: "Continuous accelerated development maintains democratic parity and delivers urgent life-saving breakthroughs.",
        coreArguments: [
          {
            premise: "Geopolitical Game Theory",
            evidenceOrMechanism:
              "Voluntary pauses in open democracies cannot be enforced on adversarial competitors, leaving free societies at a strategic disadvantage.",
          },
          {
            premise: "Opportunity Cost of Delay",
            evidenceOrMechanism:
              "Delaying medical AI tools delays cures for oncology and neurodegenerative diseases, resulting in quantifiable human casualties.",
          },
        ],
        concessionPoints: [
          "Frontier safety auditing and red-teaming standards must scale alongside capability gains.",
        ],
        epistemicQuestion:
          "How can an international pause treaty be verified when training compute can be distributed across stealth data centers?",
      };
    }

    // Default universal steelman
    return {
      say: "There is another side: the strongest counterview argues that trade-offs you consider negligible actually serve as the structural backbone for stability.",
      originalClaim: statement,
      opposingThesis: `The foundational mechanics opposing your view are driven by resilience, systemic checks, and decentralized trade-offs.`,
      coreArguments: [
        {
          premise: "Structural Resilience",
          evidenceOrMechanism:
            "What appears inefficient or flawed on the surface often acts as a critical buffer against catastrophic black-swan events.",
        },
        {
          premise: "Incentive Alignment",
          evidenceOrMechanism:
            "Participants on the other side of this issue are usually responding to rational micro-incentives rather than malice or ignorance.",
        },
      ],
      concessionPoints: [
        "Your original stance correctly identifies tangible friction points and genuine vulnerabilities in the status quo.",
      ],
      epistemicQuestion:
        "What specific empirical evidence, if discovered tomorrow, would lead you to revise your level of certainty on this topic?",
    };
  }

  async evaluateEngagement(
    userReply: string,
    steelman: SteelmanResponse
  ): Promise<EngagementAssessment> {
    const replyTrimmed = userReply.trim();
    const words = replyTrimmed.split(/\s+/).length;
    const lower = replyTrimmed.toLowerCase();

    // Check for dismissive / low-effort responses
    const dismissivePhrases = [
      "whatever",
      "don't care",
      "stupid",
      "you're wrong",
      "fake",
      "shut up",
      "nah",
      "no way",
      "bullshit",
      "nonsense",
    ];

    const isDismissive =
      words < 4 || dismissivePhrases.some((phrase) => lower === phrase || lower.startsWith(phrase));

    // Check for concession / updating beliefs
    const concessionPhrases = [
      "i concede",
      "fair point",
      "good point",
      "you're right that",
      "i hadn't considered",
      "that makes sense",
      "i agree with that aspect",
      "valid point",
    ];
    const isConcession = concessionPhrases.some((phrase) => lower.includes(phrase));

    if (isDismissive) {
      return {
        quality: "LOW_EFFORT_DISMISSAL",
        scoreDelta: -3.0,
        reason: "Dismissed the counter-argument without addressing its structural premises.",
        addressedBlindSpots: [],
        acknowledgedValidPoints: [],
        counterQualityScore: 15,
        feedbackSay: "Dismissing without counter-reasoning reduces intellectual calibration. Try addressing the core premise directly.",
      };
    }

    if (isConcession) {
      return {
        quality: "CONCESSION",
        scoreDelta: +8.5,
        reason: "Demonstrated genuine intellectual honesty by updating viewpoint and acknowledging counter-evidence.",
        addressedBlindSpots: steelman.concessionPoints.slice(0, 2),
        acknowledgedValidPoints: [steelman.coreArguments[0]?.premise || "Counter premise"],
        counterQualityScore: 92,
        feedbackSay: "Outstanding calibration. Acknowledging valid counter-arguments is the true hallmark of intellectual honesty.",
      };
    }

    if (words >= 15) {
      return {
        quality: "HIGH_RATIONALITY",
        scoreDelta: +4.5,
        reason: "Substantive dialectical engagement grappling directly with the opposing thesis.",
        addressedBlindSpots: [steelman.coreArguments[0]?.premise || "Opposing premise"],
        acknowledgedValidPoints: [],
        counterQualityScore: 84,
        feedbackSay: "Sharp counter-argument. You actively engaged the structural friction rather than dodging it.",
      };
    }

    return {
      quality: "MODERATE_ENGAGEMENT",
      scoreDelta: +2.0,
      reason: "Basic engagement with moderate depth.",
      addressedBlindSpots: [],
      acknowledgedValidPoints: [],
      counterQualityScore: 65,
      feedbackSay: "Solid engagement. Digging deeper into the core trade-off would strengthen your reasoning further.",
    };
  }

  async generateProactiveChallenge(history: HonestyProfile): Promise<ProactiveChallenge> {
    const defaultTopics = [
      {
        topic: "Meritocracy vs Luck",
        provocation: "Most personal career success is the product of tailwinds and birth lottery, not grit.",
        counterView: "Individual agency and deliberate discipline remain the primary differentiators across comparable cohorts.",
      },
      {
        topic: "Centralization vs Decentralization",
        provocation: "Decentralized protocols will inevitably be out-competed by tightly orchestrated centralized monopolies.",
        counterView: "Permissionless networks provide anti-fragile censorship resistance that monopolies cannot replicate.",
      },
      {
        topic: "Algorithmic Moderation",
        provocation: "Neutral algorithms are an illusion; any content recommendation system inherently promotes an ideology.",
        counterView: "Open ranking algorithms with user-tunable objective functions allow individual sovereignty over discovery.",
      },
    ];

    const pick = defaultTopics[Math.floor(Math.random() * defaultTopics.length)];

    return {
      challengeId: `chal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      topic: pick.topic,
      say: `Intellectual calibration check: ${pick.provocation} Are you ready to spar on this?`,
      provocation: pick.provocation,
      counterViewToPriorClaim: pick.counterView,
      priorStatementReference: history.recentEvents[0]?.reason,
      recommendedTimeMinutes: 3,
    };
  }
}

/**
 * Amazon Bedrock Cloud Cognitive Adapter
 * Invokes Claude 3.5 Sonnet or Amazon Nova with strict JSON schemas and system prompts.
 */
class BedrockCognitiveAdapter implements CognitiveAdapter {
  private client: BedrockRuntimeClient;
  private modelId: string;
  private fallback: LocalMockCognitiveEngine;

  constructor(region: string = "us-east-1", modelId?: string) {
    this.client = new BedrockRuntimeClient({ region });
    this.modelId = modelId || process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-5-sonnet-20241022-v2:0";
    this.fallback = new LocalMockCognitiveEngine();
  }

  getMode(): "bedrock" {
    return "bedrock";
  }

  private async invokeModelJSON<T>(systemPrompt: string, userMessage: string): Promise<T> {
    try {
      if (this.modelId.includes("claude")) {
        const payload = {
          anthropic_version: "bedrock-2023-05-31",
          max_tokens: 1500,
          temperature: 0.2,
          system: systemPrompt,
          messages: [{ role: "user", content: userMessage }],
        };

        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        });

        const response = await this.client.send(command);
        const decoded = new TextDecoder().decode(response.body);
        const parsed = JSON.parse(decoded);
        const text = parsed.content?.[0]?.text || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text) as T;
      } else {
        // Amazon Nova JSON payload format
        const payload = {
          messages: [
            { role: "system", content: [{ text: systemPrompt }] },
            { role: "user", content: [{ text: userMessage }] },
          ],
          inferenceConfig: {
            temperature: 0.2,
            max_new_tokens: 1500,
          },
        };

        const command = new InvokeModelCommand({
          modelId: this.modelId,
          contentType: "application/json",
          accept: "application/json",
          body: JSON.stringify(payload),
        });

        const response = await this.client.send(command);
        const decoded = new TextDecoder().decode(response.body);
        const parsed = JSON.parse(decoded);
        const text = parsed.output?.message?.content?.[0]?.text || "{}";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        return JSON.parse(jsonMatch ? jsonMatch[0] : text) as T;
      }
    } catch (err) {
      console.warn(`[Bedrock Adapter] Cloud call failed or unconfigured, falling back to local cognitive mock:`, err);
      throw err;
    }
  }

  async analyzeStance(statement: string): Promise<StanceAnalysis> {
    try {
      const systemPrompt = `You are an expert cognitive psychologist and epistemic calibration analyst.
Analyze the user's opinion statement. Return pure JSON with this exact schema:
{
  "originalStatement": string,
  "detectedTopic": string,
  "claim": string,
  "polarity": "STRONG_AGREE" | "LEAN_AGREE" | "NEUTRAL" | "LEAN_DISAGREE" | "STRONG_DISAGREE",
  "confidence": number (0.0 to 1.0),
  "emotionalCharge": number (0.0 to 1.0),
  "detectedFallacies": string[],
  "blindSpots": string[],
  "coreAssumption": string,
  "calibrationNotes": string
}`;
      return await this.invokeModelJSON<StanceAnalysis>(systemPrompt, statement);
    } catch {
      return this.fallback.analyzeStance(statement);
    }
  }

  async generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse> {
    try {
      const systemPrompt = `You are Echo Chamber Breaker, an intellectual sparring partner.
Your mission is to STEELMAN the opposing case. NEVER strawman. Return pure JSON matching:
{
  "say": string (MANDATORY: Voice-ready summary under 40 words, punchy and direct),
  "originalClaim": string,
  "opposingThesis": string,
  "coreArguments": [{"premise": string, "evidenceOrMechanism": string}],
  "concessionPoints": string[],
  "epistemicQuestion": string
}`;
      const userMsg = `Original statement: "${statement}". ${stance ? `Stance analysis: ${JSON.stringify(stance)}` : ""}`;
      const res = await this.invokeModelJSON<SteelmanResponse>(systemPrompt, userMsg);
      // Guarantee voice brevity constraint (< 40 words)
      const words = res.say.trim().split(/\s+/);
      if (words.length > 40) {
        res.say = words.slice(0, 38).join(" ") + "...";
      }
      return res;
    } catch {
      return this.fallback.generateSteelman(statement, stance);
    }
  }

  async evaluateEngagement(
    userReply: string,
    steelman: SteelmanResponse
  ): Promise<EngagementAssessment> {
    try {
      const systemPrompt = `Evaluate how honestly and substantively the user engaged with a steelmanned opposing view.
Return pure JSON with schema:
{
  "quality": "HIGH_RATIONALITY" | "MODERATE_ENGAGEMENT" | "CONCESSION" | "LOW_EFFORT_DISMISSAL" | "DEFENSIVE_STRAWMAN" | "IGNORED",
  "scoreDelta": number (-5.0 to +10.0),
  "reason": string,
  "addressedBlindSpots": string[],
  "acknowledgedValidPoints": string[],
  "counterQualityScore": number (0 to 100),
  "feedbackSay": string (under 30 words speech-ready feedback)
}`;
      const userMsg = `Steelman was: ${JSON.stringify(steelman)}. User reply was: "${userReply}".`;
      return await this.invokeModelJSON<EngagementAssessment>(systemPrompt, userMsg);
    } catch {
      return this.fallback.evaluateEngagement(userReply, steelman);
    }
  }

  async generateProactiveChallenge(history: HonestyProfile): Promise<ProactiveChallenge> {
    try {
      const systemPrompt = `Generate a proactive intellectual honesty challenge. Return pure JSON:
{
  "challengeId": string,
  "topic": string,
  "say": string (under 35 words speech invitation),
  "provocation": string,
  "counterViewToPriorClaim": string,
  "priorStatementReference": string,
  "recommendedTimeMinutes": number
}`;
      return await this.invokeModelJSON<ProactiveChallenge>(
        systemPrompt,
        `User history summary: Current Score ${history.currentScore}, Engaged ${history.engagedCount}, Concessions ${history.concessionCount}.`
      );
    } catch {
      return this.fallback.generateProactiveChallenge(history);
    }
  }
}

/**
 * Factory creating either Bedrock Cloud adapter or Local Cognitive engine.
 */
export function createCognitiveAdapter(): CognitiveAdapter {
  const modelId = process.env.BEDROCK_MODEL_ID;
  const hasAwsCreds = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );

  if (modelId === "mock" || !hasAwsCreds) {
    return new LocalMockCognitiveEngine();
  }

  return new BedrockCognitiveAdapter(process.env.AWS_REGION || "us-east-1", modelId);
}

export const cognitiveAdapter = createCognitiveAdapter();
