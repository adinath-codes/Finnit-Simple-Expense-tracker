/** Shared API wire types; generated SQL types should live in a separate file. */
// Wire contracts are shared with the backend. Generate full Database types from
// Supabase after deploying the migration; do not generate from another project.
export type {
  CaptureInput,
  Catalog,
  Extraction,
  SavedEntry,
  SearchPlan,
  Transaction,
} from "../../../supabase/functions/_shared/contracts";
