-- Orvane × Stone Valley — la table des pressions (projet Supabase « Vallée de pierre »), sa porte d'entrée (le jeu)
-- et sa porte de sortie (Orvane). La table n'est accessible que par ces deux fonctions.
create table if not exists public.orvane_pressions (
  id      bigserial primary key,
  compte  uuid not null default auth.uid(),
  monde   text not null,
  lot     jsonb not null,
  recu    timestamptz not null default now()
);
alter table public.orvane_pressions enable row level security;
-- aucune politique : ni lecture ni écriture directes (et l'ancienne politique d'insertion, si elle existait, disparaît)
drop policy if exists "un compte dépose ses lots" on public.orvane_pressions;
revoke all on public.orvane_pressions from anon, authenticated;
revoke all on sequence public.orvane_pressions_id_seq from anon, authenticated;
create index if not exists orvane_pressions_compte_recu on public.orvane_pressions (compte, recu);   -- le compte des dépôts du jour
create index if not exists orvane_pressions_monde_id on public.orvane_pressions (monde, id);         -- la lecture nocturne

-- L'ENTRÉE : le traducteur du jeu dépose un lot (compte connecté, 64 Ko au plus, 48 dépôts par compte et par jour)
create or replace function public.vp_orvane_pression(p_lot jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  if auth.uid() is null then return jsonb_build_object('ok', false, 'erreur', 'non connecté'); end if;
  if jsonb_typeof(p_lot) <> 'object' or jsonb_typeof(p_lot->'evenements') <> 'array' then return jsonb_build_object('ok', false, 'erreur', 'lot mal formé'); end if;
  if pg_column_size(p_lot) > 65536 then return jsonb_build_object('ok', false, 'erreur', 'lot trop gros'); end if;
  select count(*) into n from public.orvane_pressions where compte = auth.uid() and recu > now() - interval '1 day';
  if n >= 48 then return jsonb_build_object('ok', false, 'erreur', 'trop de dépôts aujourd''hui'); end if;
  insert into public.orvane_pressions (compte, monde, lot) values (auth.uid(), left(coalesce(p_lot->>'monde', 'sv-1'), 40), p_lot);
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.vp_orvane_pression(jsonb) from public, anon;
grant execute on function public.vp_orvane_pression(jsonb) to authenticated;

-- LA SORTIE : l'action nocturne d'Orvane lit les lots avec SON secret — jamais la clé de service du jeu, qui ouvre
-- tout (comptes, sauvegardes). Seule l'empreinte du secret est gardée, dans un schéma que l'API ne sert pas.
create schema if not exists orvane_prive;
revoke all on schema orvane_prive from public, anon, authenticated;
create table if not exists orvane_prive.cles (nom text primary key, empreinte bytea not null, cree timestamptz not null default now());
revoke all on orvane_prive.cles from public, anon, authenticated;

create or replace function public.orvane_lire_lots(p_secret text, p_monde text, p_apres bigint default 0, p_limite int default 1000)
returns table (id bigint, lot jsonb, compte text, recu timestamptz)
language plpgsql stable security definer set search_path = public, extensions as $$
begin
  if p_secret is null or not exists (select 1 from orvane_prive.cles c where c.nom = 'lecture' and c.empreinte = extensions.digest(p_secret, 'sha256')) then
    raise exception 'secret invalide' using errcode = '42501';
  end if;
  -- le compte sort pseudonymisé : Orvane n'a besoin que de distinguer les joueurs, pas de savoir qui ils sont
  return query select o.id, o.lot, 'u:' || left(encode(extensions.digest(o.compte::text || ':orvane', 'sha256'), 'hex'), 12), o.recu
    from public.orvane_pressions o where o.monde = p_monde and o.id > coalesce(p_apres, 0)
    order by o.id limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
end $$;
revoke all on function public.orvane_lire_lots(text, text, bigint, int) from public, authenticated;
grant execute on function public.orvane_lire_lots(text, text, bigint, int) to anon;

-- LE SECRET DE LECTURE : tirer un secret long et aléatoire, le mettre dans les secrets du dépôt Orvane
-- (ORVANE_LECTURE_SECRET), et n'en garder ici que l'empreinte. Pour en changer, refaire la même ligne.
--   insert into orvane_prive.cles (nom, empreinte) values ('lecture', extensions.digest('<le secret>', 'sha256'))
--     on conflict (nom) do update set empreinte = excluded.empreinte, cree = now();
