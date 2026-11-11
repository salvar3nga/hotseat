# Glossary

**Hotseat**: AI-driven interview practice app. Public repo, MIT license.

**Session**: One run of the interview engine, from start to debrief. Has a mode, a role profile, an interview language, a clock, and a competency plan. Status is `configured`, `in-progress`, `completed`, `debriefed`, or `abandoned`.

**Mode**: Either `mock` (full interview, 30 or 45 minutes) or `drill` (one competency, about 10 minutes, no warm-up).

**Turn**: One message from the interviewer or the candidate. The unit the session engine works in, so text and voice can share it. Has a speaker, a plain-text body, a turn kind, start and end timestamps, and a competency.

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

**Engine**: The session state machine, `(state, event) -> (state, effects)`. Pure, UI-free, runs in the browser. Never reads a real clock; time comes in as input. Model calls and timers are injected.

**Event**: An input to the engine, such as a candidate turn, a clock tick, or a stop request.

**Effect**: An output the engine asks its caller to perform, such as calling the model or saving a snapshot.

**Turn kind**: One of `question`, `answer`, `follow-up`, `nudge`, `warm-up`, `warm-up-skip`, `wrap-up`. `warm-up-skip` is the candidate turn that records a skipped warm-up.

**Competency plan**: The ordered list of competencies a session covers, picked once when the session is configured, weighted by level and mode, with a stored seed. Skipped or cut-short questions are recorded, not replaced. A drill has a plan of one.

**Warm-up**: Short opening question in a `mock` session. Skippable; a skip is recorded so the debrief does not count it as a miss.

**Nudge**: A soft, in-character prompt to move on when a candidate answer passes its time budget (2.5 minutes in `mock`, 3 in `drill`). At most once per candidate turn, never cuts the candidate off.

**Follow-up cap**: Maximum follow-ups on one question before the engine moves on (2 by default, config).

**Missing signal**: A STAR signal (situation, task, action or result) that an answer leaves out or keeps too vague. The browser asks a separate model call after each non-warm-up answer, which returns yes or no and shows nothing to the candidate. A yes triggers a follow-up until the follow-up cap is reached. If the call fails, the answer counts as complete.

**Wrap-up**: The interviewer's closing turn. When the clock hits zero no new question is asked, the current answer finishes, then the wrap-up.

**Snapshot**: The in-progress session saved to IndexedDB after every turn, one slot per browser, expiring after 24 hours. Deleted when the session ends and by "delete all history". Time waiting on the model and time away from the tab do not count against the clock.

**Abandoned**: Session status for a session with nothing scorable. No debrief. Stopping after at least one scored answer is `completed` with a partial debrief.

**Coding session**: Session type for a coding question, with its own 25-minute clock, separate from the `mock` and `drill` clocks. Overrun is allowed and recorded.

**Per-question timer**: Clock scope where each question gets its own budget instead of the session sharing one. Submitting after zero is accepted and the overrun is recorded per question. Used by coding sessions, available to any session type.

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
