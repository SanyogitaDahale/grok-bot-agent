"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { ExternalLink, Loader, Unplug } from "lucide-react";
import { CONNECTABLE_TOOLS } from "./agent-data";
import { connectToolInPopup } from "./tool-connection";

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
  const [connectingSlug, setConnectingSlug] = useState<string | null>(null);
  const [disconnectingSlug, setDisconnectingSlug] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!agentId) return;

    let cancelled = false;
    Promise.all(
      CONNECTABLE_TOOLS.map(async ({ slug }) => {
        try {
          const { data } = await axios.get<{ isConnected: boolean }>(
            "/api/tools/status",
            { params: { agentId, toolkitSlug: slug } },
          );
          return { slug, isConnected: data.isConnected, error: undefined };
        } catch {
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
        }
      })
      .catch(() => {
        if (!cancelled) setError("Could not load connection status.");
      });

    return () => {
      cancelled = true;
    };
  }, [agentId]);

  const connectTool = async (toolSlug: string) => {
    if (!agentId || connectingSlug || connectedSlugs.has(toolSlug)) return;

    setConnectingSlug(toolSlug);
    setError("");

    try {
      const connected = await connectToolInPopup(agentId, toolSlug);
      if (connected) {
        setConnectedSlugs((current) => new Set(current).add(toolSlug));
      } else {
        setError("Connection was not completed. Please try again.");
      }
    } catch (error) {
      setError(
        getApiErrorMessage(
          error,
          "Could not start the connection. Check that this tool is enabled and try again.",
        ),
      );
      setConnectingSlug(null);
    }
  };

  const disconnectTool = async (toolSlug: string) => {
    if (!agentId || connectingSlug || disconnectingSlug || !connectedSlugs.has(toolSlug)) return;

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
      <h3 className="mb-4 text-sm font-semibold text-slate-800">
        Connect your tools
      </h3>
      <div className="space-y-2">
        {CONNECTABLE_TOOLS.map(({ slug, name, detail, icon: Icon, tint }) => {
          const isConnected = connectedSlugs.has(slug);
          const isConnecting = connectingSlug === slug;
          const isDisconnecting = disconnectingSlug === slug;
          const isBusy = Boolean(connectingSlug || disconnectingSlug);

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
              <button
                type="button"
                onClick={() => isConnected ? disconnectTool(slug) : connectTool(slug)}
                disabled={!agentId || isBusy}
                aria-label={`${isConnected ? "Disconnect" : "Connect to"} ${name}`}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 text-[12px] font-medium text-blue-900 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isConnecting || isDisconnecting ? (
                  <Loader className="size-3 animate-spin" aria-hidden="true" />
                ) : isConnected ? (
                  <Unplug className="size-3" aria-hidden="true" />
                ) : (
                  <ExternalLink className="size-3" aria-hidden="true" />
                )}
                {isConnecting ? "Connecting..." : isDisconnecting ? "Disconnecting..." : isConnected ? "Disconnect" : "Connect"}
              </button>
            </div>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-center text-[12px] text-red-600">
          {error}
        </p>
      )}
      <p className="mt-3 text-center text-[12px] text-slate-400">
        Connect apps to give your agent more context.
      </p>
    </div>
  );
}
