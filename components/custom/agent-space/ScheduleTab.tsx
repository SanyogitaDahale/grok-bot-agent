"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { CalendarClock, Clock3, Ellipsis, Loader, PauseCircle, Pencil, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EDIT_ROUTINE_EVENT, ROUTINE_SAVED_EVENT, type SavedRoutine } from "./routine-events";

const dayNames: Record<string, string> = {
  MO: "Mon", TU: "Tue", WE: "Wed", TH: "Thu", FR: "Fri", SA: "Sat", SU: "Sun",
};

function scheduleSummary(routine: SavedRoutine) {
  const { schedule } = routine;
  const days = schedule.weekDays.map((day) => dayNames[day]).join(", ");
  const frequency = schedule.frequency === "weekly" && days ? `Weekly · ${days}` : schedule.frequency;
  return `${frequency} at ${schedule.time} · Starts ${schedule.startDate} · ${schedule.timezone}`;
}

export default function ScheduleTab() {
  const { agentId } = useParams<{ agentId: string }>();
  const [routines, setRoutines] = useState<SavedRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [routineToDelete, setRoutineToDelete] = useState<SavedRoutine | null>(null);
  const [routineToToggle, setRoutineToToggle] = useState<{ routine: SavedRoutine; isActive: boolean } | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const loadRoutines = useCallback(async () => {
    if (!agentId) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.get<{ routines: SavedRoutine[] }>("/api/agent/routines", {
        params: { agentId },
      });
      setRoutines(data.routines);
    } catch {
      setError("Could not load this agent’s routines. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    void loadRoutines();
  }, [loadRoutines]);

  useEffect(() => {
    window.addEventListener(ROUTINE_SAVED_EVENT, loadRoutines);
    return () => window.removeEventListener(ROUTINE_SAVED_EVENT, loadRoutines);
  }, [loadRoutines]);

  const editRoutine = (routine: SavedRoutine, button: HTMLButtonElement) => {
    button.closest("details")?.removeAttribute("open");
    window.dispatchEvent(new CustomEvent(EDIT_ROUTINE_EVENT, { detail: routine }));
  };

  const deleteRoutine = async () => {
    if (!agentId || deletingId || !routineToDelete) return;
    const routine = routineToDelete;
    setDeletingId(routine.id);
    try {
      await axios.delete(`/api/agent/routines/${routine.id}`, { params: { agentId } });
      setRoutines((current) => current.filter((item) => item.id !== routine.id));
      setRoutineToDelete(null);
      toast.add({ title: "Routine deleted", description: `${routine.name} was removed.`, type: "success" });
    } catch (deleteError) {
      toast.add({
        title: "Could not delete routine",
        description: axios.isAxiosError<{ error?: string }>(deleteError)
          ? deleteError.response?.data?.error ?? "Please try again."
          : "Please try again.",
        type: "error",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const updateRoutineStatus = async () => {
    if (!agentId || updatingStatusId || !routineToToggle) return;
    const { routine, isActive } = routineToToggle;
    setUpdatingStatusId(routine.id);
    try {
      await axios.patch(`/api/agent/routines/${routine.id}`, { agentId, isActive });
      setRoutines((current) => current.map((item) => item.id === routine.id ? { ...item, isActive } : item));
      setRoutineToToggle(null);
      toast.add({
        title: isActive ? "Routine activated" : "Routine deactivated",
        description: `${routine.name} is now ${isActive ? "active" : "inactive"}.`,
        type: "success",
      });
    } catch (statusError) {
      toast.add({
        title: `Could not ${isActive ? "activate" : "deactivate"} routine`,
        description: axios.isAxiosError<{ error?: string }>(statusError)
          ? statusError.response?.data?.error ?? "Please try again."
          : "Please try again.",
        type: "error",
      });
    } finally {
      setUpdatingStatusId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-800">Scheduled routines</h3>
        <p className="mt-1 text-[13px] leading-5 text-slate-500">
          Routines created with this agent. Edit a routine through chat or remove it here.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white p-6 text-sm text-slate-500">
          <Loader className="size-4 animate-spin text-blue-700" /> Loading routines...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button type="button" onClick={() => void loadRoutines()} className="mt-2 font-semibold underline underline-offset-2">Retry</button>
        </div>
      ) : routines.length === 0 ? (
        <div className="rounded-xl border border-dashed border-blue-200 bg-white/80 px-4 py-8 text-center">
          <CalendarClock className="mx-auto size-8 text-blue-300" />
          <p className="mt-3 text-sm font-medium text-slate-700">No routines yet</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">Ask your agent to schedule a task. Once all details are ready, create it from the routine card in chat.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {routines.map((routine) => (
            <li key={routine.id} className="rounded-2xl border border-blue-100 bg-white p-4 shadow-[0_3px_12px_rgba(30,64,175,0.06)] transition hover:border-blue-200 hover:shadow-[0_5px_18px_rgba(30,64,175,0.09)]">
              <div className="flex items-start gap-3.5">
                <div className="min-w-0 flex-1">
                  <h4 className="break-words text-[16px] font-semibold leading-5 tracking-[-0.02em] text-slate-900">{routine.name}</h4>
                  <div className="mt-2">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${routine.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      <span className={`size-1.5 rounded-full ${routine.isActive ? "bg-emerald-500" : "bg-slate-400"}`} aria-hidden="true" />
                      {routine.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-6 text-slate-600">{routine.goal}</p>
                </div>
                <details className="group relative shrink-0">
                  <summary aria-label={`Options for ${routine.name}`} className="flex size-9 cursor-pointer list-none items-center justify-center rounded-xl text-slate-500 transition hover:bg-blue-50 hover:text-blue-800 [&::-webkit-details-marker]:hidden">
                    <Ellipsis className="size-[21px]" />
                  </summary>
                  <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                    <button type="button" onClick={(event) => editRoutine(routine, event.currentTarget)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-900">
                      <Pencil className="size-3.5" /> Edit in chat
                    </button>
                    <button type="button" disabled={Boolean(deletingId || updatingStatusId)} onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setRoutineToToggle({ routine, isActive: !routine.isActive });
                    }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-900 disabled:opacity-50">
                      {routine.isActive ? <PauseCircle className="size-3.5" /> : <PlayCircle className="size-3.5" />}
                      {routine.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button type="button" disabled={Boolean(deletingId || updatingStatusId)} onClick={(event) => {
                      event.currentTarget.closest("details")?.removeAttribute("open");
                      setRoutineToDelete(routine);
                    }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50">
                      <Trash2 className="size-3.5" />
                      Delete
                    </button>
                  </div>
                </details>
              </div>

              <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-blue-50/80 px-3 py-2.5 text-[12px] leading-5 text-blue-950 ring-1 ring-blue-100/70">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-blue-700" />
                <span>{scheduleSummary(routine)}</span>
              </div>
              <details className="mt-3">
                <summary className="cursor-pointer text-[12px] font-medium text-blue-700 marker:text-blue-500 hover:text-blue-900">View routine instructions</summary>
                <p className="mt-2 whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs leading-5 text-slate-700">{routine.instructions}</p>
              </details>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={Boolean(routineToDelete)}
        onOpenChange={(open) => {
          if (!open && !deletingId && !updatingStatusId) setRoutineToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this routine?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove “{routineToDelete?.name}” from this agent’s schedule.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(deletingId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={Boolean(deletingId)}
              onClick={() => void deleteRoutine()}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deletingId ? <Loader className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Delete routine
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(routineToToggle)}
        onOpenChange={(open) => {
          if (!open && !updatingStatusId) setRoutineToToggle(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {routineToToggle?.isActive ? "Activate this routine?" : "Deactivate this routine?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {routineToToggle?.isActive
                ? `“${routineToToggle.routine.name}” will be marked active again.`
                : `“${routineToToggle?.routine.name}” will be marked inactive. You can activate it again from the menu.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={Boolean(updatingStatusId)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={Boolean(updatingStatusId)}
              onClick={() => void updateRoutineStatus()}
              className={routineToToggle?.isActive ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-amber-600 text-white hover:bg-amber-700"}
            >
              {updatingStatusId ? <Loader className="size-4 animate-spin" /> : routineToToggle?.isActive ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
              {routineToToggle?.isActive ? "Activate routine" : "Deactivate routine"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
