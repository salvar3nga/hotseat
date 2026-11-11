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
      onSubmit={(event) => {
        event.preventDefault();
        onStart(style);
      }}
    >
      <fieldset>
        <legend>Interviewer style</legend>
        {INTERVIEWER_STYLES.map((option) => (
          <label key={option} style={{ display: "block" }}>
            <input
              type="radio"
              name="style"
              value={option}
              checked={style === option}
              onChange={() => setStyle(option)}
            />{" "}
            {option}: {DEFAULT_ENGINE_CONFIG.styles[option].description}
          </label>
        ))}
      </fieldset>

      <label>
        Level{" "}
        <select value={level} onChange={(event) => setLevel(event.target.value as Level)}>
          {LEVELS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>
      </label>

      <ScoringBands level={level} />

      <button type="submit" disabled={disabled}>
        Start a drill
      </button>
    </form>
  );
}
