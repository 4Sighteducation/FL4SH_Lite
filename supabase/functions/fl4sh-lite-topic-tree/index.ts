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

function parseSubjectKey(subjectKey: string) {
  const parts = String(subjectKey || "").split(":");
  return {
    examBoard: String(parts[0] || "").trim(),
    qualification: String(parts[1] || "").trim(),
    subjectCode: String(parts[2] || parts[parts.length - 1] || "").trim(),
  };
}

async function resolveSubjectRow(curriculumDb: any, subjectKey: string, userId: string) {
  const { examBoard, qualification, subjectCode } = parseSubjectKey(subjectKey);
  if (subjectCode) {
    const { data: byCode } = await curriculumDb
      .from("exam_board_subjects")
      .select("id,subject_code")
      .eq("subject_code", subjectCode)
      .limit(1)
      .maybeSingle();
    if (byCode?.id) return byCode;
  }

  const { data: selectedSubject } = await curriculumDb
    .from("fl4sh_lite_user_subjects")
    .select("subject_name,exam_board,qualification_type")
    .eq("user_id", userId)
    .eq("subject_key", subjectKey)
    .maybeSingle();

  const subjectName = String(selectedSubject?.subject_name || "").trim();
  if (!subjectName) return null;
  const boardMatch = String(selectedSubject?.exam_board || examBoard || "").trim().toUpperCase();
  const qualificationMatch = String(selectedSubject?.qualification_type || qualification || "").trim().toUpperCase();

  const { data: candidates } = await curriculumDb
    .from("exam_board_subjects")
    .select(`
      id,
      subject_code,
      subject_name,
      exam_boards(code, full_name),
      qualification_types(code)
    `)
    .ilike("subject_name", subjectName)
    .limit(50);

  const best = (candidates || []).find((row: any) => {
    const rowBoard = String(row?.exam_boards?.code || row?.exam_boards?.full_name || "").trim().toUpperCase();
    const rowQualification = String(row?.qualification_types?.code || "").trim().toUpperCase();
    const boardOk = !boardMatch || !rowBoard || rowBoard === boardMatch;
    const qualificationOk =
      !qualificationMatch || !rowQualification || rowQualification === qualificationMatch || rowQualification.includes(qualificationMatch);
    return boardOk && qualificationOk;
  });

  return best || (candidates || [])[0] || null;
}

function buildTree(topics: any[], countsByTopic: Map<string, number>) {
  const byId = new Map<string, any>();
  const roots: any[] = [];
  for (const t of topics) {
    const topicName = String(t.topic_name || "").trim();
    const node = {
      id: String(t.id),
      topic_name: topicName,
      topic_code: topicName,
      parent_topic_id: t.parent_topic_id ? String(t.parent_topic_id) : null,
      topic_level: Number(t.topic_level || 1),
      card_count: countsByTopic.get(topicName.toLowerCase()) || 0,
      children: [] as any[],
    };
    byId.set(node.id, node);
  }
  for (const node of byId.values()) {
    if (node.parent_topic_id && byId.has(node.parent_topic_id)) {
      byId.get(node.parent_topic_id).children.push(node);
    } else {
      roots.push(node);
    }
  }
  const sortRec = (nodes: any[]) => {
    nodes.sort((a, b) => a.topic_name.localeCompare(b.topic_name));
    nodes.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
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
    const subjectKey = String(payload.subject_key || "").trim();
    if (!subjectKey) return json(400, { ok: false, error: "Missing subject_key" });

    const appDb = getAppDbClient();
    const curriculumDb = getCurriculumClient() || appDb;
    const user = await upsertLiteUser(appDb, identity);

    const { data: cards, error: cardsErr } = await appDb
      .from("fl4sh_lite_cards")
      .select("topic_code")
      .eq("user_id", user.id)
      .eq("subject_key", subjectKey);
    if (cardsErr) return json(500, { ok: false, error: cardsErr.message });
    const countsByTopic = new Map<string, number>();
    for (const c of cards || []) {
      const key = String(c.topic_code || "").trim().toLowerCase();
      if (!key) continue;
      countsByTopic.set(key, (countsByTopic.get(key) || 0) + 1);
    }

    const subjectRow = await resolveSubjectRow(curriculumDb, subjectKey, user.id);
    if (!subjectRow?.id) {
      const fallback = Array.from(countsByTopic.keys()).sort().map((topicName, index) => ({
        id: `fallback-${index + 1}`,
        topic_name: topicName,
        topic_code: topicName,
        parent_topic_id: null,
        topic_level: 1,
        card_count: countsByTopic.get(topicName) || 0,
        children: [],
      }));
      return json(200, { ok: true, topics: fallback, fallback: true });
    }

    const { data: topics, error: topicErr } = await curriculumDb
      .from("curriculum_topics")
      .select("id,parent_topic_id,topic_name,topic_level")
      .eq("exam_board_subject_id", subjectRow.id)
      .order("topic_level", { ascending: true })
      .order("topic_name", { ascending: true });

    if (topicErr) {
      const fallback = Array.from(countsByTopic.keys()).sort().map((topicName, index) => ({
        id: `fallback-${index + 1}`,
        topic_name: topicName,
        topic_code: topicName,
        parent_topic_id: null,
        topic_level: 1,
        card_count: countsByTopic.get(topicName) || 0,
        children: [],
      }));
      return json(200, { ok: true, topics: fallback, fallback: true, warning: topicErr.message });
    }
    const tree = buildTree(topics || [], countsByTopic);
    return json(200, { ok: true, topics: tree });
  } catch (e: any) {
    return json(500, { ok: false, error: e?.message || "Internal error" });
  }
});
