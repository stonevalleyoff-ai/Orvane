-- Orvane × Stone Valley — la table des pressions (projet Supabase « Vallée de pierre »)
-- Insertion seule, par compte connecté ; personne ne lit depuis le jeu. L'action nocturne d'Orvane lit avec la clé de service.
create table if not exists orvane_pressions (
  id      bigserial primary key,
  compte  uuid not null default auth.uid(),
  monde   text not null,
  lot     jsonb not null,
  recu    timestamptz not null default now()
);
alter table orvane_pressions enable row level security;
create policy "un compte dépose ses lots" on orvane_pressions for insert to authenticated with check (compte = auth.uid());
-- (pas de politique select : le jeu ne relit jamais)

-- La fonction que le traducteur appelle : vp_orvane_pression(p_lot). Elle borne la taille du lot et le nombre de dépôts par jour.
create or replace function vp_orvane_pression(p_lot jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'erreur', 'non connecté'); end if;
  if pg_column_size(p_lot) > 65536 then return jsonb_build_object('ok', false, 'erreur', 'lot trop gros'); end if;
  select count(*) into n from orvane_pressions where compte = auth.uid() and recu > now() - interval '1 day';
  if n >= 48 then return jsonb_build_object('ok', false, 'erreur', 'trop de dépôts aujourd''hui'); end if;
  insert into orvane_pressions (compte, monde, lot) values (auth.uid(), coalesce(p_lot->>'monde', 'sv-1'), p_lot);
  return jsonb_build_object('ok', true);
end $$;
grant execute on function vp_orvane_pression(jsonb) to authenticated;
