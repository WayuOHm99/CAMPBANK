# Use one Next.js application with SQL-first Supabase access

EQCAMP is a single npm-managed Next.js application whose browser clients use Supabase RLS, RPC, and Realtime directly; server-only code is limited to bootstrap and recovery. Database behavior is defined by versioned SQL migrations and PostgreSQL functions, with generated TypeScript types and no ORM or separate backend service. This minimizes layers and duplicated permission logic while accepting tighter coupling to Supabase and PostgreSQL.
