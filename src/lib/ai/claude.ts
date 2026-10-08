import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Usa ANTHROPIC_API_KEY (ou outra credencial da Anthropic) do ambiente.
export const anthropic = new Anthropic();

export const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-opus-5-5";
