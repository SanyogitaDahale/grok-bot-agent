import type { MessageType, ToolSuggestionCardData } from "@/type/Message";
import { RoutineCard } from "./RoutineCard";
import { ToolSuggestionCard } from "./ToolSuggestionCard";

type AgentResponseViewProps = {
  message: MessageType;
};

export function AgentResponseView({ message }: AgentResponseViewProps) {
  const response = message.response;

  if (!response) {
    return <p className="whitespace-pre-wrap">{message.content}</p>;
  }

  switch (response.type) {
    case "message":
      return <p className="whitespace-pre-wrap">{response.message}</p>;

    case "clarification":
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap">{response.message}</p>
          <ol className="list-decimal space-y-1.5 pl-5">
            {response.questions.map((question) => (
              <li key={question.id}>{question.question}</li>
            ))}
          </ol>
        </div>
      );

    case "routine":
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap">{response.message}</p>
          {response.routine && (
            <RoutineCard
              routine={response.routine}
              toolCards={message.toolCards ?? []}
            />
          )}
        </div>
      );

    case "tool_connection":
      return (
        <div className="space-y-3">
          <p className="whitespace-pre-wrap">{response.message}</p>
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
