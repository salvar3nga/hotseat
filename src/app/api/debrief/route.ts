import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { SCORING_COST, guardModelRoute } from "../../../server/guarded-model-route";
import { createScoringHandler } from "../../../server/scoring-handler";

const SCORER_MODEL = "claude-sonnet-5-5";

// Exempt from the daily cap so a session already played can always be scored.
export const POST = guardModelRoute(
  createScoringHandler(async ({ instructions, messages }) => {
    const { text } = await generateText({
      model: anthropic(SCORER_MODEL),
      instructions,
      messages,
    });
    return text;
  }),
  { cost: SCORING_COST, exemptFromSpendCap: true },
);
