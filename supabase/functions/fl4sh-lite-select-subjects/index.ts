// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const MAX_SUBJECTS = 2;

type SubjectSelection = {
  subject_key: string;
  subject_name?: string | null;
  exam_board?: string | null;
  qualification_type?: string | null;
};

function normalizeSubjectKey(value: unknown): string {
  return String(value || "").trim();
}

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

    const subjectsRaw = Array.isArray(payload.subjects) ? payload.subjects : [];
    const dedupedSubjects = new Map<string, SubjectSelection>();
    for (const raw of subjectsRaw) {
      const subjectKey = normalizeSubjectKey(raw?.subject_key);
      if (!subjectKey) continue;
      if (!dedupedSubjects.has(subjectKey)) {
        dedupedSubjects.set(subjectKey, {
          subject_key: subjectKey,
          subject_name: raw?.subject_name ? String(raw.subject_name) : null,
          exam_board: raw?.exam_board ? String(raw.exam_board) : null,
          qualification_type: raw?.qualification_type ? String(raw.qualification_type) : null,
        });
      }
    }
    const subjects: SubjectSelection[] = Array.from(dedupedSubjects.values());

    if (subjects.length > MAX_SUBJECTS) {
      return json(400, { ok: false, error: "SUBJECT_LIMIT_REACHED" });
    }

    const db = getAppDbClient();
    const user = await upsertLiteUser(db, identity);

    const nextKeys = subjects.map((s) => normalizeSubjectKey(s.subject_key)).filter(Boolean);
    const { data: existingRows, error: existingErr } = await db
      .from("fl4sh_lite_user_subjects")
      .select("subject_key")
      .eq("user_id", user.id);
    if (existingErr) return json(500, { ok: false, error: existingErr.message });

    const existingKeys = (existingRows || []).map((r: any) => normalizeSubjectKey(r?.subject_key)).filter(Boolean);
    const removedKeys = existingKeys.filter((k) => !nextKeys.includes(k));

    // When a subject is removed, cascade-delete its cards for this user (irreversible).
    if (removedKeys.length) {
      const { error: cardDeleteErr } = await db
        .from("fl4sh_lite_cards")
        .delete()
        .eq("user_id", user.id)
        .in("subject_key", removedKeys);
      if (cardDeleteErr) return json(500, { ok: false, error: cardDeleteErr.message });
    }

    const { error: deleteErr } = await db
      .from("fl4sh_lite_user_subjects")
      .delete()
      .eq("user_id", user.id);

    if (deleteErr) return json(500, { ok: false, error: deleteErr.message });

    if (subjects.length) {
      const rows = subjects.map((s) => ({
        user_id: user.id,
        subject_key: s.subject_key,
        subject_name: s.subject_name,
        exam_board: s.exam_board,
        qualification_type: s.qualification_type,
      }));

      const { error: insertErr } = await db
        .from("fl4sh_lite_user_subjects")
        .insert(rows);

      if (insertErr) {
        return json(400, { ok: false, error: insertErr.message });
      }
    }

    const { data: selected, error: selectedErr } = await db
      .from("fl4sh_lite_user_subject_stats")
      .select("subject_key,subject_name,exam_board,qualification_type,card_count,cards_remaining")
      .eq("user_id", user.id)
      .order("subject_name", { ascending: true });

    if (selectedErr) return json(500, { ok: false, error: selectedErr.message });

    return json(200, { ok: true, selected_subjects: selected || [] });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});
