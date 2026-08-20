import type { Database } from "./database";

// Convenience aliases for the public schema's enums. Kept in this
// separate, hand-maintained file (not database.ts) because that file is
// fully overwritten by `supabase gen types typescript` after every
// migration — anything added directly to it is silently lost on the next
// regeneration.
export type UserRole = Database["public"]["Enums"]["user_role"];
export type AccountStatus = Database["public"]["Enums"]["account_status"];
export type VaApprovalStatus = Database["public"]["Enums"]["va_approval_status"];
