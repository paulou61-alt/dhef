export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://agxfllitaklksaszmxpb.supabase.co";

// Publishable key: intentionally safe for browser/client use. RLS remains the authorization layer.
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "sb_publishable_vK7KODthdzEviu4XbLPN3w_5gcDvu9B";
