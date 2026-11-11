"use client";

import { useState } from "react";
import { LEVELS } from "../engine/ports";
import type { Level } from "../engine/ports";
import { DEFAULT_ENGINE_CONFIG, DEFAULT_STYLE, INTERVIEWER_STYLES } from "../engine/types";
import type { InterviewerStyle } from "../engine/types";
import { ScoringBands } from "./scoring-bands";

type StartFormProps = { onStart: (style: InterviewerStyle) => void; disabled: boolean };

export function StartForm({ onStart, disabled }: StartFormProps) {
  const [style, setStyle] = useState<InterviewerStyle>(DEFAULT_STYLE);
  const [level, setLevel] = useState<Level>("mid");

  return (
    <form
      className="start-form"
      onSubmit={(event) => {
        event.preventDefault();
        onStart(style);
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

      <div>
        <label className="field-label" htmlFor="level">
          Level
        </label>
        <select
          id="level"
          className="level-select"
          value={level}
          onChange={(event) => setLevel(event.target.value as Level)}
        >
          {LEVELS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </div>

      <ScoringBands level={level} />

      <div>
        <button className="button" type="submit" disabled={disabled}>
          Start a drill
        </button>
      </div>
    </form>
  );
}
