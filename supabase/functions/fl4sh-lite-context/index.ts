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

function getAppDbClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, key, { auth: { persistSession: false } });
}

function getCurriculumClient() {
  const url = Deno.env.get("CURRICULUM_SUPABASE_URL") || Deno.env.get("FLASH_SUPABASE_URL");
  const key = Deno.env.get("CURRICULUM_SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("FLASH_SUPABASE_SERVICE_ROLE_KEY");
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

function parseIdentity(payload: Record<string, any>) {
  const email = String(payload.email ?? "").trim().toLowerCase();
  if (!email) return null;
  return {
    email,
    fullName: String(payload.name ?? payload.full_name ?? "").trim() || null,
    schoolName: String(payload.school_name ?? "").trim() || null,
    qualificationLevel: String(payload.qualification_level ?? "").trim() || null,
    knackUserId: String(payload.knack_user_id ?? "").trim() || null,
  };
}

async function upsertLiteUser(db: any, identity: any) {
  const { data, error } = await db
    .from("fl4sh_lite_users")
    .upsert({
      email: identity.email,
      knack_user_id: identity.knackUserId,
      full_name: identity.fullName,
      school_name: identity.schoolName,
      qualification_level: identity.qualificationLevel,
    }, { onConflict: "email" })
    .select("id,email")
    .single();
  if (error || !data?.id) throw new Error(error?.message || "Could not upsert lite user");
  return data;
}

function normalizeQualification(v: string | null): string {
  const raw = String(v || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("GCSE") || raw === "NATIONAL_5") return "GCSE";
  if (raw.includes("A_LEVEL") || raw.includes("A-LEVEL") || raw.includes("HIGHER")) return "A_LEVEL";
  return raw;
}

function normalizeCode(v: string | null | undefined): string {
  return String(v || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_");
}

function qualificationMatches(candidate: string | null | undefined, requested: string): boolean {
  if (!requested) return true;
  const c = normalizeCode(candidate);
  const r = normalizeCode(requested);
  return c === r || c.includes(r) || r.includes(c);
}

function mapProductionCatalogRows(rows: any[], requestedQualification: string) {
  return rows
    .map((r: any) => {
      const examBoard = r?.exam_boards?.code || r?.exam_boards?.full_name || "";
      const qualification = r?.qualification_types?.code || "";
      const keyBase = r?.subject_code || String(r?.id || "").trim();
      const subjectKey = [examBoard, qualification, keyBase].filter(Boolean).join(":");
      return {
        subject_key: subjectKey || keyBase,
        subject_name: r?.subject_name || "",
        exam_board: examBoard,
        qualification_type: qualification,
      };
    })
    .filter((r: any) => r.subject_key && r.subject_name)
    .filter((r: any) => qualificationMatches(r.qualification_type, requestedQualification));
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
  if (!error) return (data || []).filter((r: any) => r?.subject_key);

  // Fallback: align with FLASH production schema
  const { data: prodRows, error: prodError } = await curriculumClient
    .from("exam_board_subjects")
    .select(`
      id,
      subject_name,
      subject_code,
      exam_boards(code, full_name),
      qualification_types(code)
    `)
    .eq("is_current", true)
    .limit(Number.isFinite(maxRows) ? maxRows : 500);

  if (prodError) {
    throw new Error(`Catalog query failed: ${error.message}; production fallback failed: ${prodError.message}`);
  }

  return mapProductionCatalogRows(prodRows || [], normalized);
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
    const identity = parseIdentity(payload);
    if (!identity) return json(400, { ok: false, error: "Missing email in request body" });

    const appDb = getAppDbClient();
    const curriculumDb = getCurriculumClient();

    const user = await upsertLiteUser(appDb, identity);

    const { data: selected, error: selectedErr } = await appDb
      .from("fl4sh_lite_user_subject_stats")
      .select("subject_key,subject_name,exam_board,qualification_type,card_count,cards_remaining")
      .eq("user_id", user.id)
      .order("subject_name", { ascending: true });

    if (selectedErr) return json(500, { ok: false, error: selectedErr.message });

    const catalog = await fetchCatalogRows(curriculumDb, identity.qualificationLevel);
    const catalogWarning = curriculumDb
      ? null
      : "Curriculum catalog not configured. Set CURRICULUM_* or FLASH_* secrets for catalog access.";

    return json(200, {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: identity.fullName,
        school_name: identity.schoolName,
        qualification_level: identity.qualificationLevel,
      },
      limits: {
        max_subjects: 2,
        max_cards_per_subject: 10,
      },
      selected_subjects: selected || [],
      available_subjects: catalog,
      catalog_warning: catalogWarning,
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});
