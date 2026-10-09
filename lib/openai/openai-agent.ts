
import { Agent, run } from "@openai/agents";

export type Message = {
  role: "user" | "agent" | "assistant";
  content: string;
};

export const createAgent = (
  name: string,
  instructions: string
) => {
  return new Agent({
    name,
    instructions: instructions || "You are a helpful assistant.",
    model: "gpt-5-mini",
  });
};

export const executeAgentChat = async (
  name: string,
  instructions: string,
  messages: Message[]
): Promise<string> => {
  const agent = createAgent(name, instructions);

  // Use the latest user message as the input.
  // The Agents SDK manages conversation input and output.
  const latestUserMessage = [...messages]
    .reverse()
    .find((msg) => msg.role === "user");

  if (!latestUserMessage) {
    throw new Error("No user message found in conversation");
  }

  const result = await run(agent, latestUserMessage.content);

  if (typeof result.finalOutput !== "string") {
    throw new Error("Agent did not return a text response");
  }

  return result.finalOutput;
};
