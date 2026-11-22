-- =============================================================================
-- ReadingFlow · Teste SQL de Isolamento RLS com Dois Usuários (A e B)
-- Executar em ambiente local/staging com Supabase CLI (`supabase test db` / psql)
-- =============================================================================
BEGIN;

DO $$
DECLARE
  v_user_a UUID := '11111111-1111-4111-8111-111111111111';
  v_user_b UUID := '22222222-2222-4222-8222-222222222222';
  v_work_a UUID;
  v_edition_a UUID;
  v_shelf_a UUID;
  v_shelf_b UUID;
  v_count INTEGER;
  v_blocked BOOLEAN := FALSE;
BEGIN
  -- 1. Cria dois usuários sintéticos de teste em auth.users
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, 'rls-a@example.test', 'test-hash-a', now(), now(), now()),
    (v_user_b, 'rls-b@example.test', 'test-hash-b', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Sessão autenticada como Usuário A
  PERFORM set_config('role', 'authenticated', TRUE);
  PERFORM set_config('request.jwt.claim.sub', v_user_a::text, TRUE);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', TRUE);

  INSERT INTO public.works (title) VALUES ('Dom Casmurro (A)') RETURNING id INTO v_work_a;
  INSERT INTO public.editions (work_id, title, cover_url, cover_source, cover_locked, cover_selected_at)
  VALUES (v_work_a, 'Dom Casmurro (A)', '/api/covers/file/a/ed/1.webp', 'upload', TRUE, now())
  RETURNING id INTO v_edition_a;

  INSERT INTO public.shelves (name, kind) VALUES ('Física A', 'physical') RETURNING id INTO v_shelf_a;
  INSERT INTO public.shelf_books (shelf_id, book_id, position) VALUES (v_shelf_a, v_edition_a, 0);
  INSERT INTO public.user_settings (theme) VALUES ('dark-academia');

  -- 3. Sessão autenticada como Usuário B
  PERFORM set_config('request.jwt.claim.sub', v_user_b::text, TRUE);

  -- B não pode ler NENHUM registro de A
  SELECT COUNT(*) INTO v_count FROM public.works WHERE id = v_work_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS FALHOU: Usuário B leu works de A'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.editions WHERE id = v_edition_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS FALHOU: Usuário B leu editions de A'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.shelf_books WHERE book_id = v_edition_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS FALHOU: Usuário B leu shelf_books de A'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.user_settings WHERE user_id = v_user_a;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS FALHOU: Usuário B leu user_settings de A'; END IF;

  -- B não pode editar capa de A
  UPDATE public.editions SET cover_url = 'https://evil.example/hijack.webp' WHERE id = v_edition_a;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count <> 0 THEN RAISE EXCEPTION 'RLS FALHOU: Usuário B atualizou edição de A'; END IF;

  -- B não pode vincular livro de A em estante de B (FK composta `(book_id, user_id)`)
  INSERT INTO public.shelves (name, kind) VALUES ('Física B', 'physical') RETURNING id INTO v_shelf_b;
  BEGIN
    INSERT INTO public.shelf_books (shelf_id, book_id, position) VALUES (v_shelf_b, v_edition_a, 0);
  EXCEPTION WHEN foreign_key_violation OR insufficient_privilege THEN
    v_blocked := TRUE;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FK COMPOSTA FALHOU: Usuário B vinculou book_id de A em shelf_books de B';
  END IF;
END
$$;

ROLLBACK;
