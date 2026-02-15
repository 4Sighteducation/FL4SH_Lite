import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

function getRequiredEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function getAppDbClient() {
  const url = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export function getCurriculumClient() {
  const url = Deno.env.get("CURRICULUM_SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("CURRICULUM_SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}
