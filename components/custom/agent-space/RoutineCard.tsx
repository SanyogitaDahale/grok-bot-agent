"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { CalendarDays, Check, Clock3, Loader, Plus, Repeat2 } from "lucide-react";
import type { RoutineDraft } from "@/lib/openai/agent-response-schema";
import type { ToolSuggestionCardData } from "@/type/Message";
import { ToolSuggestionCard } from "./ToolSuggestionCard";

const weekdayLabels: Record<string, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

export function RoutineCard({
  routine,
  toolCards = [],
}: {
  routine: RoutineDraft;
  toolCards?: ToolSuggestionCardData[];
}) {
  const { agentId } = useParams<{ agentId: string }>();
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(false);
  const [error, setError] = useState("");
  const schedule = routine.schedule;
  const dayLabels = schedule.weekDays.map((day) => weekdayLabels[day]);
  const scheduledDays =
    schedule.frequency === "daily"
      ? Object.values(weekdayLabels)
      : dayLabels;
  const suggestions: Array<{
    tool: ToolSuggestionCardData;
  }> = routine.tools.map((suggestion) => {
    const catalogTool = toolCards.find((tool) => tool.slug === suggestion.slug);

    return {
      tool: catalogTool
        ? { ...catalogTool, reason: suggestion.reason }
        : {
            slug: suggestion.slug,
            name: suggestion.slug,
            description: "",
            reason: suggestion.reason,
            isConnected: false,
            isEnabled: true,
          },
    };
  });
  const routineToolSlugs = new Set(routine.tools.map((tool) => tool.slug));
  toolCards
    .filter((tool) => !routineToolSlugs.has(tool.slug))
    .forEach((tool) => suggestions.push({ tool }));

  const createRoutine = async () => {
    if (!agentId || saving || created) return;

    setSaving(true);
    setError("");

    try {
      await axios.post("/api/agent/routines", { agentId, routine });
      setCreated(true);
    } catch {
      setError("Could not create this routine. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-sm">
      <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
            <CalendarDays className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
              Suggested routine
            </p>
            <h3 className="mt-1 text-base font-semibold text-slate-950">
              {routine.name}
            </h3>
            <p className="mt-1 text-sm leading-5 text-slate-600">
              {routine.goal}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Instructions
          </h4>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-800">
            {routine.instructions}
          </p>
        </section>

        <div className="grid gap-2 sm:grid-cols-2">
          <div className="flex min-h-[58px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">Starts</p>
              <p className="font-medium">{schedule.startDate}</p>
            </div>
          </div>
          <div className="flex min-h-[58px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <Clock3 className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">Time</p>
              <p className="font-medium">{schedule.time}</p>
            </div>
          </div>
          <div className="flex min-h-[58px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <Repeat2 className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">Frequency</p>
              <p className="font-medium capitalize">{schedule.frequency}</p>
            </div>
          </div>
          <div className="flex min-h-[58px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
            <CalendarDays className="mt-0.5 size-4 shrink-0 text-blue-700" aria-hidden="true" />
            <div>
              <p className="text-xs text-slate-500">Timezone</p>
              <p className="font-medium">{schedule.timezone}</p>
            </div>
          </div>
        </div>

        {scheduledDays.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Scheduled days">
            {scheduledDays.map((day) => (
              <span
                key={day}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
              >
                {day}
              </span>
            ))}
          </div>
        )}

        {suggestions.length > 0 && (
          <section aria-label="Suggested tools" className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-800">
              Required tools
            </h4>
            <p className="text-xs text-slate-500">
              Suggested from the routine requirements
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map(({ tool }) => (
                <ToolSuggestionCard key={tool.slug} tool={tool} />
              ))}
            </div>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            {created
              ? "Routine created with its suggested tools."
              : `${suggestions.length} tool${suggestions.length === 1 ? "" : "s"} will be attached.`}
          </p>
          <button
            type="button"
            onClick={createRoutine}
            disabled={saving || created || !agentId}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-800 px-3.5 text-sm font-medium text-white transition hover:bg-blue-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader className="size-4 animate-spin" aria-hidden="true" />
            ) : created ? (
              <Check className="size-4" aria-hidden="true" />
            ) : (
              <Plus className="size-4" aria-hidden="true" />
            )}
            {saving ? "Creating..." : created ? "Created" : "Create routine"}
          </button>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
