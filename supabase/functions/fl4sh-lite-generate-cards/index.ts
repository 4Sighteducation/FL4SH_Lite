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

function normalizeMcqOptions(card: any): Array<{ key: string; text: string }> {
  const raw = Array.isArray(card?.options) ? card.options : [];
  const mapped = raw
    .map((opt: any, index: number) => {
      const key = String.fromCharCode(65 + index); // A, B, C, D...
      if (typeof opt === "string") {
        const text = opt.trim();
        return text ? { key, text } : null;
      }
      if (opt && typeof opt === "object") {
        const text = String(opt.text || opt.option || opt.label || "").trim();
        return text ? { key, text } : null;
      }
      return null;
    })
    .filter(Boolean) as Array<{ key: string; text: string }>;
  return mapped.slice(0, 6);
}

function resolveCorrectKey(card: any, options: Array<{ key: string; text: string }>): string {
  const raw = String(card?.correctAnswer || card?.correct_answer || "").trim();
  if (!raw || !options.length) return "";
  const upper = raw.toUpperCase();
  if (/^[A-F]$/.test(upper)) return upper;
  const byText = options.find((opt) => opt.text.toLowerCase() === raw.toLowerCase());
  return byText?.key || "";
}

function mcqBackText(card: any): string {
  const options = normalizeMcqOptions(card);
  const correctKey = resolveCorrectKey(card, options);
  if (!options.length) return "";
  const lines = options.map((opt) => `${opt.key}) ${opt.text}`);
  if (correctKey) lines.push(`Correct answer: ${correctKey}`);
  if (typeof card?.detailedAnswer === "string" && card.detailedAnswer.trim()) {
    lines.push("");
    lines.push(card.detailedAnswer.trim());
  } else if (typeof card?.answer === "string" && card.answer.trim()) {
    lines.push("");
    lines.push(card.answer.trim());
  }
  return lines.join("\n");
}

function toBackText(card: any, questionType: string): string {
  if (questionType === "multiple_choice") {
    const mcq = mcqBackText(card);
    if (mcq) return mcq;
  }
  if (typeof card?.detailedAnswer === "string" && card.detailedAnswer.trim()) return card.detailedAnswer.trim();
  if (typeof card?.answer === "string" && card.answer.trim()) return card.answer.trim();
  if (Array.isArray(card?.keyPoints) && card.keyPoints.length) {
    return card.keyPoints.map((x: any) => `- ${String(x)}`).join("\n");
  }
  if (typeof card?.correctAnswer === "string" && card.correctAnswer.trim()) return card.correctAnswer.trim();
  return "Review this topic in FL4SH for the full explanation.";
}

function clampInt(n: any, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

const MAX_AI_CARDS_PER_SUBJECT = 20;

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

    const subjectKey = String(payload.subject_key || "").trim();
    const subject = String(payload.subject || payload.subject_name || "").trim();
    const topic = String(payload.topic || "").trim();
    const examType = String(payload.examType || payload.exam_type || identity.qualificationLevel || "GCSE").trim();
    const examBoard = String(payload.examBoard || payload.exam_board || "").trim();
    const questionType = String(payload.questionType || payload.question_type || "short_answer").trim();
    const requested = clampInt(payload.numCards ?? payload.num_cards, 1, 5, 3);
    const previewOnly = Boolean(payload.preview_only);
    const contentGuidance = String(payload.contentGuidance || payload.content_guidance || "").trim() || undefined;

    if (!subjectKey || !subject || !topic || !examBoard) {
      return json(400, { ok: false, error: "Missing subject_key, subject, topic, or examBoard" });
    }

    const db = getAppDbClient();
    const user = await upsertLiteUser(db, identity);

    const { data: selectedSubject, error: selectedErr } = await db
      .from("fl4sh_lite_user_subjects")
      .select("subject_key")
      .eq("user_id", user.id)
      .eq("subject_key", subjectKey)
      .maybeSingle();
    if (selectedErr) return json(500, { ok: false, error: selectedErr.message });
    if (!selectedSubject) return json(400, { ok: false, error: "SUBJECT_NOT_SELECTED" });

    const { data: aiRows, error: aiCountErr } = await db
      .from("fl4sh_lite_cards")
      .select("id")
      .eq("user_id", user.id)
      .eq("subject_key", subjectKey)
      .like("card_type", "ai_%");

    if (aiCountErr) return json(500, { ok: false, error: aiCountErr.message });
    const remaining = MAX_AI_CARDS_PER_SUBJECT - Number((aiRows || []).length);
    if (remaining <= 0) return json(400, { ok: false, error: "CARD_LIMIT_REACHED" });
    const numCards = Math.min(requested, remaining);

    // Reuse the current production generator endpoint for prompt parity with the real app.
    const generatorUrl = Deno.env.get("FL4SH_GENERATOR_URL") || "https://www.fl4sh.cards/api/generate-cards";

    const genResp = await fetch(generatorUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject,
        topic,
        examType,
        examBoard,
        questionType,
        numCards,
        contentGuidance,
        isOverview: false,
        childrenTopics: [],
        qualificationCode: examType,
      }),
    });

    if (!genResp.ok) {
      const txt = await genResp.text().catch(() => "");
      return json(502, { ok: false, error: `Generator failed (${genResp.status})`, details: txt });
    }

    const genData = await genResp.json().catch(() => ({} as any));
    const cards = Array.isArray(genData?.cards) ? genData.cards : [];
    if (!cards.length) return json(502, { ok: false, error: "Generator returned no cards" });

    const rows = cards.slice(0, numCards).map((c: any) => ({
      user_id: user.id,
      subject_key: subjectKey,
      topic_code: String(payload.topic_code || topic || "").slice(0, 120) || null,
      front_text: String(c?.question || "").trim(),
      back_text: toBackText(c, questionType),
      card_type: `ai_${questionType}`,
    })).filter((r: any) => r.front_text && r.back_text);

    if (!rows.length) return json(502, { ok: false, error: "No valid cards to save" });

    if (previewOnly) {
      return json(200, {
        ok: true,
        source: "fl4sh-generator",
        requested,
        generated: rows.length,
        preview_cards: rows.map((row: any, index: number) => ({ ...row, preview_id: index + 1 })),
        ai_remaining_after_save: Math.max(0, remaining - rows.length),
      });
    }

    const { data: inserted, error: insertErr } = await db
      .from("fl4sh_lite_cards")
      .insert(rows)
      .select("id,subject_key,topic_code,front_text,back_text,card_type,created_at");

    if (insertErr) return json(400, { ok: false, error: insertErr.message });

    return json(200, {
      ok: true,
      source: "fl4sh-generator",
      requested,
      generated: rows.length,
      cards: inserted || [],
      ai_remaining_after_save: Math.max(0, remaining - rows.length),
    });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});

