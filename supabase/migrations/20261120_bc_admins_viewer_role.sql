-- Viewer (read-only) role for the Baja Curated panel. Applied 2026-11-19.
alter table public.bc_admins add column if not exists role text not null default 'admin';
alter table public.bc_admins add constraint bc_admins_role_check check (role in ('admin','viewer'));
create or replace function public.is_bc_admin() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.bc_admins where email = (select auth.jwt() ->> 'email') and role = 'admin');
$$;
create or replace function public.is_bc_member() returns boolean language sql stable security definer set search_path to 'public' as $$
  select exists (select 1 from public.bc_admins where email = (select auth.jwt() ->> 'email'));
$$;
revoke all on function public.is_bc_member() from public, anon;
grant execute on function public.is_bc_member() to authenticated;
-- + policy bc_viewer_read (select, authenticated, is_bc_member()) on bc_bookings, bc_blackouts, bc_concierges, bc_tours, bc_vehicles, bc_gallery
