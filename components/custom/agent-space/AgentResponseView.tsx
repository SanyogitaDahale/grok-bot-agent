import type { MessageType, ToolSuggestionCardData } from "@/type/Message";
import { RoutineCard } from "./RoutineCard";
import { ToolSuggestionCard } from "./ToolSuggestionCard";
import { FormattedAgentMessage } from "./FormattedAgentMessage";

type AgentResponseViewProps = {
  message: MessageType;
  onRoutineSaved?: (saved: { routineId?: string; routineName: string; updated: boolean }) => void;
};

export function AgentResponseView({ message, onRoutineSaved }: AgentResponseViewProps) {
  const response = message.response;

  if (!response) {
    return <FormattedAgentMessage text={message.content} />;
  }

  switch (response.type) {
    case "message":
      return <FormattedAgentMessage text={response.message} />;

    case "clarification":
      return (
        <div className="space-y-3">
          <FormattedAgentMessage text={response.message} />
          <ol className="ml-1 list-decimal space-y-2 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm leading-6 text-slate-700 shadow-sm">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ol>
        </div>
      );

    case "routine":
      return (
        <div className="space-y-3">
          <FormattedAgentMessage text={response.message} />
          {response.routine && (
            <RoutineCard
              routine={response.routine}
              toolCards={message.toolCards ?? []}
              routineId={message.routineId}
              onRoutineSaved={onRoutineSaved}
            />
          )}
        </div>
      );

    case "tool_connection":
      return (
        <div className="space-y-3">
          <FormattedAgentMessage text={response.message} />
          {response.suggestedTools.map((suggestion) => {
            const catalogTool = message.toolCards?.find(
              (tool) => tool.slug === suggestion.slug,
            );
            const tool: ToolSuggestionCardData = {
              slug: suggestion.slug,
              name: catalogTool?.name ?? suggestion.slug,
              description: catalogTool?.description ?? "",
              reason: suggestion.reason,
              icon: catalogTool?.icon,
              isConnected: catalogTool?.isConnected ?? false,
              isEnabled: catalogTool?.isEnabled ?? true,
            };

            return <ToolSuggestionCard key={tool.slug} tool={tool} />;
          })}
        </div>
      );
  }
}
