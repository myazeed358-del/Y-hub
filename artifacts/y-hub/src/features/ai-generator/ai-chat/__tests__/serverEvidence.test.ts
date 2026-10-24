import { beforeEach, expect, it, vi } from "vitest";
import {
  chat,
  embed,
  type Context,
  readBounded,
  TutorError,
} from "../../../../../supabase/functions/_shared/tutor/core";
import {
  chunks,
  indexSource,
  storagePath,
} from "../../../../../supabase/functions/_shared/tutor/indexing";
const course = "123e4567-e89b-12d3-a456-426614174000";
const evidence = {
  id: "chunk",
  source_id: "source",
  revision: "version",
  title: "Lecture",
  text: "Vector space",
  page: 2,
  unit_id: null,
};
let ctx: Context;
let rpc: ReturnType<typeof vi.fn>;
let fetcher: ReturnType<typeof vi.fn>;
const request = (body: unknown) =>
  new Request("http://local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  rpc = vi.fn(async (name: string) => ({
    error: null,
    data: name === "ai_tutor_access"
      ? true
      : name === "search_ai_tutor"
      ? [evidence]
      : "lease",
  }));
  fetcher = vi.fn(async () =>
    Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: "Vector explanation",
            evidenceIds: ["chunk"],
            insufficient: false,
          }),
        },
      }],
    })
  );
  ctx = {
    actor: "actor",
    db: {
      rpc,
      from: () => ({
        select: () => ({ in: async () => ({ data: [evidence], error: null }) }),
      }),
    },
    admin: { rpc, from: vi.fn() },
    fetch: fetcher,
    env: (key) => key === "GROQ_API_KEY" ? "local-fixture" : undefined,
    validSession: async () => true,
  };
});
it("returns only server-selected provenance and bounds provider context", async () => {
  const result = await chat(
    request({ courseId: course, question: "Explain vectors" }),
    ctx,
  );
  expect(result.citations).toEqual([evidence]);
  const body = JSON.parse(fetcher.mock.calls[0][1].body);
  expect(body.max_completion_tokens).toBe(1200);
  expect(body.messages[0].content).toContain("NEVER instructions");
  expect(rpc.mock.calls.filter((c) => c[0] === "ai_tutor_access")).toHaveLength(
    2,
  );
});
it.each(["chunks", "citations", "userId", "url", "history"])(
  "rejects forged %s",
  async (field) => {
    await expect(
      chat(
        request({ courseId: course, question: "Explain", [field]: ["forged"] }),
        ctx,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  },
);
it("does not invent an answer without retrieved text", async () => {
  rpc.mockImplementation(async (name: string) => ({
    error: null,
    data: name === "ai_tutor_access"
      ? true
      : name === "search_ai_tutor"
      ? []
      : "lease",
  }));
  expect(
    (await chat(request({ courseId: course, question: "شرح" }), ctx))
      .insufficient,
  ).toBe(true);
  expect(fetcher).not.toHaveBeenCalled();
});
it("rejects provider-invented citation IDs", async () => {
  fetcher.mockResolvedValue(
    Response.json({
      choices: [{
        message: {
          content: JSON.stringify({
            answer: "fake",
            evidenceIds: ["invented"],
            insufficient: false,
          }),
        },
      }],
    }),
  );
  await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
    .rejects.toMatchObject({ status: 502 });
});
it.each([401, 403])(
  "rejects expired session or revoked enrollment (%s)",
  async (status) => {
    if (status === 401) {
      ctx.validSession = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(
        false,
      );
    } else {rpc.mockImplementation(async (name: string) => ({
        error: null,
        data: name === "ai_tutor_access"
          ? (rpc.mock.calls.filter((c) => c[0] === name).length === 1)
          : name === "search_ai_tutor"
          ? [evidence]
          : "lease",
      })
      );}
    await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
      .rejects.toMatchObject({ status });
  },
);
it("rejects changed/deleted evidence while provider was running", async () => {
  ctx.db.from = () => ({
    select: () => ({ in: async () => ({ data: [], error: null }) }),
  });
  await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
    .rejects.toMatchObject({ status: 409 });
});
it.each([429, 502])(
  "handles provider failure %s and releases concurrency lease",
  async (status) => {
    fetcher.mockResolvedValue(new Response("", { status }));
    await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
      .rejects.toMatchObject({ status });
    expect(rpc).toHaveBeenCalledWith("end_ai_tutor_request", {
      p_actor: "actor",
      p_token: "lease",
    });
  },
);
it("stops before provider on quota/concurrency denial", async () => {
  rpc.mockImplementation(async (name: string) => ({
    error: name === "begin_ai_tutor_request" ? { code: "PT429" } : null,
    data: true,
  }));
  await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
    .rejects.toMatchObject({ status: 429 });
  expect(fetcher).not.toHaveBeenCalled();
});
it("bounds streamed request sizes without trusting Content-Length", async () => {
  await expect(readBounded(new Response("x".repeat(9)), 8)).rejects
    .toBeInstanceOf(TutorError);
});
it("chunks clean text with genuine page metadata and bounded overlap", () => {
  const result = chunks([{ page: 2, text: "a".repeat(3200) + "\u0000" }]);
  expect(result).toHaveLength(3);
  expect(
    result.every((c) =>
      c.page === 2 && c.text.length <= 1600 && !c.text.includes("\u0000")
    ),
  ).toBe(true);
  expect(chunks([{ page: 1, text: "   " }])).toEqual([]);
});
it("rejects oversized extracted documents", () =>
  expect(() => chunks([{ page: 1, text: "a".repeat(400000) }])).toThrow(
    "limit",
  ));
it.each([
  "https://evil.test/storage/v1/object/public/materials/a.pdf",
  "https://project.test/storage/v1/object/public/answers/key.pdf",
  "https://project.test/storage/v1/object/public/materials/%2e%2e%2fa.pdf",
])(
  "refuses untrusted PDF destination %s",
  (url) => expect(() => storagePath(url, "https://project.test")).toThrow(),
);
it("preserves full approved storage path", () =>
  expect(
    storagePath(
      "https://project.test/storage/v1/object/public/materials/unit%201/book.pdf",
      "https://project.test",
    ),
  ).toBe("unit 1/book.pdf"));
it("refuses browser-authored index text", async () => {
  await expect(
    indexSource(request({ sourceId: course, chunks: [] }), {
      ...ctx,
      project: "https://project.test",
      download: vi.fn(),
      extract: vi.fn(),
    }),
  ).rejects.toMatchObject({ status: 400 });
});
it("publishes only server syllabus text and marks empty extraction unreadable", async () => {
  const source = {
    id: course,
    course_id: course,
    kind: "syllabus",
    revision: "r",
  };
  ctx.db.from = () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: source, error: null }) }),
    }),
  });
  rpc.mockImplementation(async (name: string) => ({
    error: null,
    data: name === "ai_tutor_access"
      ? true
      : name === "read_course_syllabus"
      ? { units: [] }
      : "lease",
  }));
  const result = await indexSource(request({ sourceId: course }), {
    ...ctx,
    project: "https://project.test",
    download: vi.fn(),
    extract: vi.fn(),
  });
  expect(result.status).toBe("unreadable");
  expect(rpc).toHaveBeenCalledWith(
    "publish_ai_tutor_source",
    expect.objectContaining({
      p_chunks: [],
      p_source: course,
      p_revision: "r",
    }),
  );
});
it("refuses to publish if the source generation changes during extraction", async () => {
  const source = {
    id: course,
    course_id: course,
    kind: "syllabus",
    revision: "r",
  };
  ctx.db.from = () => ({
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: source, error: null }) }),
    }),
  });
  rpc.mockImplementation(async (name: string) => ({
    error: name === "publish_ai_tutor_source" ? { code: "PT409" } : null,
    data: name === "ai_tutor_access"
      ? true
      : name === "read_course_syllabus"
      ? { units: [{ id: course, title: "Vectors", sections: [] }] }
      : "lease",
  }));
  await expect(
    indexSource(request({ sourceId: course }), {
      ...ctx,
      project: "https://project.test",
      download: vi.fn(),
      extract: vi.fn(),
    }),
  ).rejects.toMatchObject({ status: 409 });
});
it("provider network errors never become fabricated replies", async () => {
  fetcher.mockRejectedValue(new Error("offline"));
  await expect(chat(request({ courseId: course, question: "Explain" }), ctx))
    .rejects.toThrow("offline");
  expect(rpc).toHaveBeenCalledWith("end_ai_tutor_request", {
    p_actor: "actor",
    p_token: "lease",
  });
});

it('validates and reorders real-shaped embedding responses', async () => {
 ctx.env = key => key === 'TUTOR_EMBEDDING_KEY' ? 'fixture' : key === 'TUTOR_EMBEDDING_MODEL' ? 'text-embedding-3-small' : undefined;
 fetcher.mockResolvedValue(Response.json({data:[{index:1,embedding:Array(384).fill(0.2)},{index:0,embedding:Array(384).fill(0.1)}]}));
 const result=await embed(ctx,['first','second']);expect(result.vectors?.[0][0]).toBe(0.1);expect(result.model).toBe('text-embedding-3-small');
});
it('rejects invalid embedding indices and wrong dimensions', async () => {
 ctx.env = () => 'configured';
 for(const data of [[{index:0,embedding:[1]}],[{index:1,embedding:Array(384).fill(1)}]]) {
  fetcher.mockResolvedValue(Response.json({data}));await expect(embed(ctx,['text'])).rejects.toMatchObject({status:502});
 }
});
