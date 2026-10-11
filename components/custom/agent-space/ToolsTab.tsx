"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Check, Loader, Unplug } from "lucide-react";
import { CONNECTABLE_TOOLS } from "./agent-data";

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    axios.isAxiosError<{ error?: string }>(error) &&
    typeof error.response?.data?.error === "string"
  ) {
    return error.response.data.error;
  }

  if (error instanceof Error) return error.message;

  return fallback;
}

export default function ToolsTab() {
  const params = useParams<{ agentId: string }>();
  const agentId = params?.agentId;
  const [connectedSlugs, setConnectedSlugs] = useState<Set<string>>(
    () => new Set(),
  );
  const [disconnectingSlug, setDisconnectingSlug] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) {
      setLoadingStatus(false);
      return;
    }

    let cancelled = false;
    setLoadingStatus(true);
    setError("");
    Promise.all(
      CONNECTABLE_TOOLS.map(async ({ slug }) => {
        try {
          const { data } = await axios.get<{ isConnected: boolean }>(
            "/api/tools/status",
            { params: { agentId, toolkitSlug: slug } },
          );
          return { slug, isConnected: data.isConnected, error: undefined };
        } catch (error) {
          return {
            slug,
            isConnected: null,
            error: getApiErrorMessage(error, "Could not load connection status."),
          };
        }
      }),
    )
      .then((statuses) => {
        if (!cancelled) {
          setConnectedSlugs(
            new Set(
              statuses
                .filter((status) => status.isConnected === true)
                .map((status) => status.slug),
            ),
          );
          if (statuses.some((status) => status.isConnected === null)) {
            setError(
              statuses.find((status) => status.isConnected === null)?.error ??
                "Some tool connection statuses could not be loaded.",
            );
          }
          setLoadingStatus(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Could not load connection status.");
          setLoadingStatus(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const disconnectTool = async (toolSlug: string) => {
    if (!agentId || disconnectingSlug || !connectedSlugs.has(toolSlug)) return;

    setDisconnectingSlug(toolSlug);
    setError("");

    try {
      await axios.post("/api/tools/disconnect", {
        agentId,
        toolkitSlug: toolSlug,
      });
      setConnectedSlugs((current) => {
        const next = new Set(current);
        next.delete(toolSlug);
        return next;
      });
    } catch (error) {
      setError(getApiErrorMessage(error, "Could not disconnect this app. Please try again."));
    } finally {
      setDisconnectingSlug(null);
    }
  };

  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold text-slate-800">
        Connected tools
      </h3>
      <p className="mb-4 text-xs text-slate-500">
        Apps currently connected to this agent.
      </p>
      {loadingStatus ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-blue-100 bg-white/80 px-4 py-8 text-sm text-slate-500">
          <Loader className="size-4 animate-spin" aria-hidden="true" />
          Checking tool connections...
        </div>
      ) : connectedSlugs.size > 0 ? (
        <div className="space-y-2">
          {CONNECTABLE_TOOLS.filter(({ slug }) => connectedSlugs.has(slug)).map(({ slug, name, detail, icon: Icon, tint }) => {
            const isDisconnecting = disconnectingSlug === slug;

            return (
              <div
                key={slug}
                className="flex items-center gap-3 rounded-xl border border-blue-100 bg-white/90 p-3 shadow-sm shadow-blue-100/50 transition hover:border-blue-300 hover:shadow-blue-100"
              >
                <span
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${tint}`}
                >
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">{name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-slate-500">
                    {detail}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                  <Check className="size-3" aria-hidden="true" />
                  Connected
                </span>
                <button
                  type="button"
                  onClick={() => disconnectTool(slug)}
                  disabled={!agentId || Boolean(disconnectingSlug)}
                  aria-label={`Disconnect ${name}`}
                  className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-800 bg-gradient-to-r from-blue-700 to-blue-900 px-2.5 text-[12px] font-medium text-white shadow-sm shadow-blue-900/15 transition hover:from-blue-800 hover:to-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDisconnecting ? (
                    <Loader className="size-3 animate-spin" aria-hidden="true" />
                  ) : (
                    <Unplug className="size-3" aria-hidden="true" />
                  )}
                  {isDisconnecting ? "Disconnecting..." : "Disconnect"}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white/70 px-4 py-8 text-center">
          <p className="text-sm font-medium text-slate-700">No tools connected</p>
          <p className="mt-1 text-xs text-slate-500">
            Ask your agent to connect an app when you need it.
          </p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-center text-[12px] text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
