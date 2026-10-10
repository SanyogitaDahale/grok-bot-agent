import { Agent, run } from "@openai/agents";
import { agentResponseSchema } from "./agent-response-schema";

export type Message = {
  role: "user" | "agent" | "assistant";
  content: string;
};

export const createAgent = (
  name: string,
  instructions: string,
  tools: any[] = [],
) => {
  return new Agent({
    name,
    instructions: instructions || "You are a helpful assistant.",
    tools: [...tools],
    model: "gpt-5-mini",
    outputType: agentResponseSchema,
  });
};

export const executeAgentChat = async (
  name: string,
  instructions: string,
  messages: Message[],
  tools: any[] = [],
  availableTools: Array<{
    slug: string,
    name: string,
    description: string

  }> = [],
  timeZone = 'UTC'
) => {

  const formmatedInstructions = buildAgentInstructions(name, instructions, availableTools, timeZone);
  const agent = createAgent(name, formmatedInstructions, tools);

  const conversation = messages
    .filter((msg) => msg.role === "user" || msg.role === "assistant" || msg.role === "agent")
    .map((msg) => {
      if (msg.role === "user") {
        return {
          role: "user" as const,
          content: msg.content,
        };
      }

      return {
        role: "assistant" as const,
        status: "completed" as const,
        content: [{ type: "output_text" as const, text: msg.content }],
      };
    });

  if (!conversation.some((msg) => msg.role === "user")) {
    throw new Error("No user message found in conversation");
  }

  const result = await run(agent, conversation);

  if (!result.finalOutput) {
    throw new Error("Agent did not return a response");
  }

  return agentResponseSchema.parse(result.finalOutput);
};


export const buildAgentInstructions = (
  agentName: string,
  customInstructions: string,
  availableTools: Array<{
    slug: string;
    name: string;
    description: string;
  }>,
  timezone: string
) => {
  const currentDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return `
You are ${agentName}.
${customInstructions}
User timezone: ${timezone}
Current date in the user's timezone: ${currentDate}
Available tools catalog:
${availableTools
  .map((tool) => `- ${tool.slug}: ${tool.name} - ${tool.description}`)
  .join("\n")}

Behavior Rules:
Return type="message" for a normal reply. Set questions and suggestedTools to empty arrays and routine to null.
Return type="tool_connection" whenever the user explicitly asks to connect or link an app, or needs an unavailable external app for an immediate task. Briefly explain the connection in message, put each matching app from the available tools catalog and its reason in suggestedTools, and set questions to an empty array and routine to null.
Return type="clarification" only when a detail needed to create the routine cannot reasonably be inferred. Ask one concise question for the missing detail(s), set suggestedTools to an empty array, and set routine to null.
Return type="routine" whenever the user asks to schedule, automate, or repeat a task. Do not answer these requests with type="message".
For routine responses, fill in every routine field: use the user's wording to create a clear name, goal, and actionable instructions; use the current date above for startDate unless the user specifies another date; use the user's timezone; and put the requested time and frequency in schedule. For a daily schedule, set frequency to "daily" and weekDays to [].
Treat routines as ongoing until the user says otherwise; do not ask for an end date. Do not ask for a start date or timezone: use the current date above and the user's timezone. Ask for a time or frequency only when the user did not provide enough information to infer it. If the exact text of a requested message is missing, ask for that text. Do not ask which channel to use when the user has not specified one; describe it as the configured or designated channel in the routine instructions.
When the user answers a clarification, use the full conversation history to create the routine. If the user asks to send a message through an app, include that app as a routine tool when it appears in the available tools catalog, and explain why in the tool's reason.
Keep the top-level message as a short summary of the routine, such as "This routine will send a Good Morning message every day at 8 AM on Slack."
Never claim a tool is connected if you cannot execute it directly. Suggest only tool slugs from the Available tools catalog.
`.trim();
};
