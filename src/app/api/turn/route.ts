import { anthropic } from "@ai-sdk/anthropic";
import { generateText } from "ai";
import { createTurnHandler } from "../../../server/turn-handler";

const INTERVIEWER_MODEL = "claude-sonnet-5-5";

export const POST = createTurnHandler(async ({ instructions, messages }) => {
  const { text } = await generateText({
    model: anthropic(INTERVIEWER_MODEL),
    instructions,
    messages,
  });
  return text;
});
