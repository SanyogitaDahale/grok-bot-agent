"use client";

import axios from "axios";
import { CheckCircle2, Clock3, History, LoaderCircle, XCircle } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ROUTINE_RUN_EVENT } from "./routine-events";

type Execution = {
  id: string;
  routineName: string;
  status: string;
  runType: string;
  scheduledFor: string;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  result: { message?: string } | null;
  error: string | null;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function ExecutionStatus({ status }: { status: string }) {
  const completed = status === "completed";
  const failed = status === "failed";
  const Icon = completed ? CheckCircle2 : failed ? XCircle : status === "running" ? LoaderCircle : Clock3;
  const colors = completed
    ? "bg-emerald-50 text-emerald-700"
    : failed
      ? "bg-rose-50 text-rose-700"
      : status === "cancelled"
        ? "bg-slate-100 text-slate-600"
        : "bg-amber-50 text-amber-700";
  const label = completed ? "Success" : failed ? "Failed" : status;

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold capitalize ${colors}`}>
      <Icon className={`size-3 ${status === "running" ? "animate-spin" : ""}`} />
      {label}
    </span>
  );
}

export default function ExecutionHistoryTab() {
  const { agentId } = useParams<{ agentId: string }>();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExecutions = useCallback(async () => {
    if (!agentId) return;
    try {
      const { data } = await axios.get<{ executions: Execution[] }>("/api/agent/executions", { params: { agentId } });
      setExecutions(data.executions);
      setError(null);
    } catch {
      setError("Could not load routine executions.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadExecutions();
    window.addEventListener(ROUTINE_RUN_EVENT, loadExecutions);
    return () => window.removeEventListener(ROUTINE_RUN_EVENT, loadExecutions);
  }, [loadExecutions]);

  return (
    <section aria-label="Routine Execution History" className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-blue-950">Routine Execution History</h3>
        <p className="mt-1 text-sm text-slate-500">Recent runs for this agent, including their final results.</p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="size-4 animate-spin" /> Loading executions…</div>
      ) : error ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>
      ) : executions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white/70 px-4 py-8 text-center">
          <History className="mx-auto size-6 text-blue-300" />
          <p className="mt-2 text-sm font-medium text-slate-700">No routine executions yet</p>
          <p className="mt-1 text-xs text-slate-500">Completed and failed runs will appear here.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {executions.map((execution) => {
            const summary = execution.result?.message || execution.error || `Routine ${execution.status}.`;
            const completionTime = execution.completedAt
              ? formatDate(execution.completedAt)
              : execution.startedAt
                ? `Started ${formatDate(execution.startedAt)}`
                : `Queued ${formatDate(execution.queuedAt)}`;
            return (
              <li key={execution.id} className="rounded-xl border border-blue-100 bg-white p-3.5 shadow-sm shadow-blue-950/[0.03]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-blue-950">{execution.routineName}</p>
                    <p className="mt-1 text-xs text-slate-500">{completionTime}</p>
                  </div>
                  <ExecutionStatus status={execution.status} />
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-5 text-slate-600">{summary}</p>
                <p className="mt-2 text-[11px] capitalize text-slate-400">{execution.runType} run · scheduled {formatDate(execution.scheduledFor)}</p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
