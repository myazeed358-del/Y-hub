import { createClient } from "npm:@supabase/supabase-js@2.117.1";
import { type Context, readBounded, TutorError } from "./core.ts";
const env = (key: string) => Deno.env.get(key);
export function serve(
  handler: (request: Request, ctx: Context, token: string) => Promise<unknown>,
) {
  Deno.serve(async (request) => {
    const origin = request.headers.get("origin");
    const allowed = (env("TUTOR_ALLOWED_ORIGINS") ?? "").split(",").filter(
      Boolean,
    );
    const cors: Record<string, string> = {
      "Vary": "Origin",
      "Access-Control-Allow-Headers":
        "authorization,apikey,content-type,x-client-info",
      "Access-Control-Allow-Methods": "POST,OPTIONS",
      "Cache-Control": "no-store",
    };
    if (origin && !allowed.includes(origin)) {
      return Response.json({ error: "Origin denied" }, {
        status: 403,
        headers: cors,
      });
    }
    if (origin) cors["Access-Control-Allow-Origin"] = origin;
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }
    try {
      const token = request.headers.get("authorization") ?? "";
      if (!token.startsWith("Bearer ")) {
        throw new TutorError(401, "Authentication required");
      }
      const project = env("SUPABASE_URL"),
        anon = env("SUPABASE_ANON_KEY"),
        service = env("SUPABASE_SERVICE_ROLE_KEY");
      if (!project || !anon || !service) {
        throw new TutorError(503, "Service not configured");
      }
      const db = createClient(project, anon, {
        global: { headers: { Authorization: token } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const admin = createClient(project, service, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const identity = await db.auth.getUser();
      if (identity.error || !identity.data.user) {
        throw new TutorError(401, "Invalid session");
      }
      const actor = identity.data.user.id;
      const deadline = AbortSignal.timeout(70000);
      const ctx: Context = {
        actor,
        db,
        admin,
        env,
        fetch: (url, options) =>
          fetch(url, {
            ...options,
            signal: AbortSignal.any([
              deadline,
              ...(options?.signal ? [options.signal] : []),
            ]),
          }),
        validSession: async () => {
          const result = await db.auth.getUser();
          return !deadline.aborted && !result.error &&
            result.data.user?.id === actor;
        },
      };
      return Response.json(await handler(request, ctx, token), {
        headers: cors,
      });
    } catch (error) {
      return Response.json({
        error: error instanceof TutorError
          ? error.message
          : "Tutor service unavailable",
      }, {
        status: error instanceof TutorError ? error.status : 503,
        headers: cors,
      });
    }
  });
}
export async function downloadPdf(ctx: Context, token: string, path: string) {
  const project = ctx.env("SUPABASE_URL")!;
  const response = await ctx.fetch(
    `${project}/storage/v1/object/authenticated/materials/${
      path.split("/").map(encodeURIComponent).join("/")
    }`,
    {
      headers: { Authorization: token, apikey: ctx.env("SUPABASE_ANON_KEY")! },
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    },
  );
  if (!response.ok) {
    throw new TutorError(
      response.status === 401 ? 401 : 403,
      "PDF access denied",
    );
  }
  const bytes = await readBounded(response, 5 * 1024 * 1024);
  if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") {
    throw new TutorError(422, "Invalid PDF");
  }
  return bytes;
}
