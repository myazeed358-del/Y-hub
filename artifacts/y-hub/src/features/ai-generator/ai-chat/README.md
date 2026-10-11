# AI Chat

## Purpose
Manage chat messages and AI Tutor responses in Y-Hub.

## Current files
- chat.types.ts: Chat message data contract.
- mockChatResponse.ts: Legacy simulated chat response.
- __tests__/mockChatResponse.test.ts: Mock behavior tests.

## Current behavior
The AI Tutor page still uses the mock implementation.
The mock simulates a delay and produces template-based
responses using excerpts from the uploaded document.

The mock is not a real language model. Its generated
explanations must not be treated as verified academic facts.

## Server-side integration
The separate Supabase Edge Function is located at:
supabase/functions/ai-tutor-chat/index.ts

It includes course access checks, quota enforcement,
and a server-side request to Groq.

The frontend is not yet connected to this function.

## Security
Keep GROQ_API_KEY on the server.
Do not bypass course authorization or quota checks.
Client-provided excerpts are not server-verified sources.

## Verification
pnpm --filter y-hub typecheck
pnpm --filter y-hub exec vitest run
pnpm --filter y-hub build
