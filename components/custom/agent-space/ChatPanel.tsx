"use client";
import {ArrowUp, Copy, Loader, RefreshCw, Settings2, Sparkles,} from "lucide-react";
import { useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
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
import { AGENT_CHAT_RESET_EVENT } from "./agent-data";
import { EDIT_ROUTINE_EVENT, ROUTINE_RUN_EVENT, type SavedRoutine } from "./routine-events";

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

function ChatHeader({ agentConfig, onOpenConfiguration }: { agentConfig: AgentConfigType | null; onOpenConfiguration: () => void }) {
  return (
    <header className="flex h-[76px] shrink-0 items-center justify-between gap-2 border-b border-blue-100 bg-white px-3 sm:px-5 xl:px-7">
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
        <span className="hidden text-sm font-medium text-slate-500 sm:inline">Active</span>
        <span
          aria-label="Agent active"
          className="relative inline-flex h-6 w-11 rounded-full bg-emerald-500 p-[3px]"
        >
          <span className="ml-auto size-[18px] rounded-full bg-white shadow-sm" />
        </span>
        <button
          type="button"
          aria-label="Open agent configuration"
          title="Agent configuration"
          onClick={onOpenConfiguration}
          className="inline-flex size-10 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 text-blue-800 shadow-sm transition hover:border-blue-300 hover:bg-blue-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 xl:hidden"
        >
          <Settings2 className="size-5" />
        </button>
      </div>
    </header>
  );
}

function Conversation({
  messages,
  agentConfig,
  loading,
  onRoutineSaved,
}: {
  messages: MessageType[];
  agentConfig: AgentConfigType | null;
  loading: boolean;
  onRoutineSaved: (saved: { routineId?: string; routineName: string; updated: boolean }) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, loading]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-7 overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 xl:px-8 xl:py-10">
      {messages.map((msg) => (
        <div key={msg.id}>
          {msg.role === "agent" ? (
            <AgentMessage
              time={msg.time}
              agentAvatar={agentConfig?.agentImage || AGENT_AVATAR_URL}
              agentName={agentConfig?.name || "Orbit Assistant"}
              copyText={msg.response?.message || msg.content}
            >
              <AgentResponseView message={msg} onRoutineSaved={onRoutineSaved} />
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
      <div ref={bottomRef} />
    </div>
  );
}

function MessageComposer({
  userInput,
  setUserInput,
  handleMessageSend,
  loading,
  editingRoutine,
  onCancelEdit,
}: {
  userInput: string;
  setUserInput: (value: string) => void;
  handleMessageSend: () => void;
  loading: boolean;
  editingRoutine: SavedRoutine | null;
  onCancelEdit: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-4 sm:px-6 sm:pb-6 xl:px-8">
      {editingRoutine && (
        <div className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-xs text-blue-950">
          <span><strong>Editing routine:</strong> {editingRoutine.name}. Your next message will update this routine.</span>
          <button type="button" onClick={onCancelEdit} className="shrink-0 font-semibold text-blue-700 hover:text-blue-950">Cancel</button>
        </div>
      )}
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

export default function ChatPanel({ onOpenConfiguration }: { onOpenConfiguration: () => void }) {
  const [userInput, setUserInput] = useState("");
  const { agentId } = useParams<{ agentId: string }>();
  const [loading, setLoading] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState<SavedRoutine | null>(null);
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
  const [historyReady, setHistoryReady] = useState(false);
  const historyCursor = useRef<string | null>(null);
  const historyVersion = useRef(0);

  const syncChatHistory = useCallback(async () => {
    if (!agentId) return;
    const requestVersion = historyVersion.current;
    const { data } = await axios.get<{ messages: MessageType[] }>("/api/agent/chat", {
      params: { agentId, ...(historyCursor.current ? { afterId: historyCursor.current } : {}) },
    });
    if (requestVersion !== historyVersion.current) return;
    if (data.messages.length === 0) return;

    const incoming = data.messages.map((message) => ({
      ...message,
      time: new Date(message.time).toLocaleTimeString(),
    }));
    historyCursor.current = data.messages[data.messages.length - 1].id;
    setMessages((current) => {
      const existingIds = new Set(current.map((message) => message.id));
      const newMessages = incoming.filter((message) => !existingIds.has(message.id));
      return newMessages.length ? [...current, ...newMessages] : current;
    });
  }, [agentId]);

  useEffect(() => {
    if (!agentId) return;
    setHistoryReady(false);
    historyCursor.current = null;
    const requestVersion = historyVersion.current;
    let cancelled = false;
    axios.get<{ messages: MessageType[] }>("/api/agent/chat", { params: { agentId } })
      .then(({ data }) => {
        if (!cancelled && requestVersion === historyVersion.current && data.messages.length > 0) {
          historyCursor.current = data.messages[data.messages.length - 1].id;
          setMessages(data.messages.map((message) => ({
            ...message,
            time: new Date(message.time).toLocaleTimeString(),
          })));
        }
        else if (!cancelled && requestVersion === historyVersion.current) setMessages([{
          id: "Hello! Welcome to Orbit",
          role: "agent",
          content: "Hello! I am Agent, how can I help you today?",
          time: "Just now",
        }]);
      })
      .catch((error) => console.error("Could not load agent chat history:", error))
      .finally(() => { if (!cancelled) setHistoryReady(true); });
    return () => { cancelled = true; };
  }, [agentId]);

  useEffect(() => {
    const resetConversation = (event: Event) => {
      const resetAgentId = (event as CustomEvent<{ agentId?: string }>).detail?.agentId;
      if (resetAgentId !== agentId) return;
      historyVersion.current += 1;
      historyCursor.current = null;
      setUserInput("");
      setEditingRoutine(null);
      setMessages([{
        id: "Hello! Welcome to Orbit",
        role: "agent",
        content: "Hello! I am Agent, how can I help you today?",
        time: "Just now",
      }]);
      setHistoryReady(true);
    };

    window.addEventListener(AGENT_CHAT_RESET_EVENT, resetConversation);
    return () => window.removeEventListener(AGENT_CHAT_RESET_EVENT, resetConversation);
  }, [agentId]);

  useEffect(() => {
    if (!agentId || !historyReady) return;
    const intervalId = window.setInterval(() => {
      void syncChatHistory().catch((error) => console.error("Could not sync agent chat history:", error));
    }, 3500);
    return () => window.clearInterval(intervalId);
  }, [agentId, historyReady, syncChatHistory]);

  useEffect(() => {
    const handleEditRoutine = (event: Event) => {
      const routine = (event as CustomEvent<SavedRoutine>).detail;
      if (!routine?.id) return;

      setEditingRoutine(routine);
      const days = routine.schedule.weekDays.join(", ") || "not specified";
      const tools = routine.tools.map((tool) => tool.slug).join(", ") || "none";
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "agent",
          content: [
            `Editing existing routine: **${routine.name}**`,
            "",
            `- Goal: ${routine.goal}`,
            `- Task instructions: ${routine.instructions}`,
            `- Schedule: ${routine.schedule.startDate} at ${routine.schedule.time}, ${routine.schedule.frequency}; days ${days}; timezone ${routine.schedule.timezone}`,
            `- Tools: ${tools}`,
            "",
            "What would you like to change?",
          ].join("\n"),
          time: new Date().toLocaleTimeString(),
        },
      ]);
    };

    window.addEventListener(EDIT_ROUTINE_EVENT, handleEditRoutine);
    return () => window.removeEventListener(EDIT_ROUTINE_EVENT, handleEditRoutine);
  }, []);

  const handleRoutineSaved = useCallback((saved: { routineId?: string; routineName: string; updated: boolean }) => {
    if (saved.routineId) {
      setEditingRoutine((current) => current?.id === saved.routineId ? null : current);
    }
    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        role: "agent",
        content: saved.updated
          ? `**Routine Updated**: ${saved.routineName} is saved and listed in the Schedule tab.`
          : `**Routine Created**: ${saved.routineName} is saved and listed in the Schedule tab.`,
        time: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const watchRoutineExecution = useCallback((run: { routineId: string; routineName: string; executionId: string }) => {
    const poll = async () => {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1800));
        try {
          const { data } = await axios.get<{
            execution: { status: string; error: string | null; result: { message?: string } | null };
          }>(`/api/agent/routines/${run.routineId}/runs/${run.executionId}`);
          if (["queued", "running"].includes(data.execution.status)) continue;

          const succeeded = data.execution.status === "completed";
          const failed = data.execution.status === "failed";
          const detail = succeeded
            ? data.execution.result?.message ?? `${run.routineName} completed successfully.`
            : data.execution.error ?? `${run.routineName} ${data.execution.status}.`;
          const status = succeeded ? "completed" : failed ? "failed" : "cancelled";
          const content = `**Routine ${status}:** ${run.routineName}\n\n${detail}`;
          const messageId = `routine-execution:${run.executionId}`;
          const completionMessage: MessageType = {
            id: messageId,
            role: "agent",
            content,
            time: new Date().toLocaleTimeString(),
            routineExecution: {
              routineId: run.routineId,
              routineName: run.routineName,
              executionId: run.executionId,
              status,
            },
          };
          setMessages((current) => current.some((message) => message.id === messageId)
            ? current
            : [...current, completionMessage]);
          void axios.post("/api/agent/chat/history", {
            agentId,
            id: messageId,
            content,
            details: { routineExecution: completionMessage.routineExecution },
          }).catch((error) => console.error("Could not save routine result in chat history:", error));
          toast.add({
            title: succeeded ? "Routine finished" : failed ? "Routine failed" : "Routine cancelled",
            description: detail,
            type: succeeded ? "success" : failed ? "error" : "info",
          });
          window.dispatchEvent(new Event(ROUTINE_RUN_EVENT));
          return;
        } catch {
          // Keep polling through short network interruptions.
        }
      }
    };
    void poll();
  }, [agentId]);


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
      routineExecution?: { routineId: string; routineName: string; executionId: string };
      historyMessageId?: string;
    }>(
      "/api/agent/chat",
      {
        agentId,
        routineEditId: editingRoutine?.id ?? null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        messages: updatedMsgs.map(({ id, role, content, response }) => ({
          id,
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
      id: data.historyMessageId ?? crypto.randomUUID(),
      role: "agent",
      content: response.message,
      response,
      toolCards: data.toolCards ?? [],
      routineId: response.type === "routine" ? editingRoutine?.id : undefined,
      time: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, agentMsg]);
    if (data.routineExecution) {
      window.dispatchEvent(new Event(ROUTINE_RUN_EVENT));
      watchRoutineExecution(data.routineExecution);
    }
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
    <section className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
      <ChatHeader agentConfig={agentConfig} onOpenConfiguration={onOpenConfiguration} />

      <div className="flex min-h-0 flex-1 flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/80 via-slate-50/50 to-white">
        <Conversation
          messages={messages}
          agentConfig={agentConfig}
          loading={loading}
          onRoutineSaved={handleRoutineSaved}
        />

        <MessageComposer
          userInput={userInput}
          setUserInput={setUserInput}
          handleMessageSend={handleMessageSend}
          loading={loading}
          editingRoutine={editingRoutine}
          onCancelEdit={() => setEditingRoutine(null)}
        />
      </div>
    </section>
  );
}
