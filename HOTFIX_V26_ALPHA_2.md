# Dusk Industries v26.0 Alpha 2

Fixes the TypeScript build failure in the Chaos Copilot Responses API input.

The persisted Supabase conversation history now uses an explicit
`"user" | "assistant"` role union before being passed to
`openai.responses.create()`. This prevents TypeScript from widening the role
ternary to `string`, which recent OpenAI SDK typings reject as a
`ResponseInputItem`.

No SQL changes.
No Vercel environment changes.
No Make changes.

Deploy this package over Alpha 1 and rebuild.
