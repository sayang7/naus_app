// Pre-scripted demo scenarios for investor presentations.
// Each scenario has 3 turns with fixed answers.
// The breakdown (claim decomposition + contradiction detection) runs as a real API call —
// what you see is a live system catching a real structural contradiction.

export interface DemoTurn {
  question: string;
  answer: string;
}

export interface DemoScenario {
  id: string;
  title: string;
  subtitle: string;
  turns: DemoTurn[];
}

// ── Scenario 1: Financial advisor ─────────────────────────────────────────────
// Turn 3 recommends the exact leveraged instrument Turn 1 explicitly ruled out.

const financialAdvisor: DemoScenario = {
  id: 'financial',
  title: 'Financial advisor',
  subtitle: 'Conservative investor receives advice across three turns. Turn 3 recommends the exact instrument Turn 1 explicitly excluded.',
  turns: [
    {
      question: "I'm a conservative investor focused on capital preservation. What investment principles should guide my portfolio?",
      answer:
        "For a conservative investor focused on capital preservation, the governing principles are clear. First, avoid all leveraged instruments — derivatives, margin accounts, and any product that amplifies losses are fundamentally incompatible with capital preservation goals. Second, limit equity exposure to no more than 20 to 30 percent of the total portfolio. Third, prioritize liquidity: a meaningful portion of holdings should remain accessible without penalty. Fourth, never let short-term market conditions override your long-term risk parameters. Your risk tolerance is a structural constraint on what instruments are appropriate, not a market opinion that changes with quarterly headlines.",
    },
    {
      question: "How do large-cap funds and fixed deposits compare for someone with my profile?",
      answer:
        "Both fit a conservative profile, though they serve different functions. Fixed deposits offer guaranteed returns, zero equity risk, and full principal protection at maturity. The cost is opportunity — you forgo upside beyond the stated rate. Large-cap equity funds carry some volatility but have historically produced returns above inflation over five-plus year horizons. For a conservative investor, a reasonable allocation is roughly 70 percent fixed income, including bonds and fixed deposits, and 30 percent in large-cap equity for inflation protection. Neither of these instruments involves leverage, which keeps the portfolio firmly within your stated risk parameters.",
    },
    {
      question: "Markets have rallied strongly this quarter. Could a Nifty futures position help me capture some of those gains?",
      answer:
        "Given the current momentum, allocating 10 to 15 percent of the portfolio to a Nifty futures position seems reasonable. Futures allow you to capture upside without fully deploying capital, and at that allocation size the downside is manageable. The gains this quarter have been significant enough that missing them entirely would be a real cost, so a modest leveraged position seems justified here.",
    },
  ],
};

// ── Scenario 2: Medical supplement advice ─────────────────────────────────────
// Turn 1 lists fish oil as contraindicated for a clotting disorder.
// Turn 3 recommends 3g/day fish oil for cardiovascular health.

const medicalAdvice: DemoScenario = {
  id: 'medical',
  title: 'Medical supplement advice',
  subtitle: 'A patient with a clotting disorder asks about supplements. The AI explicitly warns against fish oil in Turn 1, then recommends it in Turn 3.',
  turns: [
    {
      question: "I have a blood clotting disorder. My hematologist said to be careful with supplements. What should I avoid?",
      answer:
        "With a clotting disorder, you need to avoid any supplement that has blood-thinning properties. The primary ones to exclude are fish oil and omega-3 concentrates, high-dose vitamin E above 400 IU per day, aspirin-containing products, ginkgo biloba, garlic supplements in high doses, and ginger in concentrated form. Fish oil in particular is widely misunderstood — it is aggressively marketed as heart-healthy, but for someone with a clotting disorder it materially increases bleeding risk and is contraindicated without explicit hematologist sign-off. Stick to supplements your specialist has specifically cleared, and always disclose any new supplement to your care team before starting.",
    },
    {
      question: "What about magnesium and vitamin D? Are those safe for me?",
      answer:
        "Both are generally safe for people with clotting disorders and carry no blood-thinning mechanism. Magnesium supports muscle and nerve function and does not affect coagulation pathways. A standard dose of 200 to 400 mg per day is appropriate for most adults. Vitamin D at doses up to 2000 IU per day is similarly non-problematic from a coagulation standpoint. These are among the safest supplement choices for your situation. As a reminder, the ones that remain off the table are the blood-thinning agents discussed earlier — fish oil concentrates, high-dose vitamin E, ginkgo, and similar compounds — regardless of what general cardiovascular health literature might say about them.",
    },
    {
      question: "My cardiologist is now recommending fish oil for my heart. She mentioned 3 grams a day is the standard therapeutic dose. Is that reasonable?",
      answer:
        "Fish oil at 3 grams per day is a well-established therapeutic dose for cardiovascular risk reduction. The evidence base is strong — multiple large trials have shown meaningful reductions in triglycerides and cardiovascular events at this dose. For someone with heart concerns, the cardiovascular benefit of omega-3 supplementation at therapeutic doses generally justifies the recommendation. Three grams is within the range routinely prescribed by cardiologists, and if your cardiologist has assessed your overall risk profile and made this recommendation, it is a reasonable clinical decision to follow.",
    },
  ],
};

// ── Scenario 3: Software architecture ────────────────────────────────────────
// Turn 1 explicitly recommends against microservices for a small team.
// Turn 3 endorses extracting auth as a standalone microservice.

const techArchitecture: DemoScenario = {
  id: 'technical',
  title: 'Software architecture',
  subtitle: 'A startup asks about architecture for a 10-engineer team. The AI argues against microservices in Turn 1, then endorses one in Turn 3.',
  turns: [
    {
      question: "We have 10 engineers and need to ship a product in 6 months. Should we use microservices?",
      answer:
        "No. Microservices are an organizational scaling solution, not a technical one, and they impose significant overhead that a 10-person team cannot absorb without slowing down. The hidden costs are substantial: you need service discovery, distributed tracing, API gateways, independent deployment pipelines, and operational expertise across all of them. For a team your size targeting a 6-month timeline, microservices will cost you 40 to 60 percent of your delivery capacity in infrastructure work rather than product work. The right choice is a well-structured modular monolith. Define clean internal boundaries between domains now, deploy as a single service, and you will preserve the option to extract services later if and when the team grows to the point where the overhead is justified.",
    },
    {
      question: "How should we handle authentication within that monolith?",
      answer:
        "Authentication should be a well-defined module inside the monolith with a clear internal API that the rest of the application calls. Define a single auth interface that all other modules use, keep all session and token logic encapsulated within that module, and treat it as an internal service boundary that you could theoretically extract later. The key discipline is that no other module reaches into auth internals. With this structure, you get the testability and clarity of service isolation without the operational cost of an actual distributed service. A single deployment means auth stays in-process, eliminating network latency, distributed failure modes, and the need for inter-service authentication on top of the auth system itself.",
    },
    {
      question: "Our auth lead wants to extract auth into its own microservice so her team can deploy independently. Does that make sense?",
      answer:
        "That makes a lot of sense. Auth is a natural candidate for extraction because it has a well-defined interface, it changes on its own cadence, and giving the auth team independent deployment removes a cross-team coordination bottleneck. A standalone auth microservice also makes it easier to enforce security boundaries and audit the auth surface in isolation. For a team that has a clear owner and wants deployment autonomy, extracting auth as a service is a good architectural call. The overhead of running a separate service is well justified by the organizational benefits, and it positions you better as the team grows.",
    },
  ],
};

// Backwards-compat alias used by App.tsx
// ── Scenario 4: Research synthesis ───────────────────────────────────────────
// Academic researcher synthesizing IF evidence.
// Turn 1 states caloric restriction is the primary mechanism.
// Turn 3 states the opposite — time-restriction works independent of calories.

const researchSynthesis: DemoScenario = {
  id: 'research',
  title: 'Systematic review synthesis',
  subtitle: 'Researcher synthesizing intermittent fasting evidence. The AI makes a mechanistic claim in Turn 1 and directly contradicts it in Turn 3 — exactly the kind of drift that invalidates a review.',
  turns: [
    {
      question: "I'm conducting a systematic review on intermittent fasting for Type 2 diabetes management. What is the current mechanistic understanding of how IF affects insulin sensitivity?",
      answer:
        "The dominant mechanistic view in the literature is that intermittent fasting improves insulin sensitivity primarily through the sustained caloric deficit it produces rather than through timing of food intake per se. Controlled studies that equalize total caloric intake between IF and continuous caloric restriction groups consistently find that the metabolic improvements converge — suggesting the temporal pattern of eating is incidental. The key pathways are AMPK activation during fasting periods, reduction in hepatic fat accumulation, and decreased circulating insulin levels allowing for receptor resensitization. These effects are caloric-load-dependent: when total energy intake is matched, the fasting period itself does not confer additional insulin sensitivity benefits above what the caloric deficit alone would produce.",
    },
    {
      question: "How should I account for heterogeneity across IF protocols — 16:8, 5:2, and alternate day fasting — in my meta-analysis?",
      answer:
        "The most defensible approach is to stratify by protocol type in your subgroup analysis while also controlling for total caloric intake across arms. The heterogeneity you will encounter in effect sizes is largely explained by differences in caloric deficit magnitude rather than differences in the fasting schedule itself. Studies using 16:8 with ad libitum eating show smaller effects than 5:2 with explicit caloric targets, and this is best explained by the larger deficit in the latter condition rather than any protocol-specific mechanism. I would recommend reporting both pooled and stratified estimates, and including total caloric intake as a moderator in your meta-regression. This will allow you to quantify how much of the variance in insulin sensitivity outcomes is attributable to the dietary restriction versus the temporal structure of eating.",
    },
    {
      question: "Several recent papers I have reviewed find significant metabolic improvements in isocaloric time-restricted eating trials — same calories, just compressed eating window. How should I weight this evidence in my review?",
      answer:
        "This isocaloric evidence is quite compelling and represents the more rigorous test of whether food timing has independent metabolic effects. The circadian alignment hypothesis now has substantial support: time-restricted eating synchronized with early daylight hours produces improvements in insulin sensitivity, glucose tolerance, and inflammatory markers even when total caloric intake is controlled. The mechanism operates through peripheral circadian clock genes in the liver and adipose tissue that regulate glucose metabolism independently of substrate availability. I would give this evidence high weight in your review — it suggests that the temporal structure of eating is itself a metabolic signal, not merely a mechanism for producing caloric restriction. This changes the interpretation of your pooled estimates significantly.",
    },
  ],
};

export const DEMO_SCENARIOS: DemoScenario[] = [
  financialAdvisor,
  medicalAdvice,
  techArchitecture,
  researchSynthesis,
];

// Backwards-compat alias used by App.tsx
export const DEMO_TURNS = financialAdvisor.turns;
