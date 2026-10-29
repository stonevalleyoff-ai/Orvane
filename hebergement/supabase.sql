-- Orvane — LE SUPABASE D'ORVANE (hebergement/supabase.sql)
-- Le projet Supabase propre à Orvane : n'importe quel jeu s'y inscrit, reçoit une clé, et y dépose ce que font ses
-- joueurs ; l'action nocturne d'Orvane le lit avec son secret. Aucune table n'est accessible directement : tout passe
-- par les fonctions ci-dessous (hebergement/LISEZ-MOI.md).
--   orvane_inscrire_jeu(nom, contact)        n'importe qui      → { jeu, cle, cle_admin } : la clé publique du jeu, sa clé d'administration
--   orvane_regler_jeu(cle_admin, exposition) le jeu            → ce que le jeu sait montrer (le tampon en a besoin pour dénormaliser)
--   orvane_deposer(cle, compte, lot)         le client du jeu  → un lot de pressions (compte : l'identifiant du joueur dans le jeu)
--   orvane_jeu(cle)                          le client du jeu  → ce qu'Orvane sait du jeu
--   orvane_lire_lots(secret, monde, après)   l'action nocturne → les lots, comptes pseudonymisés
--   orvane_lire_jeux(secret)                 l'action nocturne → les jeux et leur exposition
-- À coller une fois dans l'éditeur SQL du projet (il peut être recollé : tout est « if not exists » / « or replace »).
create extension if not exists pgcrypto with schema extensions;

-- === les jeux ===
create table if not exists public.orvane_jeux (
  id              text primary key,                        -- « stone-valley »
  nom             text not null,
  contact         text,
  cle             text not null unique,                    -- publique : elle est dans le code du jeu
  admin_empreinte bytea not null,                          -- l'empreinte de la clé d'administration (la clé, jamais)
  exposition      jsonb not null default '{}'::jsonb,      -- profil.exposition du jeu (schemas/profil.schema.json)
  actif           boolean not null default true,
  quota_jour      int not null default 20000,              -- lots par jour, tous joueurs confondus
  cree            timestamptz not null default now()
);
-- === les lots ===
create table if not exists public.orvane_lots (
  id     bigserial primary key,
  jeu    text not null references public.orvane_jeux (id),
  compte text not null,                                    -- pseudonyme : empreinte du compte du joueur dans son jeu
  monde  text not null,
  lot    jsonb not null,
  recu   timestamptz not null default now()
);
create index if not exists orvane_lots_monde_id on public.orvane_lots (monde, id);                 -- la lecture nocturne
create index if not exists orvane_lots_jeu_compte_recu on public.orvane_lots (jeu, compte, recu);  -- les quotas
create index if not exists orvane_lots_jeu_recu on public.orvane_lots (jeu, recu);
alter table public.orvane_jeux enable row level security;
alter table public.orvane_lots enable row level security;
revoke all on public.orvane_jeux, public.orvane_lots from anon, authenticated;
revoke all on sequence public.orvane_lots_id_seq from anon, authenticated;

-- === le secret de lecture de l'action nocturne (seule son empreinte est gardée, dans un schéma que l'API ne sert pas) ===
create schema if not exists orvane_prive;
revoke all on schema orvane_prive from public, anon, authenticated;
create table if not exists orvane_prive.cles (nom text primary key, empreinte bytea not null, cree timestamptz not null default now());
revoke all on orvane_prive.cles from public, anon, authenticated;
create or replace function orvane_prive.secret_ok(p_secret text) returns boolean
language sql stable security definer set search_path = orvane_prive, extensions as $$
  select p_secret is not null and exists (select 1 from orvane_prive.cles c where c.nom = 'lecture' and c.empreinte = extensions.digest(p_secret, 'sha256'))
$$;

-- === s'inscrire : n'importe quel jeu, sans compte. 30 inscriptions par heure au plus, pour tout le monde ===
create or replace function public.orvane_inscrire_jeu(p_nom text, p_contact text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare base text; ident text; cle text; adm text; n int;
begin
  if p_nom is null or length(trim(p_nom)) < 2 or length(p_nom) > 60 then return jsonb_build_object('ok', false, 'erreur', 'nom de jeu : 2 à 60 caractères'); end if;
  select count(*) into n from public.orvane_jeux where cree > now() - interval '1 hour';
  if n >= 30 then return jsonb_build_object('ok', false, 'erreur', 'trop d''inscriptions en ce moment, réessayez dans une heure'); end if;
  base := trim(both '-' from regexp_replace(translate(lower(trim(p_nom)), 'àâäáãåéèêëíìîïóòôöõúùûüýÿçñœæ', 'aaaaaaeeeeiiiiooooouuuuyycnoa'), '[^a-z0-9]+', '-', 'g'));
  if base = '' then base := 'jeu'; end if;
  ident := left(base, 40);
  if exists (select 1 from public.orvane_jeux where id = ident) then ident := left(base, 34) || '-' || encode(extensions.gen_random_bytes(3), 'hex'); end if;
  cle := 'orv_' || encode(extensions.gen_random_bytes(16), 'hex');
  adm := 'orvadm_' || encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.orvane_jeux (id, nom, contact, cle, admin_empreinte) values (ident, trim(p_nom), left(p_contact, 200), cle, extensions.digest(adm, 'sha256'));
  return jsonb_build_object('ok', true, 'jeu', ident, 'cle', cle, 'cle_admin', adm,
    'note', 'la clé va dans le code du jeu ; la clé d''administration se garde secrète (orvane_regler_jeu)');
end $$;

-- === régler son jeu : ce qu'il sait montrer (32 Ko au plus) ; avec la clé d'administration ===
create or replace function public.orvane_regler_jeu(p_cle_admin text, p_exposition jsonb, p_nom text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare ident text;
begin
  select id into ident from public.orvane_jeux where admin_empreinte = extensions.digest(coalesce(p_cle_admin, ''), 'sha256');
  if ident is null then return jsonb_build_object('ok', false, 'erreur', 'clé d''administration inconnue'); end if;
  if p_exposition is not null and (jsonb_typeof(p_exposition) is distinct from 'object' or pg_column_size(p_exposition) > 32768) then return jsonb_build_object('ok', false, 'erreur', 'exposition : un objet de 32 Ko au plus'); end if;
  update public.orvane_jeux set exposition = coalesce(p_exposition, exposition), nom = coalesce(nullif(trim(p_nom), ''), nom) where id = ident;
  return jsonb_build_object('ok', true, 'jeu', ident);
end $$;

-- === déposer un lot : 64 Ko, 500 événements, 48 lots par joueur et par jour, le quota du jeu ===
create or replace function public.orvane_deposer(p_cle text, p_compte text, p_lot jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare j public.orvane_jeux; pseudo text; n int;
begin
  select * into j from public.orvane_jeux where cle = p_cle;
  if j.id is null then return jsonb_build_object('ok', false, 'erreur', 'clé de jeu inconnue'); end if;
  if not j.actif then return jsonb_build_object('ok', false, 'erreur', 'ce jeu est suspendu'); end if;
  if p_compte is null or length(p_compte) < 1 or length(p_compte) > 128 then return jsonb_build_object('ok', false, 'erreur', 'compte : 1 à 128 caractères'); end if;
  if jsonb_typeof(p_lot) is distinct from 'object' or jsonb_typeof(p_lot->'evenements') is distinct from 'array' then return jsonb_build_object('ok', false, 'erreur', 'lot mal formé'); end if;
  if pg_column_size(p_lot) > 65536 or jsonb_array_length(p_lot->'evenements') > 500 then return jsonb_build_object('ok', false, 'erreur', 'lot trop gros'); end if;
  pseudo := left(encode(extensions.digest(j.id || ':' || p_compte || ':orvane', 'sha256'), 'hex'), 16);   -- Orvane distingue les joueurs, sans savoir qui ils sont
  select count(*) into n from public.orvane_lots where jeu = j.id and compte = pseudo and recu > now() - interval '1 day';
  if n >= 48 then return jsonb_build_object('ok', false, 'erreur', 'trop de dépôts aujourd''hui pour ce joueur'); end if;
  select count(*) into n from public.orvane_lots where jeu = j.id and recu > now() - interval '1 day';
  if n >= j.quota_jour then return jsonb_build_object('ok', false, 'erreur', 'quota du jeu atteint pour aujourd''hui'); end if;
  insert into public.orvane_lots (jeu, compte, monde, lot) values (j.id, pseudo, left(coalesce(p_lot->>'monde', 'orvane'), 40), p_lot - 'source');
  return jsonb_build_object('ok', true);
end $$;

-- === ce qu'Orvane sait d'un jeu (sa clé publique suffit) ===
create or replace function public.orvane_jeu(p_cle text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('ok', true, 'jeu', id, 'nom', nom, 'actif', actif, 'exposition', exposition) from public.orvane_jeux where cle = p_cle),
    jsonb_build_object('ok', false, 'erreur', 'clé de jeu inconnue'))
$$;

-- === l'action nocturne : les lots d'un monde, après le dernier lu ; et les jeux ===
create or replace function public.orvane_lire_lots(p_secret text, p_monde text, p_apres bigint default 0, p_limite int default 1000)
returns table (id bigint, jeu text, compte text, lot jsonb, recu timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not orvane_prive.secret_ok(p_secret) then raise exception 'secret invalide' using errcode = '42501'; end if;
  return query select o.id, o.jeu, o.jeu || ':' || o.compte, o.lot, o.recu from public.orvane_lots o
    where o.monde = p_monde and o.id > coalesce(p_apres, 0) order by o.id limit least(greatest(coalesce(p_limite, 1000), 1), 1000);
end $$;
create or replace function public.orvane_lire_jeux(p_secret text) returns table (id text, nom text, actif boolean, exposition jsonb)
language plpgsql stable security definer set search_path = public as $$
begin
  if not orvane_prive.secret_ok(p_secret) then raise exception 'secret invalide' using errcode = '42501'; end if;
  return query select g.id, g.nom, g.actif, g.exposition from public.orvane_jeux g order by g.id;
end $$;

-- === qui peut appeler quoi : les jeux (anon) déposent et s'inscrivent ; la lecture demande le secret ===
revoke all on function public.orvane_inscrire_jeu(text, text), public.orvane_regler_jeu(text, jsonb, text), public.orvane_deposer(text, text, jsonb),
  public.orvane_jeu(text), public.orvane_lire_lots(text, text, bigint, int), public.orvane_lire_jeux(text), orvane_prive.secret_ok(text) from public;
grant execute on function public.orvane_inscrire_jeu(text, text), public.orvane_regler_jeu(text, jsonb, text), public.orvane_deposer(text, text, jsonb),
  public.orvane_jeu(text), public.orvane_lire_lots(text, text, bigint, int), public.orvane_lire_jeux(text) to anon, authenticated;
