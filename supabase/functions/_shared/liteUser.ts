import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
import type { LiteIdentity } from "./auth.ts";

export async function upsertLiteUser(
  db: SupabaseClient,
  identity: LiteIdentity,
): Promise<{ id: string; email: string }> {
  const upsertPayload = {
    email: identity.email,
    knack_user_id: identity.knackUserId,
    full_name: identity.fullName,
    school_name: identity.schoolName,
    qualification_level: identity.qualificationLevel,
  };

  const { data, error } = await db
    .from("fl4sh_lite_users")
    .upsert(upsertPayload, { onConflict: "email" })
    .select("id,email")
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message || "Could not upsert lite user");
  }
  return data;
}

export async function getLiteUserByIdentity(
  db: SupabaseClient,
  identity: LiteIdentity,
): Promise<{ id: string; email: string } | null> {
  const { data, error } = await db
    .from("fl4sh_lite_users")
    .select("id,email")
    .eq("email", identity.email)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}
