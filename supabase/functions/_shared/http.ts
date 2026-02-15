import { corsHeaders } from "./cors.ts";

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    return {};
  }
}

export function requirePost(req: Request): Response | null {
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" });
  }
  return null;
}
