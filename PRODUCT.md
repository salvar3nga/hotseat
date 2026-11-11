# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Job seekers preparing alone for a real interview, typically evenings at a desk. They type paragraph-length answers to behavioral questions, against a clock, and want to know honestly whether the answers would hold up. The app is a public demo with no account.

## Product Purpose

Hotseat runs AI-driven interview practice. An interviewer asks specific behavioral questions, probes vague answers, and scores against an explicit rubric instead of flattering the candidate. Success is a candidate who knows what to fix before the real interview.

## Positioning

Honest, evidence-based scoring. Every score cites a quote from the candidate's own transcript, and the verdict depends on the candidate's level, so the same answer can pass at junior and fail at senior. Nothing is stored on a server: history stays in the browser, and only model calls leave it.

## Operating Context

A session is a drill (one competency, about 10 minutes) or a mock (30 or 45 minutes). The candidate answers in a text box. A countdown runs only while the candidate can answer, and the interviewer may nudge when an answer runs long. The candidate picks an interviewer style (strict, standard, coaching) and a level before starting. Coding sessions have their own 25-minute clock.

## Capabilities and Constraints

- Built: text drill against Claude, interviewer styles, hints with a budget, phase banner, snapshot and resume, rate limit and daily spend cap with a sample debrief shown when the cap is hit.
- Not built yet: scoring, debrief, history, role presets, job description paste, German, coding UI. The debrief and history screens are out of scope for UI work until the scoring spec exists.
- Out of scope per the specs: streaks, XP, premium tiers, voice, company problem pools.
- The UI language is `en` and `de` at launch. German strings run longer.
- Glossary terms (GLOSSARY.md) are the product vocabulary: Session, Turn, Nudge, Hint, Phase banner, Verdict, Hiring bar, Debrief.

## Brand Commitments

The name is Hotseat. The repository is public under the MIT license. No other brand assets, voice or identity constraints are confirmed yet.

## Evidence on Hand

No testimonials, customer logos or benchmarks exist, and none should be invented. The sample debrief in `src/app/sample-debrief.tsx` is placeholder copy.

## Product Principles

- Honest over flattering: show the evidence and the bar, never soften a verdict.
- The answer box is the product. Typing long text under a clock must stay comfortable.
- Show the candidate what they are being judged against before and during the session.
- Private by default: say plainly what leaves the browser.

## Accessibility & Inclusion

Keyboard and screen reader friendly is a confirmed requirement. The banner, countdown and nudges change during a session, so they need accessible announcements that do not interrupt typing. Layouts must hold up in both English and German.
