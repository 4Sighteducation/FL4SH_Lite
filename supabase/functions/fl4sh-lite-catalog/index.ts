// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-fl4sh-lite-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function handleCors(req: Request): Response | null {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  return null;
}
function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
async function readJson(req: Request): Promise<Record<string, any>> {
  try {
    return (await req.json()) as Record<string, any>;
  } catch {
    return {};
  }
}
function requirePost(req: Request): Response | null {
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" });
  return null;
}
function getCurriculumClient() {
  const url = Deno.env.get("CURRICULUM_SUPABASE_URL");
  const key = Deno.env.get("CURRICULUM_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}
function verifyBridgeSecret(req: Request): { ok: true } | { ok: false; error: string } {
  const expected = Deno.env.get("FL4SH_LITE_BRIDGE_SECRET");
  if (!expected) return { ok: true };
  const got = req.headers.get("x-fl4sh-lite-secret") ?? "";
  if (!got) return { ok: false, error: "Missing x-fl4sh-lite-secret" };
  if (got !== expected) return { ok: false, error: "Invalid bridge secret" };
  return { ok: true };
}
function normalizeQualification(v: string | null): string {
  const raw = String(v || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("GCSE") || raw === "NATIONAL_5") return "GCSE";
  if (raw.includes("A_LEVEL") || raw.includes("A-LEVEL") || raw.includes("HIGHER")) return "A_LEVEL";
  return raw;
}
async function fetchCatalogRows(curriculumClient: any, qualificationLevel?: string | null) {
  if (!curriculumClient) return [];
  const source = Deno.env.get("CURRICULUM_CATALOG_SOURCE") || "fl4sh_lite_subject_catalog";
  const maxRows = Number(Deno.env.get("CURRICULUM_CATALOG_LIMIT") || "500");
  let query = curriculumClient
    .from(source)
    .select("subject_key,subject_name,exam_board,qualification_type")
    .limit(Number.isFinite(maxRows) ? maxRows : 500);
  const normalized = normalizeQualification(qualificationLevel ?? null);
  if (normalized) query = query.ilike("qualification_type", `%${normalized}%`);
  const { data, error } = await query;
  if (error) throw new Error(`Catalog query failed: ${error.message}`);
  return (data || []).filter((r: any) => r?.subject_key);
}

serve(async (req: Request) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const methodErr = requirePost(req);
  if (methodErr) return methodErr;

  const secret = verifyBridgeSecret(req);
  if (!secret.ok) return json(401, { ok: false, error: secret.error });

  try {
    const payload = await readJson(req);
    const qualificationLevel = String(payload.qualification_level ?? "").trim() || null;
    const q = String(payload.query ?? "").trim().toLowerCase();

    const curriculumDb = getCurriculumClient();
    const catalog = await fetchCatalogRows(curriculumDb, qualificationLevel);

    const filtered = q
      ? catalog.filter((r) =>
        String(r.subject_name || "").toLowerCase().includes(q) ||
        String(r.subject_key || "").toLowerCase().includes(q) ||
        String(r.exam_board || "").toLowerCase().includes(q))
      : catalog;

    return json(200, {
      ok: true,
      count: filtered.length,
      subjects: filtered,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});
