import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { TURN_COST, guardModelRoute } from "../../../server/guarded-model-route";
import { createTurnHandler } from "../../../server/turn-handler";

const INTERVIEWER_MODEL = "claude-sonnet-5-5";

export const POST = guardModelRoute(
  createTurnHandler(async ({ instructions, messages }) => {
    const { text } = await generateText({
      model: anthropic(INTERVIEWER_MODEL),
      instructions,
      messages,
    });
    return text;
  }),
  { cost: TURN_COST },
);
