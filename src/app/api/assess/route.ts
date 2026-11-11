import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { ASSESSMENT_COST, guardModelRoute } from "../../../server/guarded-model-route";
import { createAssessmentHandler } from "../../../server/assessment-handler";

const ASSESSOR_MODEL = "claude-haiku-5-5";

export const POST = guardModelRoute(
  createAssessmentHandler(async ({ instructions, messages }) => {
    const { text } = await generateText({
      model: anthropic(ASSESSOR_MODEL),
      instructions,
      messages,
      maxOutputTokens: 5,
    });
    return text;
  }),
  { cost: ASSESSMENT_COST },
);
