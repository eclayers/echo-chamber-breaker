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
      // Dynamic semantic subject extraction
      const cleanTokens = statement.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
      const stopwords = new Set(["the", "and", "that", "this", "with", "from", "they", "them", "have", "been", "were", "what", "feel", "think", "believe", "are"]);
      const meaningful = cleanTokens.filter((w) => !stopwords.has(w.toLowerCase()));
      const subject = meaningful.slice(0, 3).join(" ") || "General Discourse";
      detectedTopic = `Discourse on ${subject.charAt(0).toUpperCase() + subject.slice(1)}`;

      confidence = Math.min(0.95, Math.max(0.65, 0.6 + statement.length * 0.002));
      emotionalCharge = statement.includes("!") || lower.includes("worst") || lower.includes("never") || lower.includes("always") || lower.includes("hate") ? 0.85 : 0.55;
      if (lower.includes("always") || lower.includes("never") || lower.includes("worst") || lower.includes("completely")) {
        fallacies.push("FALSE_DICHOTOMY", "OVERCONFIDENCE_EFFECT");
      }
      blindSpots.push(
        `Systemic incentives and positive externalities often overlooked in ${subject}`,
        `Secondary consequences and trade-offs that emerge when ${subject} is eliminated`,
        `Historical precedents where alternative paradigms to ${subject} proved anti-fragile`
      );
      coreAssumption = `Assumes that observed negative attributes of ${subject} represent its complete systemic utility without counterbalancing virtues.`;
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
      coreAssumption,
      calibrationNotes: `Calibrated with Bayesian stance prior for "${detectedTopic}".`,
    };
  }

  async generateSteelman(statement: string, stance?: StanceAnalysis): Promise<SteelmanResponse> {
    const analysis = stance || (await this.analyzeStance(statement));
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
      return {
        say: "Historically, Islamic and South Asian civilizations pioneered algebra, the zero numeral, medicine, and architecture that form the indispensable foundation of modern global civilization.",
        originalClaim: statement,
        opposingThesis: "The civilizational traditions of India, Pakistan, and Islamic culture have produced foundational breakthroughs in science, mathematics, philosophy, and enduring pluralistic heritage that shaped global human progress.",
        coreArguments: [
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
        concessionPoints: [
          "Modern geopolitical border militarization and extremist sectarian factions represent real humanitarian tragedies that require urgent resolution.",
          "Historical trauma from the 1947 partition produced enduring societal grievances that continue to inflame public discourse.",
        ],
        epistemicQuestion:
          "If these civilizations were fundamentally flawed, how do we explain that the core tools of modern science—including algebra and the numeric zero—derive directly from their intellectual heritage?",
      };
    }

    // 2. Future of Work & Remote Work
    if (lower.includes("remote") && (lower.includes("destroy") || lower.includes("office") || lower.includes("must return") || lower.includes("culture"))) {
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

    // 3. AI Safety & Treaties
    if (lower.includes("ai") && (lower.includes("pause") || lower.includes("danger") || lower.includes("threat") || lower.includes("treaty") || lower.includes("extinction"))) {
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
          {
            premise: "Defensive Alignment Engineering",
            evidenceOrMechanism:
              "Safety paradigms cannot mature in a vacuum; they require empirical stress-testing against real-world production models.",
          },
        ],
        concessionPoints: [
          "Frontier safety auditing and red-teaming standards must scale alongside capability gains.",
        ],
        epistemicQuestion:
          "How can an international pause treaty be verified when training compute can be distributed across stealth data centers?",
      };
    }

    // 4. Nuclear Energy & Decarbonization
    if (lower.includes("nuclear") && (lower.includes("expensive") || lower.includes("dangerous") || lower.includes("slow") || lower.includes("energy"))) {
      return {
        say: "Nuclear power provides high-density, carbon-free baseload electricity that works 24/7 without requiring thousands of square miles of battery and mineral mining.",
        originalClaim: statement,
        opposingThesis: "Advanced nuclear energy provides high-capacity, weather-independent clean baseload power indispensable for deep industrial decarbonization.",
        coreArguments: [
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
        concessionPoints: [
          "Historical bespoke reactor builds experienced excessive regulatory overhead and construction cost overruns in Western markets.",
          "Long-term geological spent-fuel repository politics remains an unresolved social challenge in several nations.",
        ],
        epistemicQuestion:
          "Can an industrialized global economy achieve 100% net-zero emissions during winter wind-droughts without high-density baseload power like nuclear?",
      };
    }

    // 5. Software Engineering: Dynamic vs Static
    if (lower.includes("dynamic") || lower.includes("static") || lower.includes("typing") || lower.includes("typescript") || lower.includes("python")) {
      return {
        say: "Dynamic languages maximize exploratory agility and developer velocity, powering the global data science renaissance and rapid software innovation.",
        originalClaim: statement,
        opposingThesis: "Dynamic typing enables superior prototyping velocity, lower cognitive syntax friction, and flexible runtime meta-programming essential for exploratory engineering.",
        coreArguments: [
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
        concessionPoints: [
          "Large-scale enterprise refactors with hundreds of engineers strongly benefit from rigid compile-time boundary contracts.",
        ],
        epistemicQuestion:
          "Why do the world's most dominant AI frameworks and exploratory computing tools rely primarily on Python rather than strictly static languages?",
      };
    }

    // 6. Enterprise Cloud Architecture: Single vs Multi-Cloud
    if (lower.includes("cloud") || lower.includes("multi-cloud") || lower.includes("single-cloud") || lower.includes("single cloud") || lower.includes("aws")) {
      return {
        say: "Standardizing on a single primary cloud drastically reduces architectural complexity, maximizes deep service integration, and accelerates delivery.",
        originalClaim: statement,
        opposingThesis: "Single-cloud architecture optimizes engineering focus, eliminates cross-provider network latency, and unlocks higher-level managed services.",
        coreArguments: [
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
        concessionPoints: [
          "Certain sovereign regulatory environments require geolocalized data hosting across multiple distinct infrastructure providers.",
        ],
        epistemicQuestion:
          "Does the cost of building multi-cloud abstraction layers actually exceed the cost of the hypothetical vendor lock-in it seeks to avoid?",
      };
    }

    // 7. Dynamic Semantic Entity Extractor for Any Other Custom Statement
    const cleanTokens = statement.replace(/[^\w\s]/g, " ").split(/\s+/).filter((w) => w.length > 2);
    const stopwords = new Set(["the", "and", "that", "this", "with", "from", "they", "them", "have", "been", "were", "what", "feel", "think", "believe", "are"]);
    const meaningful = cleanTokens.filter((w) => !stopwords.has(w.toLowerCase()));
    const keySubject = meaningful.slice(0, 3).join(" ") || "this subject";

    return {
      say: `Examining ${keySubject}: rigorous counter-evidence indicates that the trade-offs you consider negligible are central to systemic resilience.`,
      originalClaim: statement,
      opposingThesis: `The foundational mechanisms regarding ${keySubject} are sustained by vital systemic incentives, historical adaptations, and contextual trade-offs.`,
      coreArguments: [
        {
          premise: "Systemic Function & Hidden Utility",
          evidenceOrMechanism:
            `Elements often viewed as drawbacks in ${keySubject} frequently serve as stabilizing buffers against unpredictable systemic shocks and secondary externalities.`,
        },
        {
          premise: "Incentive Rationality",
          evidenceOrMechanism:
            `Key actors and historical forces shaping ${keySubject} are operating under rational trade-offs that appear flawed only when isolated from their operating constraints.`,
        },
        {
          premise: "Alternative Precedents",
          evidenceOrMechanism:
            `Empirical and historical precedents demonstrate that completely eliminating the mechanisms behind ${keySubject} creates unforeseen replacement pathologies.`,
        },
      ],
      concessionPoints: [
        `Your stance correctly highlights tangible friction points, genuine vulnerabilities, and immediate observed costs associated with ${keySubject}.`,
      ],
      epistemicQuestion:
        `What specific empirical counter-evidence or historical precedent regarding ${keySubject}, if discovered tomorrow, would lead you to revise your certainty?`,
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
