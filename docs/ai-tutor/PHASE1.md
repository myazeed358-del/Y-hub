# AI Tutor Phase 1 — trusted section knowledge

## Scope and baseline

Branch `feature/ai-tutor-rag` starts from fetched main `0405670e41624905c9829667fbf3927485286e8c`. Existing Y-Sheets work and other university features were preserved. No production database connection, migration, Edge deployment or main merge was performed. The hosted migration ledger is not accessible with the configured public credentials; numbering 0038 follows 0037 in the fetched repository and must be reconciled with the hosted ledger before any approved deployment.

The existing `/course/:id/ai-tutor` route and feature were enhanced. `course_sections` is an invoker-secured view over `courses`, so the existing course UUID is the section boundary. No second course model, Tutor page or central module registration was created. API v2 reserves parameterized academic routes for the host. Existing math `DomainEnginePort`/catalog contracts were inspected and remain unchanged; no calculation capability is claimed in this phase.

## Findings in the previous implementation

- The live Edge Function accepted browser-supplied excerpts and source labels as context. Their file membership, page and provenance were not verified.
- The browser chose the first PDF, stripped its storage path to the last filename, downloaded and reprocessed it when opening the page. It had no persisted section knowledge index or source-generation invalidation.
- Local keyword matching selected context, and the frontend attached page labels regardless of what the provider actually used. English/Arabic regexes guessed whether an answer lacked evidence.
- Ownership preview relied on the stored instructor ID without a current-role check. The new gate consults the current database role; demotion is covered by integration tests.
- Async course/request state was not generation-bound, making old-account/course responses unsafe. New state resets on account/route changes and suppresses late responses.
- `ai-chat/README.md` incorrectly claimed that the live UI still used the mock. The UI already called Groq through the Edge Function. That documentation has been corrected.
- Template `generateQuiz`, simulated chat and local `searchChunks` still exist for compatibility exports/tests. They are not the new authoritative Tutor path. The old loader/send helpers are unused by the new hook. Template quizzes are not presented as grounded assessments; Phase 2 will replace that behavior with verified educational modes.

## Implemented pipeline

1. Registered course PDF material records and the existing section syllabus create source records. UUID section isolation is independent of course title/academic definition.
2. The instructor indexes a selected source from the existing Tutor page. The endpoint accepts **only source ID**, authenticates with Supabase Auth, reads material/syllabus using caller permissions and checks current management access.
3. PDFs must be in this project's existing `materials` bucket. Full paths are preserved; foreign URLs, other buckets, traversal and redirects are rejected. The server fetches bytes using the caller JWT, never a privileged download. External links/videos, arbitrary web crawling and OCR are not implemented.
4. The serverless PDF.js adapter extracts physical page text, removes NULs and normalizes whitespace. Chunks are at most 1600 characters, advance by 1400 and preserve page boundaries. Syllabus chunks retain actual unit IDs and have no invented page number. Existing material records have no unit association: PDF-to-unit mapping is not invented.
5. A privileged publication RPC accepts only server-produced chunks, validates source generation and current instructor management, and atomically replaces the previous index. Empty text is explicitly `unreadable`; malformed/oversized PDFs fail without publishing a new index. Invalid publication rolls back the replacement.
6. Chat accepts only course ID, question and optional source ID. It retrieves at most six authorized chunks and sends those to Groq. No client excerpts, actor ID, URL, conversation history or exam answer data are trusted.
7. The model returns structured text and chunk IDs. Unknown IDs and unsupported citation responses fail closed. Title, snippet, page and unit metadata come from retrieved database rows. After the provider response, the server rechecks JWT, current enrollment/role and every chunk revision before releasing the answer. A source change produces HTTP 409 and a retry message.
8. The existing KaTeX renderer displays equations. Citation cards show exact evidence and recheck source access before opening the authorized original. Provider-controlled images/links are not rendered. The instructor can index/reindex; students can choose a ready source and ask questions. UI states and source/privacy labels are bilingual and use the existing theme.

## Retrieval choice and cost bounds

The repository has no existing pgvector index. Phase 1 uses PostgreSQL `tsvector`/GIN plus **optional real semantic embeddings** stored as bounded `real[]` and exact cosine ranking. This avoids requiring an unavailable extension and a second database service. It is a small-corpus implementation, not an ANN index: at most 100 sources per section, 256 chunks per source, embeddings at most 1536 dimensions in SQL, and the configured adapter requests 384 dimensions. Benchmark representative corpora before raising these limits or migrating to pgvector/HNSW.

With `TUTOR_EMBEDDING_KEY` and `TUTOR_EMBEDDING_MODEL` configured, the server uses OpenAI's fixed embeddings endpoint, indexed in batches of 16 and scoped by embedding model. Without both settings it uses lexical search and explicitly makes no semantic-quality claim. Changing the model requires instructor reindexing. The provider adapter and SQL cosine/model isolation are tested, but an actual paid embedding request was not made.

Limits: 5 MiB PDF, 300 pages, 350,000 extracted characters, 256 chunks/source, 8,000-byte JSON request, 1,500-character question, six evidence chunks, 1,200 completion tokens and a bounded provider response. Embeddings timeout after 15 seconds, Groq after 25 seconds, and the request network/access deadline is 70 seconds. PDF parsing is additionally bounded by Edge CPU/memory limits; adversarial parser resource behavior is not proven by the simple fixtures.

The existing **10 requests/user/hour and 100/platform/day** quota function remains authoritative. Index and chat attempts both consume this budget; failures are not refunded. New expiring leases allow one request per actor and at most four platform requests concurrently. Acquisition is serialized in PostgreSQL. A crashed worker loses its slot after 90 seconds; token-bound release cannot remove a later lease. These are request/input/output limits, not a billed-dollar accounting system.

## Security and invalidation

- RLS protects sources/chunks. Browser direct writes and privileged publication/quota functions are denied to Student, Instructor, Admin and Owner.
- Students require current active enrollment and a published section. Instructors require current instructor role and ownership. Admin/Owner do not gain a new global content-reading power: this Tutor policy permits management/read preview for sections they own. Existing material and syllabus RLS are also applied by the retrieval/indexing path.
- Material changes replace their source generation and remove old chunks; deletion cascades. Syllabus changes invalidate its generation through the existing syllabus revision mechanism.
- Mutations in the `materials` Storage metadata bucket invalidate indexes matching the normalized object path, including replacement, deletion and rename. Previously unindexed sources have no established path yet and are conservatively generation-invalidated during Storage mutations to prevent first-index races. Unrelated ready indexes remain available, with an explicit regression test. Reindexing is instructor-triggered; no background job service is claimed.
- Storage bytes are not part of PostgreSQL's transaction. A failed Storage operation may still invalidate an index; restoring readiness requires a successful authorized reindex. Out-of-band object-store edits that bypass Storage metadata cannot be detected by these triggers and must be prohibited operationally.
- Only course materials and syllabus sources exist; no query to question/answer/result/student-file tables is used. If an instructor deliberately publishes confidential answers as ordinary authorized course material, content classification cannot be inferred automatically.
- Documents are untrusted data in the prompt. The provider receives no service keys, tool execution capability or arbitrary URL fetch capability. Citation-ID validation proves provenance, **not factual entailment or immunity to every prompt injection**. Calculation verification is Phase 3.
- Conversation history is React memory only (40 messages); it is not stored in Supabase/localStorage and not sent as subsequent model history. It clears on navigation/account changes and access loss; access is polled every 15 seconds and on visibility return. All protected server calls independently recheck. Previously viewed/downloaded information cannot be recalled. Durable conversation storage and multi-turn learning memory are not implemented in Phase 1.
- Database owner/superuser and leaked service credentials remain outside application RLS protections. No secrets are added to the frontend or repository.

## Deployment gates — not performed

Migration: `0038_ai_tutor_knowledge.sql`, applied **only to disposable local PostgreSQL**. Historical 0015/0016 and all other historical SQL are unchanged. The migration creates source/chunk tables, a private concurrency schema, RLS, source/Storage invalidation triggers and explicitly granted RPCs. Initial backfill contains metadata, not document content.

Before deployment: inspect the actual approved environment ledger and schema; review 0038 there; apply only missing approved SQL. Deploy `ai-tutor-chat` and `ai-tutor-index` together with the frontend. Both endpoints require JWT verification and perform `auth.getUser()` themselves. Never use blind database push, production test writes or `--no-verify-jwt` to make deployment appear successful.

Server settings (no values committed): Supabase platform URL/anon/service credentials, `GROQ_API_KEY`, exact comma-separated `TUTOR_ALLOWED_ORIGINS`; optional `TUTOR_EMBEDDING_KEY` and a model supporting 384-dimensional embeddings (for example `text-embedding-3-small`). Without an allowed browser origin, requests fail closed. Provider keys belong only in server secrets. Review provider retention/legal permission for transmitting authorized document excerpts and queries. These tests made no external AI calls.

`unpdf@1.4.0` (MIT, unjs/unpdf; bundled PDF.js 5.4.296) is pinned in the Edge import and Deno integrity lock. Text extraction disables eval/rendering/system fonts. Supabase JS is pinned at the currently installed 2.117.1. An isolated npm audit of the test-tool/unpdf installation returned zero advisories; this is not a full supply-chain or workspace-security attestation. Actual PDF fixtures passed in Deno; Supabase hosted Edge packaging, cold starts, fonts, memory/time limits and actual Storage/Auth integration remain **PENDING**.

Known Vercel Python bundle-size issue remains deferred and untouched.

## Phase 2 and Phase 3

Phase 2: grounded explanation depth, progressive hints, structured practice questions/answers and formative assessments, source/unit-specific educational prompts, better conversational follow-up. Do not promote the existing template quiz as a verified implementation.

Phase 3: a separate Tutor tool adapter over existing typed math ports, explicit supported operations, server-enforced engine grants, validated tool inputs/results, provenance for verified calculations and tests of steps/results. No math algorithms or engine registration lists were modified in Phase 1.
