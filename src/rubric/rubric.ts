import type { Level } from "../engine/ports";
import type { Competency } from "../engine/types";

// Anchors run from score 1 to 5 and are shared by every level. The level line says what a 3 looks like at that level.
type CompetencyRubric = {
  measures: string;
  anchors: readonly [string, string, string, string, string];
  levelLines: Record<Level, string>;
};

// Record<Competency, ...> makes adding a competency a type error until its rubric is written.
const RUBRIC: Record<Competency, CompetencyRubric> = {
  ownership: {
    measures: "Taking responsibility for an outcome, not only a task.",
    anchors: [
      "Describes things that happened around them. No clear action of their own.",
      "Names their own actions, but the outcome is vague or credited to others.",
      "Names their own actions and the outcome. Reasoning for the choices is thin.",
      "Owned the problem past their assigned task, explains why, and states a measurable result.",
      "Everything in 4, plus anticipated a risk or followed up after delivery without being asked.",
    ],
    levelLines: {
      junior: "Finishes an assigned task well and says what they did and what came of it.",
      mid: "Owns a feature end to end, including unclear parts, and states the outcome.",
      senior: "Owns a problem across a team boundary and drives it to a result.",
      staff: "Owns an outcome across teams or quarters, and fixes the cause, not only the symptom.",
    },
  },
  conflict: {
    measures: "Handling disagreement with another person.",
    anchors: [
      "Avoids the conflict, blames the other person, or describes no real disagreement.",
      "Describes the disagreement, but resolved it by giving in, escalating or winning, with no attempt to understand the other side.",
      "Shows they understood the other view and reached a workable outcome.",
      "Understood the other view, chose how to approach it, and kept the relationship intact with a clear result.",
      "Everything in 4, plus turned the disagreement into a better decision or a lasting change in how the team works.",
    ],
    levelLines: {
      junior: "Raises a disagreement with a peer directly and reaches an outcome both can live with.",
      mid: "Resolves a technical disagreement with a peer using evidence, and keeps working together.",
      senior: "Resolves a disagreement between people or teams, including one where they had less authority.",
      staff: "Aligns senior people with competing priorities, and explains the tradeoff they brokered.",
    },
  },
  ambiguity: {
    measures: "Making progress when the goal or the path is unclear.",
    anchors: [
      "Waited for instructions or describes no unclear situation.",
      "Noticed the ambiguity but picked a direction with no reasoning, or asked others to decide.",
      "Clarified what they could, made explicit assumptions and moved forward.",
      "Narrowed the ambiguity deliberately, tested their assumptions cheaply, and adjusted as they learned.",
      "Everything in 4, plus turned the ambiguity into a clear plan that others then used.",
    ],
    levelLines: {
      junior: "Asks good questions, states what they assumed, and gets a first version out.",
      mid: "Breaks an unclear request into parts, decides what to do first and says why.",
      senior: "Defines the problem when no one has, and sets the scope for others.",
      staff: "Sets direction where the goal itself is unclear, and handles the risk of being wrong.",
    },
  },
  failure: {
    measures: "How they deal with something that went wrong.",
    anchors: [
      "No real failure described, or the failure was entirely someone else's.",
      "Describes a failure but plays it down, or lists no lesson.",
      "Describes a real failure, their part in it, and one lesson.",
      "Took responsibility openly, repaired the damage, and changed what they do afterwards, with an example.",
      "Everything in 4, plus the change also helped others, such as a new check or a shared write-up.",
    ],
    levelLines: {
      junior: "Admits a real mistake on a task and says what they learned.",
      mid: "Admits a mistake with real impact and describes what they changed in their own work.",
      senior: "Owns a failure that affected others, repaired it, and changed a process or habit.",
      staff: "Owns a failure with broad impact, explains the systemic cause, and fixed the system.",
    },
  },
  leadership: {
    measures: "Getting results through other people, with or without authority.",
    anchors: [
      "Describes doing the work alone, or following instructions.",
      'Coordinated people but gave no direction, or says "we" without their own role.',
      "Set direction for a small group and got a result.",
      "Set direction, made people more capable or more motivated, and handled a hard moment, with a clear result.",
      "Everything in 4, plus the group kept working well after the candidate stepped away.",
    ],
    levelLines: {
      junior: "Takes the lead on a small piece of shared work and helps a teammate.",
      mid: "Leads a feature or a small group, and supports a less experienced teammate.",
      senior: "Leads a project across several people, mentors, and handles an underperformance or conflict.",
      staff: "Leads through other leaders, shapes how several teams work, and grows people who then lead.",
    },
  },
  communication: {
    measures: "Making ideas clear and getting understanding from different audiences.",
    anchors: [
      "Unclear, or describes no situation where they had to explain something.",
      "Explains their own idea but does not adapt to the listener, or never checks it landed.",
      "Adapts to a clear audience and gets the message across.",
      "Adapted the message, checked understanding, and changed something because of the response.",
      "Everything in 4, plus changed a decision or built shared understanding across groups that did not agree.",
    ],
    levelLines: {
      junior: "Explains their work clearly to their team and asks when they do not understand.",
      mid: "Explains a technical topic to a non-technical colleague so they could act on it.",
      senior: "Communicates a tradeoff or bad news to stakeholders, and gets a decision.",
      staff: "Builds shared understanding across teams or leadership, and shapes a decision with it.",
    },
  },
};

export type Rubric = {
  measures: string;
  anchors: { score: number; description: string }[];
  levelLine: string;
};

export function rubricFor(competency: Competency, level: Level): Rubric {
  const { measures, anchors, levelLines } = RUBRIC[competency];
  return {
    measures,
    anchors: anchors.map((description, index) => ({ score: index + 1, description })),
    levelLine: levelLines[level],
  };
}
