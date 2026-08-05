import type { InterviewRoundType } from "@/lib/interview-rounds";

/**
 * Golden set for scoring validation.
 *
 * Each fixture pairs a question with an answer written to sit deliberately in
 * one quality band, so the harness can ask two questions the app has never
 * been able to answer:
 *
 *   1. Does the analyzer land in the right band? (accuracy)
 *   2. Does it land in the *same* band twice? (stability)
 *
 * Bands rather than exact targets, because no two human interviewers agree on
 * a number either — the claim being tested is "this separates a strong answer
 * from a weak one consistently", not "this predicts 73".
 */

export type QualityBand = "weak" | "mediocre" | "strong";

/** Expected score range per band. Deliberately wide and non-overlapping. */
export const BAND_RANGES: Record<QualityBand, [number, number]> = {
  weak: [0, 45],
  mediocre: [40, 72],
  strong: [68, 100],
};

export interface EvalFixture {
  id: string;
  roundType: InterviewRoundType;
  band: QualityBand;
  question: string;
  answer: string;
  /** Why this answer belongs in this band — read when a case fails. */
  rationale: string;
}

export const FIXTURES: EvalFixture[] = [
  // ---------------------------------------------------------------- behavioral
  {
    id: "beh-strong-conflict",
    roundType: "behavioral",
    band: "strong",
    question:
      "Tell me about a time you disagreed with a teammate. How did you handle it?",
    answer:
      "On our checkout rewrite last spring, our tech lead wanted to ship a full rewrite in one release; I thought the blast radius was too big. I pulled the last two quarters of incident data and showed that our three worst outages all came from releases touching more than about 4,000 lines. I proposed splitting it into four releases behind a flag. He pushed back on the timeline, so we agreed to try two slices and measure. The first slice went out with zero incidents and we kept the pattern for the rest. We finished eleven days later than his plan but with no customer-facing incidents, and we've used the flag-and-slice pattern on every migration since.",
    rationale:
      "Full STAR, first person, quantified on two dimensions, names the disagreement and the resolution, includes what it cost.",
  },
  {
    id: "beh-weak-conflict",
    roundType: "behavioral",
    band: "weak",
    question:
      "Tell me about a time you disagreed with a teammate. How did you handle it?",
    answer:
      "I think communication is really important on a team. Usually if there's a disagreement I try to hear the other person out and find common ground. Everyone wants the same thing at the end of the day so it normally works itself out.",
    rationale:
      "No situation, no specific example, no action, no result. Generic philosophy rather than an anecdote.",
  },
  {
    id: "beh-mediocre-conflict",
    roundType: "behavioral",
    band: "mediocre",
    question:
      "Tell me about a time you disagreed with a teammate. How did you handle it?",
    answer:
      "We disagreed about which database to use for a new service. I preferred Postgres and my colleague wanted Mongo. We talked it through in a design review and ended up going with Postgres because it fit our reporting needs better. It worked out fine and shipped on time.",
    rationale:
      "Real situation and outcome, but thin on the candidate's specific actions and entirely unquantified.",
  },
  {
    id: "beh-strong-failure",
    roundType: "behavioral",
    band: "strong",
    question: "Tell me about a time you failed.",
    answer:
      "I owned a pricing migration that I estimated at three weeks; it took nine. I'd scoped it off the schema alone and never checked how many downstream services read the pricing table directly — it turned out to be fourteen, four of them owned by teams in other timezones. That's on me: I didn't do the integration audit before committing to a date. We shipped, but I burned two weeks of another team's roadmap. Since then I run a dependency audit before any estimate on shared data, and I now give ranges with an explicit list of what would push it to the high end. The next migration I scoped came in at six weeks against a five-to-eight estimate.",
    rationale:
      "Owns the failure squarely, names the specific root cause, quantifies the cost, and shows a concrete changed behaviour with evidence.",
  },
  {
    id: "beh-weak-failure",
    roundType: "behavioral",
    band: "weak",
    question: "Tell me about a time you failed.",
    answer:
      "Honestly my biggest weakness is that I care too much about quality, so sometimes projects take longer than expected. But I'd rather do it right than do it fast.",
    rationale:
      "Deflects the question into a humblebrag. No failure, no ownership, no learning.",
  },

  // ------------------------------------------------------------------ technical
  {
    id: "tech-strong-code",
    roundType: "technical_swe",
    band: "strong",
    question:
      "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
    answer:
      "I'll use a hash map from value to index and do a single pass.\n\n```python\ndef two_sum(nums, target):\n    seen = {}\n    for i, n in enumerate(nums):\n        complement = target - n\n        if complement in seen:\n            return [seen[complement], i]\n        seen[n] = i\n    return []\n```\n\nO(n) time, O(n) space. I check the complement before inserting so a single element can't pair with itself. If no pair exists it returns an empty list — I'd confirm whether the caller wants that or an exception. Duplicates are fine because we return on the first match.",
    rationale:
      "Correct, optimal, states complexity, handles the self-pairing edge case explicitly, and flags an ambiguity.",
  },
  {
    id: "tech-weak-code",
    roundType: "technical_swe",
    band: "weak",
    question:
      "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
    answer:
      "```python\ndef two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n```\n\nThis loops through and finds the pair.",
    rationale:
      "Quadratic, and genuinely wrong: the inner loop starts at 0, so an element pairs with itself. No complexity discussion.",
  },
  {
    id: "tech-mediocre-code",
    roundType: "technical_swe",
    band: "mediocre",
    question:
      "Given an array of integers and a target, return the indices of the two numbers that add up to the target.",
    answer:
      "```python\ndef two_sum(nums, target):\n    for i in range(len(nums)):\n        for j in range(i + 1, len(nums)):\n            if nums[i] + nums[j] == target:\n                return [i, j]\n    return []\n```\n\nThis is O(n^2) but it works.",
    rationale:
      "Correct and knows its complexity, but does not reach for the linear solution or discuss edge cases.",
  },

  // -------------------------------------------------------------- system design
  {
    id: "design-strong",
    roundType: "system_design",
    band: "strong",
    question: "How would you design a URL shortener?",
    answer:
      "Let me pin the requirements first: read-heavy, say 100:1 reads to writes, 10M new links a day, redirects need to be under 50ms at p99, and links are permanent. That's ~40B links over ten years, so a 7-character base62 key gives me 3.5T — plenty of headroom.\n\nFor key generation I'd avoid hashing the URL because collision handling adds a read on the write path. Instead a counter sharded across writers, base62-encoded. Each writer takes a block of 10,000 from a central allocator, so the allocator is hit once per 10,000 writes and writers stay independent.\n\nStorage is a KV store keyed on the short code — this is a point-lookup workload, so a relational database buys nothing. Redirects go through a CDN-fronted cache; with permanent links the hit rate should be very high, and the tail is what the 50ms budget is for.\n\nThe main tradeoff is the counter blocks: a writer that dies loses its block, so the keyspace gets holes. I'm accepting that because the keyspace is enormous and the alternative is coordinating on every write.",
    rationale:
      "Requirements before architecture, quantified capacity estimate, justifies each choice against an alternative, and names what the design gives up.",
  },
  {
    id: "design-weak",
    roundType: "system_design",
    band: "weak",
    question: "How would you design a URL shortener?",
    answer:
      "I'd use a microservices architecture with a load balancer in front. There'd be a database to store the URLs and a cache for performance. We could use Redis for the cache and maybe Kafka for events. It should be scalable and highly available.",
    rationale:
      "Component name-dropping with no requirements, no capacity work, no key-generation scheme, and no tradeoffs.",
  },
  {
    id: "design-mediocre",
    roundType: "system_design",
    band: "mediocre",
    question: "How would you design a URL shortener?",
    answer:
      "I'd store a mapping from a short code to the long URL in a database, and generate the code by hashing the URL and taking the first seven characters. Reads go through a cache since it's read-heavy. If two URLs hash to the same code I'd add a salt and retry. I'd put it behind a load balancer and shard the database by code if it gets large.",
    rationale:
      "A coherent working design with a real collision strategy, but no capacity estimate and no discussion of what it trades away.",
  },

  // ------------------------------------------------------------------ screening
  {
    id: "screen-strong",
    roundType: "screening",
    band: "strong",
    question: "Why are you interested in this role?",
    answer:
      "Two reasons. I've spent the last three years on internal tooling and the feedback loop is slow — you ship something and hear about it a quarter later. This role is customer-facing with weekly releases, which is the loop I want. Second, I read your engineering post on cutting the deploy pipeline from forty minutes to six; that kind of investment in developer experience is unusual and it's the thing I'd want to work on. I'd want to understand how the on-call rotation works before committing, since that's been a sticking point for me before.",
    rationale:
      "Specific about motivation, demonstrates research, and asks a real question back — concise and honest.",
  },
  {
    id: "screen-weak",
    roundType: "screening",
    band: "weak",
    question: "Why are you interested in this role?",
    answer:
      "I've heard great things about the company and I think it would be a really good opportunity for me to grow. I'm passionate about technology and I like working with smart people. It seems like a great culture fit.",
    rationale: "Interchangeable with any other company. No specifics at all.",
  },

  // ----------------------------------------------------------------------- case
  {
    id: "case-strong",
    roundType: "case",
    band: "strong",
    question:
      "Our checkout conversion dropped 8% last week. How would you investigate?",
    answer:
      "First I'd confirm it's real and not instrumentation — check whether sessions and orders both moved, or only the ratio. If only the ratio moved I'd suspect tracking.\n\nAssuming it's real, I'd segment before theorising: by platform, browser, geography, new versus returning, and payment method. An 8% aggregate drop is usually a large drop in a narrow segment rather than a small drop everywhere, and the segment usually names the cause.\n\nIn parallel I'd pull the deploy and config log for the window. Most sudden step-changes are something we did.\n\nIf it's a gradual slope rather than a step, that points at something external — a competitor promotion, seasonality, or a traffic-mix shift from a marketing change. I'd check whether paid traffic share moved, since that changes intent mix and can drop conversion without anything breaking.",
    rationale:
      "Validates the data first, structured segmentation, distinguishes step-change from slope, and reasons about causes rather than listing checks.",
  },
  {
    id: "case-weak",
    roundType: "case",
    band: "weak",
    question:
      "Our checkout conversion dropped 8% last week. How would you investigate?",
    answer:
      "I'd look at the analytics to see what happened and talk to the team to understand the context. Then I'd figure out the root cause and come up with a plan to fix it. Data-driven decision making is really important here.",
    rationale:
      "Restates the task as a plan. No structure, no hypotheses, no segmentation.",
  },

  // ------------------------------------------------------------------------ hr
  // The newest round type, and the one the harness had no coverage for at all.
  {
    id: "hr-strong",
    roundType: "hr",
    band: "strong",
    question:
      "What are you looking for in your next role, and do you have any questions for us?",
    answer:
      "Three things, in order. Scope first — I've been the only person on my service for a year and I want to work somewhere reviews are a real conversation. Second, I want to stay hands-on; I've been asked twice about moving to management and it isn't what I want in the next two or three years. Third, compensation needs to be at least in line with my current band, which is 95 to 105 including bonus, though I'd weigh that against the first two.\n\nOn notice, I'm on a month and I'd want to finish the migration I'm leading, so realistically six weeks.\n\nMy question: you mentioned the team doubled last year. What changed about how decisions get made, and what would you have done differently?",
    rationale:
      "Prioritised rather than listed, concrete and honest on comp and notice, and asks a question that could not be asked of any other company.",
  },
  {
    id: "hr-mediocre",
    roundType: "hr",
    band: "mediocre",
    question:
      "What are you looking for in your next role, and do you have any questions for us?",
    answer:
      "I'm looking for a role where I can keep growing technically and work on products that people actually use. Culture matters to me — I've been somewhere that talked about collaboration and didn't practise it, so I pay attention to that now. On salary I'm flexible and open to discussing what's fair for the level.\n\nI suppose my question would be what a typical week looks like on this team.",
    rationale:
      "Genuine and coherent, with one real signal from experience, but 'flexible' avoids the logistics question and the closing question is generic.",
  },
  {
    id: "hr-weak",
    roundType: "hr",
    band: "weak",
    question:
      "What are you looking for in your next role, and do you have any questions for us?",
    answer:
      "I'm looking for a good opportunity where I can grow and contribute to a great team. Salary isn't the main thing for me, I just want somewhere I can do my best work. No questions from me, I think you covered everything.",
    rationale:
      "Says nothing that would distinguish one employer from another, dodges compensation entirely, and declines to ask anything.",
  },
];
