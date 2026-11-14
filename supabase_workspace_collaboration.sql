-- Aplicar manualmente no SQL Editor depois de supabase_workspace_records.sql.
-- Convites são destinados a contas Planora existentes; o script não envia e-mails.
begin;

create table if not exists public."Planora_workspace_members" (
    workspace_id uuid not null references public."Planora_workspaces"(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role text not null check (role in ('editor', 'viewer')),
    invited_by uuid references auth.users(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint "Planora_workspace_members_pkey" primary key (workspace_id, user_id)
);

alter table public."Planora_workspace_members"
    add column if not exists status text not null default 'accepted'
    check (status in ('pending', 'accepted'));

create index if not exists planora_workspace_members_user_idx
    on public."Planora_workspace_members"(user_id, workspace_id);

alter table public."Planora_workspace_members" enable row level security;
alter table public."Planora_workspaces" enable row level security;
alter table public."Planora_workspace_data" enable row level security;
alter table public."Planora_workspace_records" enable row level security;

create or replace function public.planora_workspace_role(p_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
    select case
        when exists (
            select 1
            from public."Planora_workspaces" w
            where w.id = p_workspace_id and w.owner_id = auth.uid()
        ) then 'owner'
        else (
            select m.role
            from public."Planora_workspace_members" m
            where m.workspace_id = p_workspace_id
              and m.user_id = auth.uid()
              and m.status = 'accepted'
        )
    end;
$function$;

revoke all on function public.planora_workspace_role(uuid) from public, anon;
grant execute on function public.planora_workspace_role(uuid) to authenticated;

drop policy if exists planora_workspace_members_read on public."Planora_workspace_members";
create policy planora_workspace_members_read
    on public."Planora_workspace_members"
    for select to authenticated
    using (
        user_id = auth.uid()
        or public.planora_workspace_role(workspace_id) = 'owner'
    );

drop policy if exists planora_workspace_members_read_limit on public."Planora_workspace_members";
create policy planora_workspace_members_read_limit
    on public."Planora_workspace_members"
    as restrictive for select to authenticated
    using (
        user_id = auth.uid()
        or public.planora_workspace_role(workspace_id) = 'owner'
    );

drop policy if exists planora_workspaces_collaborator_read on public."Planora_workspaces";
create policy planora_workspaces_collaborator_read
    on public."Planora_workspaces"
    for select to authenticated
    using (public.planora_workspace_role(id) is not null);

drop policy if exists planora_workspaces_read_limit on public."Planora_workspaces";
create policy planora_workspaces_read_limit
    on public."Planora_workspaces"
    as restrictive for select to authenticated
    using (public.planora_workspace_role(id) is not null);

drop policy if exists planora_workspaces_owner_insert on public."Planora_workspaces";
create policy planora_workspaces_owner_insert
    on public."Planora_workspaces"
    for insert to authenticated
    with check (owner_id = auth.uid());

drop policy if exists planora_workspaces_insert_limit on public."Planora_workspaces";
create policy planora_workspaces_insert_limit
    on public."Planora_workspaces"
    as restrictive for insert to authenticated
    with check (owner_id = auth.uid());

drop policy if exists planora_workspaces_owner_update on public."Planora_workspaces";
create policy planora_workspaces_owner_update
    on public."Planora_workspaces"
    for update to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists planora_workspaces_update_limit on public."Planora_workspaces";
create policy planora_workspaces_update_limit
    on public."Planora_workspaces"
    as restrictive for update to authenticated
    using (owner_id = auth.uid())
    with check (owner_id = auth.uid());

drop policy if exists planora_workspaces_owner_delete on public."Planora_workspaces";
create policy planora_workspaces_owner_delete
    on public."Planora_workspaces"
    for delete to authenticated
    using (owner_id = auth.uid());

drop policy if exists planora_workspaces_delete_limit on public."Planora_workspaces";
create policy planora_workspaces_delete_limit
    on public."Planora_workspaces"
    as restrictive for delete to authenticated
    using (owner_id = auth.uid());

drop policy if exists planora_workspace_data_collaborator_read on public."Planora_workspace_data";
create policy planora_workspace_data_collaborator_read
    on public."Planora_workspace_data"
    for select to authenticated
    using (public.planora_workspace_role(workspace_id) is not null);

drop policy if exists planora_workspace_data_read_limit on public."Planora_workspace_data";
create policy planora_workspace_data_read_limit
    on public."Planora_workspace_data"
    as restrictive for select to authenticated
    using (public.planora_workspace_role(workspace_id) is not null);

drop policy if exists planora_workspace_data_editor_insert on public."Planora_workspace_data";
create policy planora_workspace_data_editor_insert
    on public."Planora_workspace_data"
    for insert to authenticated
    with check (public.planora_workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists planora_workspace_data_insert_limit on public."Planora_workspace_data";
create policy planora_workspace_data_insert_limit
    on public."Planora_workspace_data"
    as restrictive for insert to authenticated
    with check (public.planora_workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists planora_workspace_data_editor_update on public."Planora_workspace_data";
create policy planora_workspace_data_editor_update
    on public."Planora_workspace_data"
    for update to authenticated
    using (public.planora_workspace_role(workspace_id) in ('owner', 'editor'))
    with check (public.planora_workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists planora_workspace_data_update_limit on public."Planora_workspace_data";
create policy planora_workspace_data_update_limit
    on public."Planora_workspace_data"
    as restrictive for update to authenticated
    using (public.planora_workspace_role(workspace_id) in ('owner', 'editor'))
    with check (public.planora_workspace_role(workspace_id) in ('owner', 'editor'));

drop policy if exists planora_workspace_records_collaborator_read on public."Planora_workspace_records";
create policy planora_workspace_records_collaborator_read
    on public."Planora_workspace_records"
    for select to authenticated
    using (public.planora_workspace_role(workspace_id) is not null);

drop policy if exists planora_workspace_records_read_limit on public."Planora_workspace_records";
create policy planora_workspace_records_read_limit
    on public."Planora_workspace_records"
    as restrictive for select to authenticated
    using (public.planora_workspace_role(workspace_id) is not null);

revoke all on table public."Planora_workspace_members" from public, anon, authenticated;
revoke all on table public."Planora_workspaces" from public, anon, authenticated;
revoke all on table public."Planora_workspace_data" from public, anon, authenticated;
revoke all on table public."Planora_workspace_records" from public, anon, authenticated;
grant select on table public."Planora_workspace_members" to authenticated;
grant select on table public."Planora_workspaces" to authenticated;
grant insert, update, delete on table public."Planora_workspaces" to authenticated;
grant select, insert, update on table public."Planora_workspace_data" to authenticated;
grant select on table public."Planora_workspace_records" to authenticated;
revoke insert, update, delete on table public."Planora_workspace_records" from public, anon, authenticated;

create or replace function public.planora_workspace_id_from_storage_path(p_name text)
returns uuid
language sql
immutable
set search_path = public, pg_temp
as $function$
    select case
        when split_part(p_name, '/', 1) ~*
            '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        then split_part(p_name, '/', 1)::uuid
        else null::uuid
    end;
$function$;

revoke all on function public.planora_workspace_id_from_storage_path(text) from public, anon;
grant execute on function public.planora_workspace_id_from_storage_path(text) to authenticated;

drop policy if exists planora_workspace_media_read on storage.objects;
create policy planora_workspace_media_read
    on storage.objects
    for select to authenticated
    using (
        bucket_id = 'midias'
        and public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) is not null
    );

drop policy if exists planora_legacy_media_read on storage.objects;
create policy planora_legacy_media_read
    on storage.objects
    for select to authenticated
    using (bucket_id = 'midias' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists planora_workspace_media_read_limit on storage.objects;
create policy planora_workspace_media_read_limit
    on storage.objects
    as restrictive for select to authenticated
    using (
        bucket_id <> 'midias'
        or public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) is not null
        or split_part(name, '/', 1) = auth.uid()::text
    );

drop policy if exists planora_workspace_media_insert on storage.objects;
create policy planora_workspace_media_insert
    on storage.objects
    for insert to authenticated
    with check (
        bucket_id = 'midias'
        and public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
    );

drop policy if exists planora_legacy_media_insert on storage.objects;
create policy planora_legacy_media_insert
    on storage.objects
    for insert to authenticated
    with check (bucket_id = 'midias' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists planora_workspace_media_insert_limit on storage.objects;
create policy planora_workspace_media_insert_limit
    on storage.objects
    as restrictive for insert to authenticated
    with check (
        bucket_id <> 'midias'
        or public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
        or split_part(name, '/', 1) = auth.uid()::text
    );

drop policy if exists planora_workspace_media_update on storage.objects;
create policy planora_workspace_media_update
    on storage.objects
    for update to authenticated
    using (
        bucket_id = 'midias'
        and public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
    )
    with check (
        bucket_id = 'midias'
        and public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
    );

drop policy if exists planora_legacy_media_update on storage.objects;
create policy planora_legacy_media_update
    on storage.objects
    for update to authenticated
    using (bucket_id = 'midias' and split_part(name, '/', 1) = auth.uid()::text)
    with check (bucket_id = 'midias' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists planora_workspace_media_update_limit on storage.objects;
create policy planora_workspace_media_update_limit
    on storage.objects
    as restrictive for update to authenticated
    using (
        bucket_id <> 'midias'
        or public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
        or split_part(name, '/', 1) = auth.uid()::text
    )
    with check (
        bucket_id <> 'midias'
        or public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
        or split_part(name, '/', 1) = auth.uid()::text
    );

drop policy if exists planora_workspace_media_delete on storage.objects;
create policy planora_workspace_media_delete
    on storage.objects
    for delete to authenticated
    using (
        bucket_id = 'midias'
        and public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
    );

drop policy if exists planora_legacy_media_delete on storage.objects;
create policy planora_legacy_media_delete
    on storage.objects
    for delete to authenticated
    using (bucket_id = 'midias' and split_part(name, '/', 1) = auth.uid()::text);

drop policy if exists planora_workspace_media_delete_limit on storage.objects;
create policy planora_workspace_media_delete_limit
    on storage.objects
    as restrictive for delete to authenticated
    using (
        bucket_id <> 'midias'
        or public.planora_workspace_role(public.planora_workspace_id_from_storage_path(name)) in ('owner', 'editor')
        or split_part(name, '/', 1) = auth.uid()::text
    );

drop function if exists public.planora_list_workspace_members(uuid);
create function public.planora_list_workspace_members(p_workspace_id uuid)
returns table(user_id uuid, email text, display_name text, role text, status text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    if public.planora_workspace_role(p_workspace_id) is distinct from 'owner' then
        raise exception 'Somente o dono pode gerenciar os membros deste workspace.'
            using errcode = '42501';
    end if;

    return query
    select u.id, u.email::text,
        coalesce(
            nullif(u.raw_user_meta_data ->> 'full_name', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(u.email, '@', 1), ''),
            'Dono'
        ),
        'owner'::text,
        'accepted'::text,
        w.created_at
    from public."Planora_workspaces" w
    join auth.users u on u.id = w.owner_id
    where w.id = p_workspace_id
    union all
    select u.id, u.email::text,
        coalesce(
            nullif(u.raw_user_meta_data ->> 'full_name', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(u.email, '@', 1), ''),
            'Membro'
        ),
        m.role,
        m.status,
        m.created_at
    from public."Planora_workspace_members" m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id
    order by 4, 3;
end;
$function$;

create or replace function public.planora_list_workspace_people(p_workspace_id uuid)
returns table(user_id uuid, display_name text)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    if public.planora_workspace_role(p_workspace_id) is null then
        raise exception 'Workspace não encontrado ou sem permissão.'
            using errcode = '42501';
    end if;

    return query
    with pessoas as (
        select w.owner_id as id
        from public."Planora_workspaces" w
        where w.id = p_workspace_id
        union
        select m.user_id
        from public."Planora_workspace_members" m
        where m.workspace_id = p_workspace_id and m.status = 'accepted'
        union
        select r.created_by
        from public."Planora_workspace_records" r
        where r.workspace_id = p_workspace_id and r.created_by is not null
        union
        select r.updated_by
        from public."Planora_workspace_records" r
        where r.workspace_id = p_workspace_id and r.updated_by is not null
    )
    select u.id,
        coalesce(
            nullif(u.raw_user_meta_data ->> 'full_name', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(u.email, '@', 1), ''),
            'Membro'
        )
    from pessoas p
    join auth.users u on u.id = p.id;
end;
$function$;

drop function if exists public.planora_add_workspace_member(uuid, text, text);
create function public.planora_add_workspace_member(
    p_workspace_id uuid,
    p_email text,
    p_role text
)
returns table(user_id uuid, email text, role text, status text, joined_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_user_id uuid;
begin
    if public.planora_workspace_role(p_workspace_id) is distinct from 'owner' then
        raise exception 'Somente o dono pode convidar pessoas.'
            using errcode = '42501';
    end if;
    if p_role is null or p_role not in ('editor', 'viewer') then
        raise exception 'Papel inválido. Use editor ou viewer.'
            using errcode = '22023';
    end if;
    if nullif(trim(p_email), '') is null then
        raise exception 'Informe o e-mail da conta Planora.'
            using errcode = '22023';
    end if;

    select u.id into v_user_id
    from auth.users u
    where lower(u.email) = lower(trim(p_email))
    limit 1;
    if not found then
        raise exception 'Não há uma conta Planora cadastrada com esse e-mail.'
            using errcode = 'P0002';
    end if;
    if exists (
        select 1 from public."Planora_workspaces" w
        where w.id = p_workspace_id and w.owner_id = v_user_id
    ) then
        raise exception 'O dono do workspace já possui acesso total.'
            using errcode = '22023';
    end if;

    insert into public."Planora_workspace_members"
        (workspace_id, user_id, role, invited_by, status)
    values
        (p_workspace_id, v_user_id, p_role, auth.uid(), 'pending')
    on conflict on constraint "Planora_workspace_members_pkey" do update
        set role = excluded.role,
            invited_by = excluded.invited_by,
            updated_at = clock_timestamp();

    return query
    select m.user_id, u.email::text, m.role, m.status, m.created_at
    from public."Planora_workspace_members" m
    join auth.users u on u.id = m.user_id
    where m.workspace_id = p_workspace_id and m.user_id = v_user_id;
end;
$function$;

create or replace function public.planora_list_my_workspace_invitations()
returns table(
    workspace_id uuid,
    workspace_name text,
    role text,
    inviter_name text,
    invited_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    return query
    select w.id, w.nome, m.role,
        coalesce(
            nullif(u.raw_user_meta_data ->> 'full_name', ''),
            nullif(u.raw_user_meta_data ->> 'name', ''),
            nullif(split_part(u.email, '@', 1), ''),
            'Dono'
        ),
        m.created_at
    from public."Planora_workspace_members" m
    join public."Planora_workspaces" w on w.id = m.workspace_id
    left join auth.users u on u.id = m.invited_by
    where m.user_id = auth.uid() and m.status = 'pending'
    order by m.created_at desc;
end;
$function$;

create or replace function public.planora_respond_workspace_invitation(
    p_workspace_id uuid,
    p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    if p_accept is null then
        raise exception 'Informe se deseja aceitar o convite.'
            using errcode = '22023';
    end if;

    if p_accept then
        update public."Planora_workspace_members" m
        set status = 'accepted', updated_at = clock_timestamp()
        where m.workspace_id = p_workspace_id
          and m.user_id = auth.uid()
          and m.status = 'pending';
    else
        delete from public."Planora_workspace_members" m
        where m.workspace_id = p_workspace_id
          and m.user_id = auth.uid()
          and m.status = 'pending';
    end if;

    if not found then
        raise exception 'Convite não encontrado ou já respondido.'
            using errcode = 'P0002';
    end if;
end;
$function$;

create or replace function public.planora_update_workspace_member_role(
    p_workspace_id uuid,
    p_user_id uuid,
    p_role text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    if public.planora_workspace_role(p_workspace_id) is distinct from 'owner' then
        raise exception 'Somente o dono pode alterar os papéis.'
            using errcode = '42501';
    end if;
    if p_role is null or p_role not in ('editor', 'viewer') then
        raise exception 'Papel inválido. Use editor ou viewer.'
            using errcode = '22023';
    end if;

    update public."Planora_workspace_members"
    set role = p_role, updated_at = clock_timestamp()
    where workspace_id = p_workspace_id and user_id = p_user_id;
    if not found then
        raise exception 'Membro não encontrado.'
            using errcode = 'P0002';
    end if;
end;
$function$;

create or replace function public.planora_remove_workspace_member(
    p_workspace_id uuid,
    p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
    if public.planora_workspace_role(p_workspace_id) is distinct from 'owner' then
        raise exception 'Somente o dono pode remover membros.'
            using errcode = '42501';
    end if;

    delete from public."Planora_workspace_members"
    where workspace_id = p_workspace_id and user_id = p_user_id;
    if not found then
        raise exception 'Membro não encontrado.'
            using errcode = 'P0002';
    end if;
end;
$function$;

revoke all on function public.planora_list_workspace_members(uuid) from public, anon;
revoke all on function public.planora_list_workspace_people(uuid) from public, anon;
revoke all on function public.planora_add_workspace_member(uuid, text, text) from public, anon;
revoke all on function public.planora_list_my_workspace_invitations() from public, anon;
revoke all on function public.planora_respond_workspace_invitation(uuid, boolean) from public, anon;
revoke all on function public.planora_update_workspace_member_role(uuid, uuid, text) from public, anon;
revoke all on function public.planora_remove_workspace_member(uuid, uuid) from public, anon;
grant execute on function public.planora_list_workspace_members(uuid) to authenticated;
grant execute on function public.planora_list_workspace_people(uuid) to authenticated;
grant execute on function public.planora_add_workspace_member(uuid, text, text) to authenticated;
grant execute on function public.planora_list_my_workspace_invitations() to authenticated;
grant execute on function public.planora_respond_workspace_invitation(uuid, boolean) to authenticated;
grant execute on function public.planora_update_workspace_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.planora_remove_workspace_member(uuid, uuid) to authenticated;

drop function if exists public.planora_apply_workspace_record_changes(uuid, jsonb, jsonb);
create function public.planora_apply_workspace_record_changes(
    p_workspace_id uuid,
    p_upserts jsonb,
    p_deletes jsonb
)
returns table(
    record_id uuid,
    revision bigint,
    created_by uuid,
    created_at timestamptz,
    updated_by uuid,
    updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
    v_change jsonb;
    v_record_id uuid;
    v_parent_id uuid;
    v_kind text;
    v_position integer;
    v_payload jsonb;
    v_expected_revision bigint;
    v_current public."Planora_workspace_records"%rowtype;
    v_parent_kind text;
    v_role text;
    v_rows integer;
    v_upsert_ids uuid[] := array[]::uuid[];
begin
    v_role := public.planora_workspace_role(p_workspace_id);
    if v_role is null or v_role not in ('owner', 'editor') then
        raise exception 'Este workspace está em modo de visualização.'
            using errcode = '42501';
    end if;
    if p_upserts is null or jsonb_typeof(p_upserts) <> 'array'
       or p_deletes is null or jsonb_typeof(p_deletes) <> 'array' then
        raise exception 'As alterações precisam ser listas JSON.'
            using errcode = '22023';
    end if;

    for v_change in select value from jsonb_array_elements(p_upserts) as entry(value)
    loop
        v_record_id := nullif(v_change ->> 'record_id', '')::uuid;
        v_parent_id := nullif(v_change ->> 'parent_record_id', '')::uuid;
        v_kind := v_change ->> 'kind';
        v_position := nullif(v_change ->> 'position', '')::integer;
        v_payload := v_change -> 'payload';
        v_expected_revision := nullif(v_change ->> 'expected_revision', '')::bigint;

        if v_record_id is null or v_kind is null or v_kind not in ('project', 'folder', 'card')
           or v_position is null or v_position < 0
           or v_payload is null or jsonb_typeof(v_payload) <> 'object' then
            raise exception 'Registro inválido na solicitação de sincronização.'
                using errcode = '22023';
        end if;
        if v_kind = 'card' and v_parent_id is null then
            raise exception 'Um card precisa pertencer a um projeto.'
                using errcode = '23514';
        end if;

        if v_parent_id is not null then
            select r.kind into v_parent_kind
            from public."Planora_workspace_records" r
            where r.workspace_id = p_workspace_id and r.record_id = v_parent_id;
            if not found then
                raise exception 'O registro pai não existe.'
                    using errcode = '23503';
            end if;
            if (v_kind = 'card' and v_parent_kind <> 'project')
               or (v_kind in ('project', 'folder') and v_parent_kind <> 'folder') then
                raise exception 'Tipo de registro pai incompatível.'
                    using errcode = '23514';
            end if;
        end if;

        if v_expected_revision is null then
            insert into public."Planora_workspace_records"
                (workspace_id, record_id, parent_record_id, kind, position, payload,
                 revision, created_by, updated_by)
            values
                (p_workspace_id, v_record_id, v_parent_id, v_kind, v_position, v_payload,
                 1, auth.uid(), auth.uid())
            on conflict (workspace_id, record_id) do nothing;
            get diagnostics v_rows = row_count;

            if v_rows = 0 then
                select * into v_current
                from public."Planora_workspace_records" r
                where r.workspace_id = p_workspace_id and r.record_id = v_record_id
                for update;
                if not found or v_current.parent_record_id is distinct from v_parent_id
                   or v_current.kind is distinct from v_kind
                   or v_current.position is distinct from v_position
                   or v_current.payload is distinct from v_payload then
                    raise exception 'Conflito de revisão no registro %.', v_record_id
                        using errcode = '40001';
                end if;
            end if;
        else
            update public."Planora_workspace_records" r
            set parent_record_id = v_parent_id,
                kind = v_kind,
                position = v_position,
                payload = v_payload,
                revision = r.revision + 1,
                updated_by = auth.uid(),
                updated_at = clock_timestamp()
            where r.workspace_id = p_workspace_id
              and r.record_id = v_record_id
              and r.revision = v_expected_revision;
            get diagnostics v_rows = row_count;

            if v_rows = 0 then
                select * into v_current
                from public."Planora_workspace_records" r
                where r.workspace_id = p_workspace_id and r.record_id = v_record_id
                for update;
                if not found or v_current.revision <> v_expected_revision + 1
                   or v_current.parent_record_id is distinct from v_parent_id
                   or v_current.kind is distinct from v_kind
                   or v_current.position is distinct from v_position
                   or v_current.payload is distinct from v_payload then
                    raise exception 'Conflito de revisão no registro %.', v_record_id
                        using errcode = '40001';
                end if;
            end if;
        end if;
        v_upsert_ids := array_append(v_upsert_ids, v_record_id);
    end loop;

    for v_change in select value from jsonb_array_elements(p_deletes) as entry(value)
    loop
        v_record_id := nullif(v_change ->> 'record_id', '')::uuid;
        v_expected_revision := nullif(v_change ->> 'expected_revision', '')::bigint;
        if v_record_id is null or v_expected_revision is null then
            raise exception 'Exclusão inválida na solicitação de sincronização.'
                using errcode = '22023';
        end if;

        delete from public."Planora_workspace_records" r
        where r.workspace_id = p_workspace_id
          and r.record_id = v_record_id
          and r.revision = v_expected_revision;
        get diagnostics v_rows = row_count;
        if v_rows = 0 and exists (
            select 1 from public."Planora_workspace_records" r
            where r.workspace_id = p_workspace_id and r.record_id = v_record_id
        ) then
            raise exception 'Conflito de revisão no registro %.', v_record_id
                using errcode = '40001';
        end if;
    end loop;

    return query
    select r.record_id, r.revision, r.created_by, r.created_at, r.updated_by, r.updated_at
    from public."Planora_workspace_records" r
    where r.workspace_id = p_workspace_id and r.record_id = any(v_upsert_ids);
end;
$function$;

revoke all on function public.planora_apply_workspace_record_changes(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.planora_apply_workspace_record_changes(uuid, jsonb, jsonb) to authenticated;

do $publication$
begin
    if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
        raise exception 'A publicação supabase_realtime não existe neste projeto.';
    end if;
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'Planora_workspace_records'
    ) then
        execute 'alter publication supabase_realtime add table public."Planora_workspace_records"';
    end if;
    execute 'alter table public."Planora_workspace_records" replica identity full';
end;
$publication$;

commit;
