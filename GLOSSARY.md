# Glossary

**Hotseat**: AI-driven interview practice app. Public repo, MIT license.

**Session**: One run of the interview engine, from start to debrief. Has a mode, a role profile, an interview language, and a clock.

**Mode**: Either `mock` (full interview, 30 or 45 minutes) or `drill` (one competency, about 10 minutes, no warm-up).

**Turn**: One message from the interviewer or the candidate. The unit the session engine works in, so text and voice can share it.

**Interviewer**: The AI side of a session. Rubric-driven, asks follow-ups, nudges on long answers.

**Candidate**: The user being interviewed.

**Role profile**: Role, level, and optional job description a session is built from.

**Level**: One of `junior`, `mid`, `senior`, `staff`. Derived from years of experience (0-2, 2-5, 5-8, 8+) unless overridden.

**Target level**: Level the candidate is applying for. Wins over self-reported experience.

**Job description level**: Level inferred from a pasted job description. Wins over years of experience, shown to the candidate with a one-line justification, and editable.

**Competency**: A scored skill area in the curated list (ownership, conflict, ambiguity, failure, and so on). Scores are always per competency.

**Regional competency**: A competency only offered in some interview languages, for example CV walk-through and salary and notice-period questions in German. Scored separately and excluded from trend lines.

**Rubric**: The scoring criteria for a competency at a given level. Every score must cite evidence.

**Evidence**: A quote from the candidate's transcript supporting a score.

**Debrief**: End-of-session report: score per competency with evidence, rewritten answers for top weaknesses, and a practice plan.

**Practice plan**: Debrief section listing the next competencies to drill. Each item can start a drill.

**Drill**: A session in `drill` mode.

**Coding question**: Question type where the candidate solves a problem in their own editor and pastes the solution. Evaluated by reading, never executed.

**Reviewed, not executed**: Label shown on correctness for coding questions.

**Problem set**: The hand-written coding problems (about 15 to 20). The model never invents problems.

**Interview language**: Language the interviewer speaks in a session. Independent of UI language. Default follows UI locale.

**UI locale**: Language of the interface. `en` and `de` at launch.

**Register**: Formal (`Sie`) or informal (`du`) address in German sessions. Default `Sie`.

**History**: Debriefs stored in the browser (IndexedDB) as structured data. No server-side storage.

**Eval fixture**: A good, vague, or bad sample answer used to check scoring consistency. English and German sets.

**Spend cap**: Hard daily limit on LLM cost for the public demo. When hit, the app shows the sample debrief.

**Sample debrief**: Pre-recorded debrief shown when the spend cap is hit.
