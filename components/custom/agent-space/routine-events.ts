import type { RoutineDraft } from "@/lib/openai/agent-response-schema";

export type SavedRoutine = RoutineDraft & {
  id: string;
  createdAt: string;
  isActive: boolean;
};

export const EDIT_ROUTINE_EVENT = "agent:edit-routine";
export const ROUTINE_SAVED_EVENT = "agent:routine-saved";

export function notifyRoutineSaved() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ROUTINE_SAVED_EVENT));
  }
}
