"use client";

import { useState } from "react";
import { LEVELS } from "../engine/ports";
import type { Level } from "../engine/ports";
import { DEFAULT_ENGINE_CONFIG, DEFAULT_STYLE, INTERVIEWER_STYLES } from "../engine/types";
import type { InterviewerStyle } from "../engine/types";
import { ScoringBands } from "./scoring-bands";

const LEVEL_YEARS: Record<Level, string> = {
  junior: "0 to 2 years",
  mid: "2 to 5 years",
  senior: "5 to 8 years",
  staff: "8+ years",
};

type StartFormProps = { onStart: (style: InterviewerStyle, level: Level) => void; disabled: boolean };

export function StartForm({ onStart, disabled }: StartFormProps) {
  const [style, setStyle] = useState<InterviewerStyle>(DEFAULT_STYLE);
  const [level, setLevel] = useState<Level>("mid");

  return (
    <form
      className="start-form"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(style, level);
      }}
    >
      <h2 className="start-title">Set up your drill</h2>
      <fieldset>
        <legend>Interviewer style</legend>
        {INTERVIEWER_STYLES.map((option) => (
          <label key={option} className="choice">
            <input
              type="radio"
              name="style"
              value={option}
              checked={style === option}
              onChange={() => setStyle(option)}
            />
            <span className="choice-name">{option}</span>
            <span className="choice-note">{DEFAULT_ENGINE_CONFIG.styles[option].description}</span>
          </label>
        ))}
      </fieldset>

      <fieldset>
        <legend>Level</legend>
        <div className="level-options">
          {LEVELS.map((option) => (
            <label key={option} className="level-option">
              <input
                className="visually-hidden"
                type="radio"
                name="level"
                value={option}
                checked={level === option}
                onChange={() => setLevel(option)}
              />
              <span className="choice-name">{option}</span>
              <span className="choice-note">{LEVEL_YEARS[option]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <ScoringBands level={level} />

      <div>
        <button className="button" type="submit" disabled={disabled}>
          Start a drill
        </button>
      </div>
    </form>
  );
}
