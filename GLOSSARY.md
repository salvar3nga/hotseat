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

**Evidence**: A quote from the candidate's transcript supporting a score. It must be a verbatim substring of one candidate turn, ignoring case and whitespace, and at least 4 words long. The server checks this, never the model.

**Score**: A whole number from 1 to 5 for one competency, relative to the candidate's level: 1 is no usable evidence of the skill, 3 is competent for the level, 5 is exceptional. A 4 always means strong for the candidate's own level. A score with no verified evidence is invalid.

**Not scored**: A competency with no valid score, because it was skipped, never reached, or its scores failed the evidence check after one retry. Different from a score of 1, which means the candidate answered but showed no skill. Left out of the verdict.

**Engine**: The session state machine, `(state, event) -> (state, effects)`. Pure, UI-free, runs in the browser. Never reads a real clock; time comes in as input. Model calls and timers are injected.

**Event**: An input to the engine, such as a candidate turn, a clock tick, or a stop request.

**Effect**: An output the engine asks its caller to perform, such as calling the model or saving a snapshot.

**Turn kind**: One of `question`, `answer`, `follow-up`, `nudge`, `hint`, `warm-up`, `warm-up-skip`, `wrap-up`. `warm-up-skip` is the candidate turn that records a skipped warm-up.

**Competency plan**: The ordered list of competencies a session covers, picked once when the session is configured, weighted by level and mode, with a stored seed. Skipped or cut-short questions are recorded, not replaced. A drill has a plan of one.

**Warm-up**: Short opening question in a `mock` session. Skippable; a skip is recorded so the debrief does not count it as a miss.

**Nudge**: A soft, in-character prompt to move on when a candidate answer passes its time budget (2.5 minutes in `mock`, 3 in `drill`). At most once per candidate turn, never cuts the candidate off.

**Interviewer style**: Named bundle of engine settings the candidate picks when configuring a `mock` or `drill`: `strict`, `standard` (the default) or `coaching`. A style sets the follow-up cap, the nudge budget, the hint budget and whether the phase banner shows. Recorded on the session. Adding a style means adding config data, not engine branches.

**Hint**: A candidate-initiated request for a pointer on what a strong answer to the current question covers. Answered by an interviewer turn of kind `hint`. Not a follow-up, which the interviewer initiates, so it never counts toward the follow-up cap.

**Hint budget**: How many hints a session allows, set by the interviewer style (0 in `strict`). Remaining hints are derived from the budget and the hint turns.

**Phase banner**: One line above the chat saying what the interviewer wants in the current phase (warm-up, question, follow-up, wrap-up). Derived from state, never stored. Hidden in `strict`.

**Follow-up cap**: Maximum follow-ups on one question before the engine moves on (2 by default, config).

**Missing signal**: A STAR signal (situation, task, action or result) that an answer leaves out or keeps too vague. The browser asks a separate model call after each non-warm-up answer, which returns yes or no and shows nothing to the candidate. A yes triggers a follow-up until the follow-up cap is reached. If the call fails, the answer counts as complete.

**Wrap-up**: The interviewer's closing turn. When the clock hits zero no new question is asked, the current answer finishes, then the wrap-up.

**Snapshot**: The in-progress session saved to IndexedDB after every turn, one slot per browser, expiring after 24 hours. Kept after the session ends until a debrief is saved, so a failed scoring call can be retried, and deleted then and by "delete all history". Time waiting on the model and time away from the tab do not count against the clock.

**Abandoned**: Session status for a session with nothing scorable. No debrief. Stopping after at least one scored answer is `completed` with a partial debrief.

**Coding session**: Session type for a coding question, with its own 25-minute clock, separate from the `mock` and `drill` clocks. Overrun is allowed and recorded.

**Per-question timer**: Clock scope where each question gets its own budget instead of the session sharing one. Submitting after zero is accepted and the overrun is recorded per question. Used by coding sessions, available to any session type.

**Debrief**: End-of-session report: score per competency with evidence, rewritten answers for top weaknesses, and a practice plan. Scores and weaknesses come from one model call. The verdict, communication metrics and practice plan are computed by code.

**Weakness**: One of the top two or three competencies to improve, chosen by the model, with a rewritten stronger version of one of the candidate's actual answers. Dropped when its competency was not scored or its answer matches no verified quote.

**Hiring bar**: The score a candidate needs for Hire at their level. It is the Hire edge of that level's verdict bands.

**Verdict**: The band a debrief score lands in at the candidate's level (Strong no hire, No hire, Hire, Strong hire), with the hiring bar and the point gap to it. Computed from scores and config, never by the model. Covers answered competencies only in a partial debrief, leaves out regional competencies, and does not exist for an abandoned session.

**Communication metrics**: Facts computed from turn timestamps, with no model call: longest silence, each answer's duration against the time budget, nudge count and hint count. Shown in the debrief as is.

**Practice plan**: Debrief section listing the next competencies to drill. Each item can start a drill.

**Drill**: A session in `drill` mode.

**Coding question**: Question type where the candidate solves a problem in their own editor and pastes the solution. Evaluated by reading, never executed.

**Reviewed, not executed**: Label shown on correctness for coding questions.

**Problem set**: The hand-written coding problems (about 15 to 20). The model never invents problems.

**Interview language**: Language the interviewer speaks in a session. Independent of UI language. Default follows UI locale.

**UI locale**: Language of the interface. `en` and `de` at launch.

**Register**: Formal (`Sie`) or informal (`du`) address in German sessions. Default `Sie`.

**History**: Debriefs stored in the browser (IndexedDB) as structured data. No server-side storage.

**History entry**: One saved debrief: id, `schemaVersion`, date, seed, mode, level, interview language, interviewer style, partial flag, scores with quotes, weaknesses, practice plan and communication metrics. No transcript and no verdict, which is recomputed. Older versions are migrated when read, and newer versions are skipped and left in place.

**Eval fixture**: A good, vague, or bad sample answer used to check scoring consistency. English and German sets.

**Spend cap**: Hard daily limit on LLM cost for the public demo. When hit, the app shows the sample debrief.

**Sample debrief**: Pre-recorded debrief shown when the spend cap is hit.
