"use client";
import {ArrowUp, Copy, Loader, MoreHorizontal, RefreshCw, Sparkles,} from "lucide-react";
import { useContext, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { AGENT_AVATAR_URL } from "./agent-data";
import type { MessageType } from "@/type/Message";
import { AgentResponseView } from "./AgentResponseView";
import axios from "axios";
import { toast } from "@/components/ui/toast";
import { AgentConfigContext } from "@/context/AgentConfigContext";
import type { AgentConfigType } from "@/type/agent";
import type { AgentResponse } from "@/lib/openai/agent-response-schema";
import type { ToolSuggestionCardData } from "@/type/Message";

function AgentMessage({
  children,
  time,
  agentAvatar,
  agentName,
  copyText,
}: {
  children: ReactNode;
  time: string;
  agentAvatar: string;
  agentName: string;
  copyText: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <img
        src={agentAvatar}
        alt={agentName || "Agent avatar"}
        className="mt-0.5 size-8 shrink-0 rounded-lg border border-blue-100 bg-white ring-2 ring-blue-50"
      />

      <div className="min-w-0 max-w-[84%]">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-sm font-semibold text-blue-950">
            {agentName}
          </span>
          <span className="text-[13px] text-slate-400">{time}</span>
        </div>

        <div className="whitespace-pre-wrap text-[15px] leading-6 text-slate-600">
          {children}
        </div>

        <div className="mt-3 flex items-center gap-1 text-slate-400">
          <button
            type="button"
            aria-label="Copy response"
            onClick={() => navigator.clipboard.writeText(copyText)}
            className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-600"
          >
            <Copy className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Regenerate response"
            className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-600"
          >
            <RefreshCw className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatHeader({ agentConfig }: { agentConfig: AgentConfigType | null }) {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between border-b border-blue-100 bg-white px-7">
      <div className="flex min-w-0 items-center gap-3">
        <img
          src={agentConfig?.agentImage || AGENT_AVATAR_URL}
          alt="Orbit assistant avatar"
          className="size-10 rounded-xl border border-blue-200 bg-blue-50 object-cover ring-2 ring-blue-50"
        />
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-tight">
            {agentConfig?.name || "Orbit Assistant"}
          </h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <span className="size-1.5 rounded-full bg-cyan-500 shadow-[0_0_0_3px_rgba(6,182,212,0.12)]" />
            Ready to help
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <span className="text-sm font-medium text-slate-500">Active</span>
        <span
          aria-label="Agent active"
          className="relative inline-flex h-6 w-11 rounded-full bg-emerald-500 p-[3px]"
        >
          <span className="ml-auto size-[18px] rounded-full bg-white shadow-sm" />
        </span>
        <button
          type="button"
          aria-label="More chat options"
          className="ml-1 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
        >
          <MoreHorizontal className="size-5" />
        </button>
      </div>
    </header>
  );
}

function Conversation({
  messages,
  agentConfig,
  loading,
}: {
  messages: MessageType[];
  agentConfig: AgentConfigType | null;
  loading: boolean;
}) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 overflow-y-auto px-8 py-10">
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === "agent" ? (
            <AgentMessage
              time={msg.time}
              agentAvatar={agentConfig?.agentImage || AGENT_AVATAR_URL}
              agentName={agentConfig?.name || "Orbit Assistant"}
              copyText={msg.response?.message || msg.content}
            >
              <AgentResponseView message={msg} />
            </AgentMessage>
          ) : (
            <div className="flex justify-end">
              <div className="max-w-[78%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-gradient-to-br from-blue-800 via-blue-900 to-slate-950 px-4 py-3 text-[15px] leading-6 text-white shadow-[0_8px_24px_rgba(15,39,120,0.28)]">
                {msg.content}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Loading State Code */}
      {loading && (
        <div
          className="flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <img
            src={agentConfig?.agentImage || AGENT_AVATAR_URL}
            alt=""
            className="size-8 shrink-0 rounded-lg border border-blue-100 bg-white ring-2 ring-blue-50"
          />
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Loader className="size-4 animate-spin" />
            <span>{agentConfig?.name || "Your agent"} is thinking...</span>
          </div>
        </div>
      )}
    </div>
  );
}

function MessageComposer({
  userInput,
  setUserInput,
  handleMessageSend,
  loading,
}: {
  userInput: string;
  setUserInput: (value: string) => void;
  handleMessageSend: () => void;
  loading: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-8 pb-6">
      <div className="rounded-2xl border border-blue-100 bg-white/95 p-3 shadow-[0_8px_28px_rgba(15,39,120,0.12)] transition focus-within:border-blue-300 focus-within:ring-2 focus-within:ring-blue-100">
        <textarea
          aria-label="Message your agent"
          rows={2}
          placeholder="Ask your agent anything..."
          value={userInput}
          onChange={(event) => setUserInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleMessageSend();
            }
          }}
          className="w-full resize-none bg-transparent px-1 py-1 text-base leading-6 text-slate-800 outline-none placeholder:text-slate-400"
        />

        <div className="flex items-center justify-between pt-2">
          <span className="flex items-center gap-1.5 text-[13px] text-blue-800">
            <Sparkles className="size-3.5" />
            {loading ? "Your agent is responding..." : "Your agent is ready"}
          </span>

          <button
            type="button"
            aria-label="Send message"
            onClick={handleMessageSend}
            disabled={loading}
            className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-800 to-blue-950 text-white shadow-md shadow-blue-200 transition hover:from-blue-900 hover:to-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </button>
        </div>
      </div>

      <p className="mt-2.5 text-center text-[12px] text-slate-400">
        Your agent can make mistakes. Review important information.
      </p>
    </div>
  );
}

export default function ChatPanel() {
  const [userInput, setUserInput] = useState("");
  const { agentId } = useParams<{ agentId: string }>();
  const [loading, setLoading] = useState(false);
  const agentConfig: AgentConfigType | null =
    useContext(AgentConfigContext)?.agentConfig ?? null;
  const [messages, setMessages] = useState<MessageType[]>([
    {
      id: "Hello! Welcome to Orbit",
      role: "agent",
      content: "Hello! I am Agent, how can I help you today?",
      time: "Just now",
    },
  ]);


const handleMessageSend = async () => {
  if (!userInput.trim() || !agentId || loading) {
    return;
  }

  const userMsg: MessageType = {
    id: crypto.randomUUID(),
    role: "user",
    content: userInput.trim(),
    time: new Date().toLocaleTimeString(),
  };

  const updatedMsgs = [...messages, userMsg];

  setMessages(updatedMsgs);
  setUserInput("");
  setLoading(true);

  try {
    const { data } = await axios.post<{
      response: AgentResponse;
      toolCards?: ToolSuggestionCardData[];
    }>(
      "/api/agent/chat",
      {
        agentId,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        messages: updatedMsgs.map(({ role, content, response }) => ({
          role,
          content:
            response?.type === "clarification"
              ? [
                  response.message,
                  ...response.questions.map((item) => item.question),
                ].join("\n")
              : content,
        })),
      }
    );

    const response = data.response;

    const agentMsg: MessageType = {
      id: crypto.randomUUID(),
      role: "agent",
      content: response.message,
      response,
      toolCards: data.toolCards ?? [],
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, agentMsg]);
  } catch (error) {
    console.error("Error sending message:", error);

    toast.add({
      type: "error",
      title: "Could not send message",
      description: axios.isAxiosError<{ error?: string }>(error)
        ? error.response?.data?.error ?? "Please try again."
        : "Please try again.",
    });
  } finally {
    setLoading(false);
  }
};


  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <ChatHeader agentConfig={agentConfig} />

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-slate-50/50 to-white">
        <Conversation
          messages={messages}
          agentConfig={agentConfig}
          loading={loading}
        />

        <MessageComposer
          userInput={userInput}
          setUserInput={setUserInput}
          handleMessageSend={handleMessageSend}
          loading={loading}
        />
      </div>
    </section>
  );
}
