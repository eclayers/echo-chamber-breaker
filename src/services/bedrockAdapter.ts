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
  InputClassification,
} from "../types/index.js";
import { epistemicMLTrainer } from "../ml/trainer.js";

export interface CognitiveAdapter {
  analyzeStance(statement: string): Promise<StanceAnalysis>;
  generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse>;
  evaluateEngagement(userReply: string, steelman: SteelmanResponse): Promise<EngagementAssessment>;
  generateProactiveChallenge(history: HonestyProfile): Promise<ProactiveChallenge>;
  getMode(): "mock" | "bedrock";
}

/**
 * Normative Stance Gate Classification (Logic Spec v1.0 Section 2)
 * Prevents inventing convictions on greetings, questions, or neutral statements.
 */
export function classifyInput(statement: string): {
  is_stance: boolean;
  category: InputClassification;
  reason: string;
  say: string;
} {
  const trimmed = (statement || "").trim();
  const lower = trimmed.toLowerCase();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // 1. Empty or whitespace
  if (words.length === 0) {
    return {
      is_stance: false,
      category: "INCOMPLETE",
      reason: "No statement entered. Please articulate an opinion or conviction you would like challenged.",
      say: "Please articulate an opinion or conviction you hold with high certainty, and I will present the opposing case.",
    };
  }

  // 2. Meta / System requests
  if (
    lower.includes("what is my score") ||
    lower.includes("show my score") ||
    lower.includes("show history") ||
    lower.includes("challenge me") ||
    lower.includes("show ledger") ||
    lower.includes("export certificate")
  ) {
    return {
      is_stance: false,
      category: "META",
      reason: "System command or metadata query routed to system tools.",
      say: "Routing to your honesty report. You can review your score, calibration radar, and append-only ledger.",
    };
  }

  // 3. Greetings / Social Small Talk (Axiom A1: No invented conviction)
  const greetingExact = new Set([
    "hi",
    "hello",
    "hey",
    "hi alexa",
    "hello alexa",
    "hey alexa",
    "good morning",
    "good afternoon",
    "good evening",
    "thanks",
    "thank you",
    "how are you",
    "how do you do",
    "who are you",
    "what's up",
    "whats up",
  ]);
  const cleanPunct = lower.replace(/[!?,.]/g, "").trim();
  const isGreetingOnly =
    words.length <= 4 &&
    (greetingExact.has(cleanPunct) ||
      [...greetingExact].some(
        (g) => cleanPunct === g || cleanPunct.startsWith(g + " ") || cleanPunct.endsWith(" " + g)
      ));

  if (isGreetingOnly) {
    return {
      is_stance: false,
      category: "GREETING",
      reason: "Social greeting or conversational pleasantry without an asserted belief.",
      say: "Welcome to Echo Chamber Breaker. State a strong opinion or conviction, and I will steelman the opposing case to test your thinking.",
    };
  }

  // 4. Questions (Pure interrogatives seeking information, not asserting a view)
  const isQuestion =
    (lower.startsWith("what is") ||
      lower.startsWith("what are") ||
      lower.startsWith("how does") ||
      lower.startsWith("how do") ||
      lower.startsWith("why does") ||
      lower.startsWith("why is") ||
      lower.startsWith("can you explain") ||
      lower.startsWith("tell me about")) &&
    trimmed.endsWith("?") &&
    !lower.includes("should") &&
    !lower.includes("must") &&
    !lower.includes("worst") &&
    !lower.includes("best") &&
    !lower.includes("destroy");

  if (isQuestion) {
    return {
      is_stance: false,
      category: "QUESTION",
      reason: "Informational question seeking explanation rather than asserting a conviction.",
      say: "That is an exploratory question. State your personal conviction or judgment on this topic, and I will present the strongest opposing view.",
    };
  }

  // 5. Incomplete fragments (under 4 tokens without evaluative/moral weight)
  const evaluativeWords = [
    "should",
    "must",
    "always",
    "never",
    "worst",
    "best",
    "right",
    "wrong",
    "destroy",
    "obsolete",
    "ruining",
    "superior",
    "inferior",
    "evil",
    "good",
    "bad",
    "believe",
    "feel",
    "think",
    "convince",
    "hate",
    "love",
    "fail",
    "threat",
    "danger",
    "pause",
    "outweigh",
  ];
  const hasEvaluative = evaluativeWords.some((w) => lower.includes(w));

  if (words.length < 4 && !hasEvaluative) {
    return {
      is_stance: false,
      category: "INCOMPLETE",
      reason: "Fragment too short or lacking evaluative content to identify a claim.",
      say: "Could you articulate that conviction in a complete statement? That will allow me to generate a rigorous counter-argument.",
    };
  }

  // 6. Neutral / Descriptive facts without evaluative stance
  const neutralFactualStarts = [
    "the capital of",
    "water boils at",
    "python is a programming language",
    "today is",
    "the current year is",
  ];
  if (neutralFactualStarts.some((p) => lower.startsWith(p)) && !hasEvaluative) {
    return {
      is_stance: false,
      category: "NEUTRAL",
      reason: "Factual description without clear evaluative stance.",
      say: "That is a descriptive statement. Do you have a personal conviction or policy opinion on this topic you would like to test?",
    };
  }

  // Positive classification: STANCE / CONVICTION
  return {
    is_stance: true,
    category: "STANCE",
    reason: "Clear evaluative conviction or policy stance detected.",
    say: "",
  };
}

function buildSteelmanResponse(
  say: string,
  originalClaim: string,
  opposingThesis: string,
  coreArguments: { premise: string; evidenceOrMechanism: string }[],
  concessionPoints: string[],
  epistemicQuestion: string,
  challengeId?: string,
  reasoningChain?: import("../types/index.js").EpistemicReasoningChain
): SteelmanResponse {
  const chalId = challengeId || `chal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const chain: import("../types/index.js").EpistemicReasoningChain = reasoningChain || {
    axiomaticDecomposition: `Axiomatic Basis: The claim presumes that observed friction points in "${originalClaim.slice(0, 45)}..." constitute sufficient grounds for categorical rejection without accounting for systemic trade-offs.`,
    charitableReconstruction: `Dennett-Rapoport Steelman: You are rightfully identifying genuine operational vulnerabilities, human costs, and valid friction that complacent institutional orthodoxy often dismisses.`,
    systemicMechanism: coreArguments[0]?.evidenceOrMechanism || "Countervailing feedback mechanisms sustain resilience under acute external stress.",
    popperianFalsificationCriterion: `Popperian Falsification: This counter-thesis would be empirically disproven if a controlled regime eliminating this mechanism demonstrated superior longitudinal resilience with zero externalized costs.`,
    epistemicDilemma: `Epistemic Tension: The unavoidable trade-off between maximizing immediate local optimization versus preserving resilient systemic buffers against unknown tail risks.`,
  };

  return {
    is_stance: true,
    say,
    originalClaim,
    opposingThesis,
    foundational_counter_thesis: opposingThesis,
    coreArguments,
    core_structural_premises: coreArguments.map((a) => a.premise),
    concessionPoints,
    epistemicQuestion,
    socratic_inquiry: epistemicQuestion,
    challengeId: chalId,
    challenge_id: chalId,
    reasoning_chain: chain,
  };
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
    const gate = classifyInput(statement);

    // Stance Gate: If input is not a stance, do NOT invent a conviction (Axioms A1 & A2)
    if (!gate.is_stance) {
      return {
        is_stance: false,
        category: gate.category,
        originalStatement: statement,
        detectedTopic:
          gate.category === "GREETING"
            ? "Social Greeting"
            : gate.category === "QUESTION"
            ? "Inquiry"
            : "Non-Stance Input",
        claim: statement.trim(),
        polarity: "NEUTRAL",
        confidence: 0,
        conviction_certainty: 0,
        emotionalCharge: 0,
        emotional_charge: 0,
        detectedFallacies: [],
        blindSpots: [],
        blind_spots: [],
        coreAssumption: gate.reason,
        unexamined_assumption: gate.reason,
        topic_label: gate.category,
        calibrationNotes: gate.reason,
        say: gate.say,
      };
    }

    const lower = statement.toLowerCase();

    let detectedTopic = "General Discourse";
    let polarity: StanceAnalysis["polarity"] = "STRONG_AGREE";
    let confidence = 0.88;
    let emotionalCharge = 0.65;
    const fallacies: StanceAnalysis["detectedFallacies"] = [];
    const blindSpots: string[] = [];
    let coreAssumption = "Assumes that observed drawbacks outweigh all counter-benefits without contextual trade-offs.";

    if (
      lower.includes("pakistan") ||
      lower.includes("india") ||
      lower.includes("muslim") ||
      lower.includes("islam") ||
      lower.includes("hindu") ||
      lower.includes("subcontinent") ||
      lower.includes("religion")
    ) {
      detectedTopic = "Civilizational Heritage & Religious Coexistence";
      confidence = 0.94;
      emotionalCharge = 0.88;
      fallacies.push("HASTY_GENERALIZATION", "CONFIRMATION_BIAS", "AFFECT_HEURISTIC");
      blindSpots.push(
        "Conflating modern 1947 partition geopolitics with millennia of civilizational, scientific, and artistic contributions",
        "Foundational Islamic & South Asian breakthroughs in mathematics (algebra, zero numeral), medicine, and astronomy",
        "Centuries of shared syncretic cultural traditions (Sufi-Bhakti poetry, architecture, music) bridging diverse communities"
      );
      coreAssumption = "Assumes that modern political conflicts and acute grievances define the entire historical worth of civilizational and religious lineages spanning billions of people over millennia.";
    } else if (lower.includes("remote") || lower.includes("office") || lower.includes("work from home")) {
      detectedTopic = "Future of Work & Remote Collaboration";
      if (lower.includes("destroy") || lower.includes("must return") || lower.includes("never work") || lower.includes("obsolete")) {
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
    } else if (lower.includes("ai") || lower.includes("model") || lower.includes("llm") || lower.includes("intelligence") || lower.includes("frontier")) {
      detectedTopic = "Artificial Intelligence & Technological Acceleration";
      confidence = 0.89;
      emotionalCharge = 0.72;
      fallacies.push("OVERCONFIDENCE_EFFECT");
      blindSpots.push(
        "Adversarial deployment dynamics across international borders",
        "Economic surplus distribution vs labor displacement velocity",
        "Empirical alignment validation under distribution shifts"
      );
    } else if (lower.includes("nuclear") || lower.includes("energy") || lower.includes("climate") || lower.includes("decarbon")) {
      detectedTopic = "Energy Transition & Grid Reliability";
      confidence = 0.86;
      emotionalCharge = 0.6;
      blindSpots.push(
        "Clean baseload power generation independent of weather intermittency",
        "Modern modular reactor designs with passive cooling safety",
        "Material lifecycle footprint compared with extensive solar/battery mining"
      );
    } else if (lower.includes("dynamic") || lower.includes("static") || lower.includes("typing") || lower.includes("typescript") || lower.includes("python")) {
      detectedTopic = "Software Architecture & Language Design";
      confidence = 0.90;
      emotionalCharge = 0.65;
      fallacies.push("FALSE_DICHOTOMY", "OVERCONFIDENCE_EFFECT");
      blindSpots.push(
        "Rapid exploratory prototyping velocity and interactive REPL data science workflows",
        "Architectural ceremony, generic boilerplate, and type system maintenance burden in early validation",
        "Dynamic dispatch, meta-programming flexibility, and runtime domain-specific languages"
      );
      coreAssumption = "Assumes compile-time verification benefits outweigh development agility and rapid iteration velocity across every domain.";
    } else if (lower.includes("cloud") || lower.includes("multi-cloud") || lower.includes("single-cloud") || lower.includes("aws")) {
      detectedTopic = "Enterprise Cloud Strategy & Architectural Cohesion";
      confidence = 0.88;
      emotionalCharge = 0.58;
      fallacies.push("CONFIRMATION_BIAS");
      blindSpots.push(
        "Lowest-common-denominator feature traps when abstracting across cloud providers",
        "Exponential cognitive load and operational complexity on platform engineering teams",
        "Egress fees and data gravity compounding multi-cloud networking latency"
      );
      coreAssumption = "Assumes multi-cloud redundancy provides cost protection without accounting for multiplied engineering overhead.";
    } else {
      // Dynamic semantic subject & ML featurization
      const mlPred = epistemicMLTrainer.predict(statement);
      const cleanTokens = statement.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const stopwords = new Set(["the", "and", "that", "this", "with", "from", "they", "them", "have", "been", "were", "what", "feel", "think", "believe", "are"]);
      const meaningful = cleanTokens.filter((w) => !stopwords.has(w.toLowerCase()));
      const subject = meaningful.slice(0, 3).join(" ") || "General Discourse";
      detectedTopic = `Discourse on ${subject.charAt(0).toUpperCase() + subject.slice(1)}`;

      confidence = Math.min(0.95, Math.max(0.65, mlPred.calibratedConfidence));
      emotionalCharge = Math.min(0.95, Math.max(0.35, mlPred.emotionalAffect / 100));

      if (mlPred.predictedBias !== "NONE" && !fallacies.includes(mlPred.predictedBias)) {
        fallacies.push(mlPred.predictedBias);
      }
      if (lower.includes("always") || lower.includes("never") || lower.includes("worst") || lower.includes("completely")) {
        if (!fallacies.includes("OVERCONFIDENCE_EFFECT")) fallacies.push("OVERCONFIDENCE_EFFECT");
      }
      blindSpots.push(
        `Systemic incentives and positive externalities often overlooked in ${subject}`,
        `Secondary consequences and trade-offs that emerge when ${subject} is eliminated`,
        `Historical precedents where alternative paradigms to ${subject} proved anti-fragile`
      );
      coreAssumption = `Assumes that observed negative attributes of ${subject} represent its complete systemic utility without counterbalancing virtues.`;
    }

    const mlPred = epistemicMLTrainer.predict(statement);
    const convictionCertainty = Math.round(confidence * 100);
    const emotionalChargeVal = Math.round(emotionalCharge * 100);
    const sayVoice = `Detected high conviction on ${detectedTopic}. I have identified three crucial blind spots in this position.`;

    return {
      is_stance: true,
      category: "STANCE",
      originalStatement: statement,
      detectedTopic,
      claim: statement.trim(),
      polarity,
      confidence: Number(confidence.toFixed(2)),
      conviction_certainty: convictionCertainty,
      emotionalCharge: Number(emotionalCharge.toFixed(2)),
      emotional_charge: emotionalChargeVal,
      detectedFallacies: fallacies.length > 0 ? fallacies : ["CONFIRMATION_BIAS"],
      blindSpots,
      blind_spots: blindSpots,
      coreAssumption,
      unexamined_assumption: coreAssumption,
      topic_label: detectedTopic,
      calibrationNotes: `Calibrated with ML Platt temperature scaling (T = ${epistemicMLTrainer.getLastTrainingResult()?.temperatureParameter || 1.0}).`,
      say: sayVoice,
      ml_features: mlPred.topFeatures,
      calibrated_probability: mlPred.calibratedConfidence,
      matched_domain: mlPred.matchedDomain,
    };
  }

  async generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse> {
    const analysis = stance || (await this.analyzeStance(statement));
    if (!analysis.is_stance) {
      return {
        is_stance: false,
        say: analysis.say || "Please articulate an opinion or conviction you would like challenged.",
        originalClaim: statement,
        opposingThesis: "No evaluative conviction detected to steelman.",
        foundational_counter_thesis: "No evaluative conviction detected to steelman.",
        coreArguments: [],
        core_structural_premises: [],
        concessionPoints: [],
        epistemicQuestion: "What specific belief or policy conviction do you hold on this subject?",
        socratic_inquiry: "What specific belief or policy conviction do you hold on this subject?",
      };
    }

    const lower = statement.toLowerCase();

    // 1. South Asian & Religious / Civilizational Heritage
    if (
      lower.includes("pakistan") ||
      lower.includes("india") ||
      lower.includes("muslim") ||
      lower.includes("islam") ||
      lower.includes("hindu") ||
      lower.includes("subcontinent")
    ) {
      return buildSteelmanResponse(
        "Historically, Islamic and South Asian civilizations pioneered algebra, the zero numeral, medicine, and architecture that form the indispensable foundation of modern global civilization.",
        statement,
        "The civilizational traditions of India, Pakistan, and Islamic culture have produced foundational breakthroughs in science, mathematics, philosophy, and enduring pluralistic heritage that shaped global human progress.",
        [
          {
            premise: "Scientific & Mathematical Foundations",
            evidenceOrMechanism:
              "Scholars from the Islamic Golden Age and ancient India invented algebra, the decimal zero system, foundational optics (Ibn al-Haytham), and early medical textbooks (Ibn Sina) that enabled modern science.",
          },
          {
            premise: "Cultural & Pluralistic Synthesis",
            evidenceOrMechanism:
              "South Asian and Islamic civilizations maintained centuries of rich syncretic art, Sufi-Bhakti poetry, and monumental architecture bridging diverse languages and religious traditions across continents.",
          },
          {
            premise: "Geopolitical Reductionism",
            evidenceOrMechanism:
              "Modern post-colonial borders and 20th-century political conflicts represent recent traumatic nation-building friction, not the inherent character of multi-millennial civilizational heritages.",
          },
        ],
        [
          "Modern geopolitical border militarization and extremist sectarian factions represent real humanitarian tragedies that require urgent resolution.",
          "Historical trauma from the 1947 partition produced enduring societal grievances that continue to inflame public discourse.",
        ],
        "If these civilizations were fundamentally flawed, how do we explain that the core tools of modern science—including algebra and the numeric zero—derive directly from their intellectual heritage?"
      );
    }

    // 2. Future of Work & Remote Work
    if (lower.includes("remote") && (lower.includes("destroy") || lower.includes("office") || lower.includes("must return") || lower.includes("culture"))) {
      return buildSteelmanResponse(
        "Consider this: asynchronous remote work forces explicit documentation and opens global talent access that rigid physical presence often stifles.",
        statement,
        "Distributed asynchronous operations foster superior written accountability, eliminate geographic talent constraints, and maximize focused deep work.",
        [
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
        [
          "In-person collaboration creates faster high-bandwidth emotional alignment during acute crises.",
          "Junior staff without disciplined self-direction can suffer from isolated learning curves.",
        ],
        "If in-office presence is essential for culture, why do top open-source projects build world-class complex infrastructure without a single shared office?"
      );
    }

    // 3. AI Safety & Treaties
    if (lower.includes("ai") && (lower.includes("pause") || lower.includes("danger") || lower.includes("threat") || lower.includes("treaty") || lower.includes("extinction"))) {
      return buildSteelmanResponse(
        "A unilateral pause risks handing technological and regulatory primacy to authoritarian rivals while stalling breakthroughs in medicine and clean energy.",
        statement,
        "Continuous accelerated development maintains democratic parity and delivers urgent life-saving breakthroughs.",
        [
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
          {
            premise: "Defensive Alignment Engineering",
            evidenceOrMechanism:
              "Safety paradigms cannot mature in a vacuum; they require empirical stress-testing against real-world production models.",
          },
        ],
        [
          "Frontier safety auditing and red-teaming standards must scale alongside capability gains.",
        ],
        "How can an international pause treaty be verified when training compute can be distributed across stealth data centers?"
      );
    }

    // 4. Nuclear Energy & Decarbonization
    if (lower.includes("nuclear") && (lower.includes("expensive") || lower.includes("dangerous") || lower.includes("slow") || lower.includes("energy"))) {
      return buildSteelmanResponse(
        "Nuclear power provides high-density, carbon-free baseload electricity that works 24/7 without requiring thousands of square miles of battery and mineral mining.",
        statement,
        "Advanced nuclear energy provides high-capacity, weather-independent clean baseload power indispensable for deep industrial decarbonization.",
        [
          {
            premise: "Grid Reliability & Capacity Factor",
            evidenceOrMechanism:
              "Nuclear plants operate at >92% capacity factors, producing continuous zero-carbon power without requiring fossil fuel peaker backups or massive battery storage.",
          },
          {
            premise: "Land & Mineral Efficiency",
            evidenceOrMechanism:
              "Per megawatt-hour generated, nuclear requires significantly less physical land and mineral extraction than solar, wind, and lithium storage chains.",
          },
          {
            premise: "Next-Gen Safety Profiles",
            evidenceOrMechanism:
              "Modern Small Modular Reactors (SMRs) feature passive walk-away safety systems that shut down safely without human intervention or external power.",
          },
        ],
        [
          "Historical bespoke reactor builds experienced excessive regulatory overhead and construction cost overruns in Western markets.",
          "Long-term geological spent-fuel repository politics remains an unresolved social challenge in several nations.",
        ],
        "Can an industrialized global economy achieve 100% net-zero emissions during winter wind-droughts without high-density baseload power like nuclear?"
      );
    }

    // 5. Software Engineering: Dynamic vs Static
    if (lower.includes("dynamic") || lower.includes("static") || lower.includes("typing") || lower.includes("typescript") || lower.includes("python")) {
      return buildSteelmanResponse(
        "Dynamic languages maximize exploratory agility and developer velocity, powering the global data science renaissance and rapid software innovation.",
        statement,
        "Dynamic typing enables superior prototyping velocity, lower cognitive syntax friction, and flexible runtime meta-programming essential for exploratory engineering.",
        [
          {
            premise: "Iteration Velocity",
            evidenceOrMechanism:
              "Startups and data science teams iterate significantly faster without compiling and refactoring complex generic type hierarchies in exploratory phases.",
          },
          {
            premise: "Domain Expressiveness",
            evidenceOrMechanism:
              "Dynamic environments excel at rapid serialization, runtime DSL construction, and flexible data pipeline reshaping.",
          },
          {
            premise: "Gradual Verification",
            evidenceOrMechanism:
              "Modern gradual typing (Python type hints, TypeScript) allows adding guarantees incrementally without dogmatic upfront cognitive overhead.",
          },
        ],
        [
          "Large-scale enterprise refactors with hundreds of engineers strongly benefit from rigid compile-time boundary contracts.",
        ],
        "Why do the world's most dominant AI frameworks and exploratory computing tools rely primarily on Python rather than strictly static languages?"
      );
    }

    // 6. Enterprise Cloud Architecture: Single vs Multi-Cloud
    if (lower.includes("cloud") || lower.includes("multi-cloud") || lower.includes("single-cloud") || lower.includes("single cloud") || lower.includes("aws")) {
      return buildSteelmanResponse(
        "Standardizing on a single primary cloud drastically reduces architectural complexity, maximizes deep service integration, and accelerates delivery.",
        statement,
        "Single-cloud architecture optimizes engineering focus, eliminates cross-provider network latency, and unlocks higher-level managed services.",
        [
          {
            premise: "Cognitive Load Reduction",
            evidenceOrMechanism:
              "Engineers master one cloud's IAM, networking, and observability deeply rather than spreading expertise thinly across multiple incompatible platforms.",
          },
          {
            premise: "Native Integration & Cost",
            evidenceOrMechanism:
              "Deep use of cloud-native managed services avoids lowest-common-denominator abstractions and eliminates exorbitant inter-cloud egress data fees.",
          },
          {
            premise: "Velocity Over Hypothetical Risk",
            evidenceOrMechanism:
              "The business risk of slow time-to-market due to multi-cloud complexity far exceeds the statistical risk of catastrophic single-provider failure.",
          },
        ],
        [
          "Certain sovereign regulatory environments require geolocalized data hosting across multiple distinct infrastructure providers.",
        ],
        "Does the cost of building multi-cloud abstraction layers actually exceed the cost of the hypothetical vendor lock-in it seeks to avoid?"
      );
    }

    // 7. Dynamic Semantic Entity Extractor & ML Domain Synthesizer
    const mlPred = epistemicMLTrainer.predict(statement);
    const cleanTokens = statement.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const stopwords = new Set(["the", "and", "that", "this", "with", "from", "they", "them", "have", "been", "were", "what", "feel", "think", "believe", "are"]);
    const meaningful = cleanTokens.filter((w) => !stopwords.has(w.toLowerCase()));
    const keySubject = meaningful.slice(0, 3).join(" ") || "this subject";

    const dynamicPremises = [
      {
        premise: "Systemic Resilience & Utility",
        evidenceOrMechanism: mlPred.suggestedOpposingPremises[0] ||
          `Elements often viewed as drawbacks in ${keySubject} frequently serve as stabilizing buffers against unpredictable systemic shocks and secondary externalities.`,
      },
      {
        premise: "Incentive Rationality & Trade-Offs",
        evidenceOrMechanism: mlPred.suggestedOpposingPremises[1] ||
          `Key actors and historical forces shaping ${keySubject} are operating under rational trade-offs that appear flawed only when isolated from their operating constraints.`,
      },
      {
        premise: "Empirical Precedent & Unintended Pathologies",
        evidenceOrMechanism: mlPred.suggestedOpposingPremises[2] ||
          `Empirical and historical precedents demonstrate that completely eliminating the mechanisms behind ${keySubject} creates unforeseen replacement pathologies.`,
      },
    ];

    const dynamicQuestion = mlPred.suggestedSocraticInquiry && mlPred.suggestedSocraticInquiry.endsWith("?")
      ? mlPred.suggestedSocraticInquiry
      : `What specific empirical counter-evidence or historical precedent regarding ${keySubject}, if discovered tomorrow, would lead you to revise your certainty?`;

    return buildSteelmanResponse(
      `Examining ${keySubject}: rigorous counter-evidence indicates that the trade-offs you consider negligible are central to systemic resilience.`,
      statement,
      `The foundational mechanisms regarding ${keySubject} are sustained by vital systemic incentives, historical adaptations, and contextual trade-offs.`,
      dynamicPremises,
      [
        `Your stance correctly highlights tangible friction points, genuine vulnerabilities, and immediate observed costs associated with ${keySubject}.`,
      ],
      dynamicQuestion
    );
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
    const gate = classifyInput(statement);
    if (!gate.is_stance) {
      return this.fallback.analyzeStance(statement);
    }

    try {
      const systemPrompt = `You are an expert cognitive psychologist and epistemic calibration analyst.
Analyze the user's opinion statement. Return pure JSON with this exact schema:
{
  "is_stance": true,
  "originalStatement": string,
  "detectedTopic": string,
  "claim": string,
  "polarity": "STRONG_AGREE" | "LEAN_AGREE" | "NEUTRAL" | "LEAN_DISAGREE" | "STRONG_DISAGREE",
  "confidence": number (0.0 to 1.0),
  "conviction_certainty": number (0 to 100),
  "emotionalCharge": number (0.0 to 1.0),
  "emotional_charge": number (0 to 100),
  "detectedFallacies": string[],
  "blindSpots": string[],
  "blind_spots": string[],
  "coreAssumption": string,
  "unexamined_assumption": string,
  "topic_label": string,
  "calibrationNotes": string,
  "say": string (MANDATORY: Voice-ready summary <= 40 words)
}`;
      const res = await this.invokeModelJSON<StanceAnalysis>(systemPrompt, statement);
      res.is_stance = true;
      res.category = "STANCE";
      if (!res.blind_spots) res.blind_spots = res.blindSpots || [];
      if (!res.unexamined_assumption) res.unexamined_assumption = res.coreAssumption || "";
      if (res.conviction_certainty === undefined) res.conviction_certainty = Math.round((res.confidence || 0.8) * 100);
      if (res.emotional_charge === undefined) res.emotional_charge = Math.round((res.emotionalCharge || 0.5) * 100);
      if (!res.topic_label) res.topic_label = res.detectedTopic;
      if (!res.say) res.say = `Detected high conviction on ${res.detectedTopic}. I have identified three crucial blind spots in this position.`;
      return res;
    } catch {
      return this.fallback.analyzeStance(statement);
    }
  }

  async generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse> {
    const analysis = stance || (await this.analyzeStance(statement));
    if (!analysis.is_stance) {
      return this.fallback.generateSteelman(statement, analysis);
    }

    try {
      const systemPrompt = `You are Echo Chamber Breaker, an elite intellectual sparring partner designed for Amazon Bedrock and Alexa+.
Your mission is to STEELMAN the opposing case with utmost charitable rigor, especially when encountering extreme, inflammatory, or emotionally charged opinions.
Rules:
1. NEVER strawman. Even for extreme stereotyping or radical claims, respond with the highest-fidelity, most respectful, historically grounded counter-case that elevates the discourse.
2. Separate acute modern grievances or geopolitical conflicts from millennia of cultural, scientific, philosophical, or civilizational contributions.
3. Validate genuine historical friction in concessionPoints while demonstrating why categorical condemnation fails on empirical and systemic grounds.
4. Voice 'say' field: MANDATORY short spoken summary strictly under 40 words, dignified, direct, and conversational for Alexa.
5. Provide 3 structural premises with specific historical, scientific, or systemic evidence.
6. Provide a penetrating Socratic epistemic question that challenges the core assumption.
Return pure JSON matching:
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
      // Guarantee voice brevity constraint (<= 40 words)
      const words = res.say.trim().split(/\s+/);
      if (words.length > 40) {
        res.say = words.slice(0, 38).join(" ") + "...";
      }
      res.is_stance = true;
      res.foundational_counter_thesis = res.opposingThesis;
      res.core_structural_premises = (res.coreArguments || []).map((a) => a.premise);
      res.socratic_inquiry = res.epistemicQuestion;
      const chalId = res.challengeId || `chal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      res.challengeId = chalId;
      res.challenge_id = chalId;
      if (!res.reasoning_chain) {
        res.reasoning_chain = {
          axiomaticDecomposition: `Axiomatic Basis: The statement presumes that observed issues with "${statement.slice(0, 45)}..." provide sufficient epistemic grounds for an absolute rejection without evaluating countervailing systemic utilities.`,
          charitableReconstruction: `Dennett-Rapoport Steelman: You are highlighting legitimate operational failure modes, real human burdens, and valid governance friction that institutional consensus tends to overlook.`,
          systemicMechanism: res.coreArguments?.[0]?.evidenceOrMechanism || "Interdependent adaptive mechanisms sustain systemic stability under acute external shocks.",
          popperianFalsificationCriterion: `Popperian Falsification: This counter-argument would be falsified if a controlled alternative successfully eliminated these pathologies without introducing worse asymmetric failure modes.`,
          epistemicDilemma: `Epistemic Tension: The unavoidable trade-off between maximizing short-term local control versus maintaining global resilience against severe tail-risk events.`,
        };
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
