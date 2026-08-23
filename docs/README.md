# Documentation

Fourteen documents. This is which one answers what, so nobody has to grep.

## Start here

| If you want to know…                               | Read                               |
| -------------------------------------------------- | ---------------------------------- |
| **Why this project exists**, and what it has to do | [REQUIREMENTS.md](REQUIREMENTS.md) |
| **What it does**, as a user                        | [FEATURES.md](FEATURES.md)         |
| **How to run it**                                  | [../README.md](../README.md)       |

## How it works

|                                            |                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| [DESIGN-DECISIONS.md](DESIGN-DECISIONS.md) | Every significant choice, the alternative rejected, and what it cost                                       |
| [INTERVIEWER.md](INTERVIEWER.md)           | What the interviewer knows before and during a round, how it picks the next question, how rounds hand over |
| [DATA-MODEL.md](DATA-MODEL.md)             | Nine tables, the RLS rule, what the client cannot write, what personal data is held                        |
| [TOKEN-COST.md](TOKEN-COST.md)             | What a turn costs, how prompt caching works, and when it does not fire                                     |

## Whether it works

|                                                                   |                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| [TESTING.md](TESTING.md)                                          | The five layers, and what is deliberately not tested                         |
| [EVALUATION.md](EVALUATION.md)                                    | Is the **analyzer's score** trustworthy? Measured against a keyword baseline |
| [COACHING.md](COACHING.md)                                        | How the **coach** generates a response, and how much of it is measured       |
| [UAT.md](UAT.md) · [UAT-tester-handout.md](UAT-tester-handout.md) | Can people actually use it? Test plan and participant script                 |
| [PRODUCTION-REVIEW.md](PRODUCTION-REVIEW.md)                      | What a hardening pass found, what was fixed, what was not, and why           |

## Operating it

|                                                  |                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| [DEPLOYMENT.md](DEPLOYMENT.md)                   | Vercel + Supabase runbook                                                   |
| [DEMO.md](DEMO.md)                               | Demo runbook — what to show, in what order, and what to say when challenged |
| [presentation/SCRIPT.md](presentation/SCRIPT.md) | The talk, slide by slide                                                    |

## Committed evidence

`artifacts/` holds output from runs that cost money, so a claim can be checked
without re-running it:

| File                           | From                             |
| ------------------------------ | -------------------------------- |
| `persona-comparison.txt`       | `npm run eval:persona -- --live` |
| `coach-eval-deterministic.txt` | `npm run eval:coach`             |
| `voice-audition.md`            | `npm run eval:voices -- --live --stt` (listen: `-- --page` or `-- --play`) |
| `azure-voices-southeastasia.json` | `npm run eval:voices -- --list` |

---

## The rule these documents follow

**A number that has not been measured is written as not measured.** Several
sections say "not run" where an experiment was planned and skipped, and one
records an experiment that shipped without being run at all. That is deliberate:
a document that only reports successes cannot be used to judge the work, because
there is no way to tell the successes from the omissions.

Where a figure appears — 88.9% band accuracy, 41.0 separation, ~590 tokens of
stable prefix — the command that produced it is named, and where the output is
committed, it is linked.
