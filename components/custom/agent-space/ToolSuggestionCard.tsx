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
    <article className="w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start gap-3">
        {tool.icon ? (
          <img
            src={tool.icon}
            alt=""
            className="size-9 shrink-0 rounded-md border border-slate-200 object-contain p-1"
          />
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-500">
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
            <span className="shrink-0 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
              {isConnected ? "Connected" : tool.isEnabled ? "Not connected" : "Unavailable"}
            </span>
          </div>

          {tool.description && (
            <p className="mt-1 text-xs leading-4 text-slate-600">
              {tool.description}
            </p>
          )}

          <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
              Why this tool
            </p>
            <p className="mt-1 text-xs leading-4 text-slate-700">
              {tool.reason}
            </p>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="text-[11px] text-slate-500">
              {tool.isEnabled ? "Enabled" : "Unavailable"}
            </span>
            <button
              type="button"
              onClick={isConnected ? disconnectTool : connectTool}
              disabled={connecting || disconnecting || checkingConnection || (!isConnected && !tool.isEnabled)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60 ${isConnected ? "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" : "bg-blue-600 text-white hover:bg-blue-700"}`}
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
