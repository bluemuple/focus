// =============================================================
//  WordCatch — Supabase configuration
//
//  Uses the SAME Supabase project as the parent 또박또박 / Focus
//  sites — one project, many apps, table prefixes keep them
//  separate (wc_* tables for this site).
//
//  WordCatch does NOT use Supabase auth (no email / password).
//  Students log in with a 4-digit code their teacher gave them;
//  the resolved wc_users row is cached in localStorage as the
//  "session." All DB calls go through PostgREST with the anon
//  key; Phase 1 RLS is permissive — Phase 7 will tighten with a
//  proper validate-login-code edge function that issues a JWT.
// =============================================================

window.WC_SUPABASE = {
  url:  'https://sbatsnivlrlywpfytlio.supabase.co',
  anon: 'sb_publishable_vwZUKHhhtBEjAgXrZQTNFQ_bQeM8Ypc',
};
