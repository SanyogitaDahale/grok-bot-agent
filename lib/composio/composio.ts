import { Composio } from "@composio/core";
import { OpenAIAgentsProvider } from "@composio/openai-agents";

export class ComposioConfigurationError extends Error {
  constructor() {
    super("Tool integrations are not configured. Set COMPOSIO_API_KEY.");
    this.name = "ComposioConfigurationError";
  }
}

function createComposioClient(apiKey: string) {
  return new Composio({
    apiKey,
    provider: new OpenAIAgentsProvider(),
  });
}

let composioClient: ReturnType<typeof createComposioClient> | undefined;

export function getComposio() {
  const apiKey = process.env.COMPOSIO_API_KEY?.trim();
  if (!apiKey) {
    throw new ComposioConfigurationError();
  }

  composioClient ??= createComposioClient(apiKey);
  return composioClient;
}
