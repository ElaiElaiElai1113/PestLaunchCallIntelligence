import {
  GEMINI_REQUEST_LIMITS,
  GROQ_REQUEST_LIMITS,
} from "../groq/analysis-request";
import { GroqProvider } from "../groq/provider";
import { GeminiProvider, GEMINI_MODEL } from "../gemini/provider";
export function selectedProvider() {
  const value = process.env.AI_PROVIDER?.trim() || "groq";
  if (value !== "groq" && value !== "gemini")
    throw new Error("AI_PROVIDER_INVALID");
  return value;
}
export function aiConfigured() {
  const analysis = Boolean(
    (selectedProvider() === "gemini"
      ? process.env.GEMINI_API_KEY
      : process.env.GROQ_API_KEY
    )?.trim(),
  );
  return (
    analysis &&
    (selectedProvider() !== "gemini" ||
      process.env.TRANSCRIPTION_PROVIDER !== "groq" ||
      Boolean(process.env.GROQ_API_KEY?.trim()))
  );
}
export function analysisModel() {
  return selectedProvider() === "gemini" ? GEMINI_MODEL : "openai/gpt-oss-120b";
}
export function createProvider(
  config: Omit<ConstructorParameters<typeof GroqProvider>[0], "apiKey"> = {},
) {
  return selectedProvider() === "gemini"
    ? new GeminiProvider({
        ...config,
        apiKey: process.env.GEMINI_API_KEY,
        transcriber:
          process.env.TRANSCRIPTION_PROVIDER === "groq"
            ? new GroqProvider({
                apiKey: process.env.GROQ_API_KEY,
                fetch: config.fetch,
                beforeDispatch: config.beforeDispatch,
              })
            : undefined,
      })
    : new GroqProvider({ ...config, apiKey: process.env.GROQ_API_KEY });
}

export function selectedRequestLimits() {
  return selectedProvider() === "gemini"
    ? GEMINI_REQUEST_LIMITS
    : GROQ_REQUEST_LIMITS;
}
