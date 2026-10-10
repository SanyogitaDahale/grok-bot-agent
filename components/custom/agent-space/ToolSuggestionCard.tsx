"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";
import { Check, ExternalLink, Loader, Puzzle } from "lucide-react";
import type { ToolSuggestionCardData } from "@/type/Message";

export function ToolSuggestionCard({ tool }: { tool: ToolSuggestionCardData }) {
  const { agentId } = useParams<{ agentId: string }>();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const connectTool = async () => {
    if (!agentId || connecting || tool.isConnected || !tool.isEnabled) return;

    setConnecting(true);
    setError("");

    try {
      const { data } = await axios.post<{ redirectUrl: string }>(
        "/api/agent/tools/connect",
        { agentId, toolSlug: tool.slug },
      );
      window.location.assign(data.redirectUrl);
    } catch {
      setError("Could not start the connection. Please try again.");
      setConnecting(false);
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
              {tool.isConnected ? "Connected" : "Unavailable"}
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
              onClick={connectTool}
              disabled={connecting || tool.isConnected || !tool.isEnabled}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? (
                <Loader className="size-3.5 animate-spin" aria-hidden="true" />
              ) : tool.isConnected ? (
                <Check className="size-3.5" aria-hidden="true" />
              ) : (
                <ExternalLink className="size-3.5" aria-hidden="true" />
              )}
              {connecting
                ? "Connecting..."
                : tool.isConnected
                  ? "Connected"
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
