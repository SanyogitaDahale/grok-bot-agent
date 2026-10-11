"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { ExternalLink, Loader, Puzzle, Unplug } from "lucide-react";
import type { ToolSuggestionCardData } from "@/type/Message";
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

export function ToolSuggestionCard({ tool }: { tool: ToolSuggestionCardData }) {
  const { agentId } = useParams<{ agentId: string }>();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(tool.isConnected);
  const [error, setError] = useState("");

  const getConnectionStatus = useCallback(async () => {
    const response = await axios.get<{ isConnected: boolean }>(
      "/api/tools/status",
      {
        params: {
          agentId,
          toolkitSlug: tool.slug,
        },
      },
    );

    return response.data.isConnected;
  }, [agentId, tool.slug]);

  useEffect(() => {
    let cancelled = false;
    setCheckingConnection(true);

    getConnectionStatus()
      .then((status) => {
        if (!cancelled) {
          setIsConnected(status);
          setError("");
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setError(getApiErrorMessage(error, "Could not load connection status."));
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingConnection(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getConnectionStatus]);

  const connectTool = async () => {
    if (!agentId || connecting || disconnecting || checkingConnection || isConnected || !tool.isEnabled) return;

    setConnecting(true);
    setError("");

    try {
      const connected = await connectToolInPopup(agentId, tool.slug);
      if (connected) {
        setIsConnected(true);
      } else {
        setError("Connection was not completed. Please try again.");
      }
    } catch (error) {
      setError(getApiErrorMessage(error, "Could not start the connection. Please try again."));
    } finally {
      setConnecting(false);
    }
  };

  const disconnectTool = async () => {
    if (!agentId || connecting || disconnecting || checkingConnection || !isConnected) return;

    setDisconnecting(true);
    setError("");

    try {
      await axios.post("/api/tools/disconnect", {
        agentId,
        toolkitSlug: tool.slug,
      });
      setIsConnected(false);
    } catch (error) {
      setError(getApiErrorMessage(error, "Could not disconnect this app. Please try again."));
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <article className="w-full rounded-2xl border border-blue-100 bg-white p-3 shadow-[0_2px_8px_rgba(30,64,175,0.06)]">
      <div className="flex items-start gap-3">
        {tool.icon ? (
          <img
            src={tool.icon}
            alt=""
            className="size-9 shrink-0 rounded-md border border-blue-100 bg-white object-contain p-1"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-blue-100 bg-blue-50 text-blue-700">
            <Puzzle className="size-5" aria-hidden="true" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="font-medium leading-5 text-slate-900">
                {tool.name}
              </h4>
              <code className="text-[11px] text-slate-500">{tool.slug}</code>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium ${isConnected ? "border-emerald-100 bg-emerald-50 text-emerald-700" : tool.isEnabled ? "border-blue-100 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
              {isConnected ? "Connected" : tool.isEnabled ? "Not connected" : "Unavailable"}
            </span>
          </div>

          {tool.description && (
            <p className="mt-1 text-xs leading-4 text-slate-700">
              {tool.description}
            </p>
          )}

          <div className="mt-3 rounded-lg border border-blue-50 bg-gradient-to-br from-blue-50/80 to-slate-50 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-blue-700">
              Why this tool
            </p>
            <p className="mt-1 text-xs leading-4 text-slate-700">
              {tool.reason}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className={`text-[11px] font-medium ${tool.isEnabled ? "text-blue-700" : "text-slate-500"}`}>
              {tool.isEnabled ? "Enabled" : "Unavailable"}
            </span>
            <button
              type="button"
              onClick={isConnected ? disconnectTool : connectTool}
              disabled={connecting || disconnecting || checkingConnection || (!isConnected && !tool.isEnabled)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-blue-800 bg-gradient-to-r from-blue-700 to-blue-900 px-3 text-xs font-medium text-white shadow-sm shadow-blue-900/15 transition hover:from-blue-800 hover:to-blue-950 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting || disconnecting ? (
                <Loader className="size-3.5 animate-spin" aria-hidden="true" />
              ) : isConnected ? (
                <Unplug className="size-3.5" aria-hidden="true" />
              ) : (
                <ExternalLink className="size-3.5" aria-hidden="true" />
              )}
              {connecting
                ? "Connecting..."
                : disconnecting
                  ? "Disconnecting..."
                  : isConnected
                    ? "Disconnect"
                  : "Connect"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs text-red-600">
              {error}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
