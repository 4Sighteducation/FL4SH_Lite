import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

type CatalogRow = {
  subject_key: string;
  subject_name: string | null;
  exam_board: string | null;
  qualification_type: string | null;
};

function normalizeQualification(v: string | null): string {
  const raw = String(v || "").trim().toUpperCase();
  if (!raw) return "";
  if (raw.includes("GCSE") || raw === "NATIONAL_5") return "GCSE";
  if (raw.includes("A_LEVEL") || raw.includes("A-LEVEL") || raw.includes("HIGHER")) return "A_LEVEL";
  return raw;
}

export async function fetchCatalogRows(
  curriculumClient: SupabaseClient | null,
  qualificationLevel?: string | null,
): Promise<CatalogRow[]> {
  if (!curriculumClient) return [];

  const source = Deno.env.get("CURRICULUM_CATALOG_SOURCE") || "fl4sh_lite_subject_catalog";
  const maxRows = Number(Deno.env.get("CURRICULUM_CATALOG_LIMIT") || "500");

  let query = curriculumClient
    .from(source)
    .select("subject_key,subject_name,exam_board,qualification_type")
    .limit(Number.isFinite(maxRows) ? maxRows : 500);

  const normalized = normalizeQualification(qualificationLevel ?? null);
  if (normalized) {
    query = query.ilike("qualification_type", `%${normalized}%`);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Catalog query failed: ${error.message}`);
  }

  return (data || [])
    .filter((r: any) => r?.subject_key)
    .map((r: any) => ({
      subject_key: String(r.subject_key),
      subject_name: r.subject_name ? String(r.subject_name) : null,
      exam_board: r.exam_board ? String(r.exam_board) : null,
      qualification_type: r.qualification_type ? String(r.qualification_type) : null,
    }));
}
