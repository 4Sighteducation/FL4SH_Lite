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

function scheduleDaysForBox(box: number): number {
  if (box <= 1) return 1;
  if (box === 2) return 2;
  if (box === 3) return 4;
  if (box === 4) return 7;
  return 21;
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

    const cardId = String(payload.card_id || "").trim();
    const wasCorrect = Boolean(payload.correct);
    if (!cardId) return json(400, { ok: false, error: "Missing card_id" });

    const db = getAppDbClient();
    const user = await upsertLiteUser(db, identity);

    const { data: card, error: cardErr } = await db
      .from("fl4sh_lite_cards")
      .select("id,user_id,subject_key,box_number,streak,next_review_at")
      .eq("id", cardId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (cardErr) return json(500, { ok: false, error: cardErr.message });
    if (!card) return json(404, { ok: false, error: "Card not found" });

    const prevBox = Number(card.box_number || 1);
    const nextBox = wasCorrect ? Math.min(5, prevBox + 1) : 1;
    const nextStreak = wasCorrect ? Number(card.streak || 0) + 1 : 0;
    const nextDays = scheduleDaysForBox(nextBox);
    const nextReviewAt = new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000).toISOString();
    const nowIso = new Date().toISOString();

    const { data: updated, error: updateErr } = await db
      .from("fl4sh_lite_cards")
      .update({
        box_number: nextBox,
        streak: nextStreak,
        last_reviewed_at: nowIso,
        next_review_at: nextReviewAt,
      })
      .eq("id", card.id)
      .eq("user_id", user.id)
      .select("id,subject_key,box_number,streak,last_reviewed_at,next_review_at,updated_at")
      .single();

    if (updateErr) return json(500, { ok: false, error: updateErr.message });

    return json(200, {
      ok: true,
      card: updated,
      transition: {
        from_box: prevBox,
        to_box: nextBox,
        correct: wasCorrect,
      },
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});
