import { z } from "zod";

export const toolSuggestionSchema = z.object({
  slug: z.string().trim().min(1),
  reason: z.string().trim().min(1),
});

export const routineSchema = z.object({
  name: z.string().trim().min(1),
  goal: z.string().trim().min(1),

  // Generated for this routine only.
  instructions: z.string().trim().min(1),

  schedule: z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    time: z.string().regex(/^\d{2}:\d{2}$/), // HH:mm
    timezone: z.string().trim().min(1), // America/New_York
    frequency: z.enum(["once", "daily", "weekly", "monthly"]),
    weekDays: z.array(
      z.enum(["MO", "TU", "WE", "TH", "FR", "SA", "SU"]),
    ),
  }),

  tools: z.array(toolSuggestionSchema),
});

export const agentResponseSchema = z.object({
  type: z.enum(["message", "clarification", "routine", "tool_connection"]),
  message: z.string(),
  questions: z.array(z.object({
    id: z.string(),
    question: z.string(),
  })),

  suggestedTools: z.array(toolSuggestionSchema),
  routine: routineSchema.nullable(),
});

export type AgentResponse = z.infer<typeof agentResponseSchema>;
export type RoutineDraft = z.infer<typeof routineSchema>;
export type ToolSuggestion = z.infer<typeof toolSuggestionSchema>;

