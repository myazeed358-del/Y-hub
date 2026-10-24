# AI Tutor — trusted section knowledge (Phase 1)

The existing `/course/:id/ai-tutor` page now calls `ai-tutor-chat` with only the section/course ID, question and optional source ID. Course IDs are the existing section IDs; no second course model or module registration was introduced. Parameterized academic routes remain host-owned under the API v2 contract.

`ai-tutor-index` authenticates the caller, verifies current source-management access, downloads only an authorized PDF from this project's `materials` bucket (or reads the existing syllabus RPC), extracts page text on the server and publishes a revision-bound index. Browser excerpts, labels, URLs, actor IDs and answer keys are not accepted. `ai-tutor-chat` retrieves evidence under caller RLS and rechecks identity/access and evidence revisions after the model response. Citation cards contain actual indexed text, title and physical PDF page, never model-generated metadata.

Migration 0038 installs the index, RLS, invalidation and bounded concurrency/quota wrapper; it does not replace 0015/0016 quotas. External embedding configuration is optional; without it retrieval is explicitly lexical. See `docs/ai-tutor/PHASE1.md` for deployment, limits, verification and pending hosted gates.

The session conversation is kept only in React memory, capped at 40 messages and cleared on navigation/account change/access loss. Current access is polled every 15 seconds and checked on visibility return; all server operations independently recheck access. Already downloaded information cannot be recalled. The model sees the current question and retrieved excerpts, not historical conversations or other students' data.

Legacy `mockChatResponse`, `searchChunks`, browser `analyzeDocument` and template `generateQuiz` remain behind existing compatibility exports and tests. They are NOT the authoritative Tutor path. The previous loader/handler helpers are no longer used by `useAITutor`. Template quizzes are not offered as grounded educational assessments; trustworthy educational modes are Phase 2. Engine/tool integration is Phase 3 and is not claimed here.
