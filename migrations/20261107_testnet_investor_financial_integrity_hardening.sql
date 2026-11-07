-- ALBUKHR TESTNET — INVESTOR FINANCIAL INTEGRITY HARDENING v1
-- Applied to Testnet Supabase on 2026-11-07 after preflight and rollback rehearsal.
-- This file is the audit/migration record. Do not re-run on the already patched DB.
-- Adds database-level ownership/project/network bindings and hardens settlement.

BEGIN;

DO $preflight$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.stakes s
    LEFT JOIN public.users u
      ON u.id = s.user_id AND u.pi_uid = s.pi_uid AND u.network = s.network
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: STAKE_USER_IDENTITY_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.stakes s
    LEFT JOIN public.projects p
      ON p.id = s.project_id
     AND p.project_code = s.project_code
     AND p.network = s.network
    WHERE p.id IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: STAKE_PROJECT_NETWORK_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.withdrawal_requests w
    LEFT JOIN public.users u
      ON u.id = w.user_id AND u.pi_uid = w.pi_uid AND u.network = w.network
    WHERE u.id IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: WITHDRAWAL_USER_IDENTITY_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.withdrawal_requests w
    LEFT JOIN public.stakes s
      ON s.id = w.stake_id
     AND s.pi_uid = w.pi_uid
     AND s.project_id = w.project_id
     AND s.project_code = w.project_code
     AND s.network = w.network
    WHERE s.id IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: WITHDRAWAL_STAKE_OWNER_PROJECT_MISMATCH';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.withdrawal_requests WHERE stake_id IS NULL
  ) THEN
    RAISE EXCEPTION 'PREFLIGHT_FAILED: NULL_WITHDRAWAL_STAKE_ID';
  END IF;
END;
$preflight$;

-- Candidate keys required by the composite foreign keys.
ALTER TABLE public.users
  ADD CONSTRAINT users_id_pi_uid_network_key
  UNIQUE (id, pi_uid, network);

ALTER TABLE public.projects
  ADD CONSTRAINT projects_id_code_network_key
  UNIQUE (id, project_code, network);

ALTER TABLE public.stakes
  ADD CONSTRAINT stakes_id_owner_project_network_key
  UNIQUE (id, pi_uid, project_id, project_code, network);

-- A stake must belong to the same user identity and network recorded on the stake.
ALTER TABLE public.stakes
  ADD CONSTRAINT stakes_user_identity_fkey
  FOREIGN KEY (user_id, pi_uid, network)
  REFERENCES public.users (id, pi_uid, network)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- A project ID/code pair must resolve to one project on the same network.
ALTER TABLE public.stakes
  ADD CONSTRAINT stakes_project_network_fkey
  FOREIGN KEY (project_id, project_code, network)
  REFERENCES public.projects (id, project_code, network)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- A staker withdrawal must always reference a stake.
ALTER TABLE public.withdrawal_requests
  ALTER COLUMN stake_id SET NOT NULL;

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_user_identity_fkey
  FOREIGN KEY (user_id, pi_uid, network)
  REFERENCES public.users (id, pi_uid, network)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_project_network_fkey
  FOREIGN KEY (project_id, project_code, network)
  REFERENCES public.projects (id, project_code, network)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Core invariant: a withdrawal's stake, owner, project and network must all match.
ALTER TABLE public.withdrawal_requests
  ADD CONSTRAINT withdrawal_requests_stake_owner_project_fkey
  FOREIGN KEY (stake_id, pi_uid, project_id, project_code, network)
  REFERENCES public.stakes (id, pi_uid, project_id, project_code, network)
  ON UPDATE RESTRICT ON DELETE RESTRICT;

-- Child-side indexes keep the new composite FK checks efficient as rows grow.
CREATE INDEX stakes_user_identity_idx
  ON public.stakes (user_id, pi_uid, network);
CREATE INDEX stakes_project_network_idx
  ON public.stakes (project_id, project_code, network);
CREATE INDEX withdrawal_requests_user_identity_idx
  ON public.withdrawal_requests (user_id, pi_uid, network);
CREATE INDEX withdrawal_requests_project_network_idx
  ON public.withdrawal_requests (project_id, project_code, network);
CREATE INDEX withdrawal_requests_stake_owner_project_idx
  ON public.withdrawal_requests (stake_id, pi_uid, project_id, project_code, network);

-- Defensive settlement check remains even with database constraints.
-- Empty search_path prevents object shadowing; public objects are schema-qualified.
CREATE OR REPLACE FUNCTION public.complete_testnet_withdrawal_and_ledger(
  p_request_id uuid,
  p_txid text
)
RETURNS public.withdrawal_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_row public.withdrawal_requests%ROWTYPE;
  v_stake public.stakes%ROWTYPE;
  v_txid text := nullif(trim(coalesce(p_txid, '')), '');
  v_gross numeric;
  v_capital_balance numeric;
  v_operating_balance numeric;
  v_from_capital numeric;
  v_from_operating numeric;
  v_reward_balance numeric;
BEGIN
  IF p_request_id IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'WITHDRAWAL_ID_REQUIRED';
  END IF;
  IF v_txid IS NULL THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'WITHDRAWAL_TXID_REQUIRED';
  END IF;

  SELECT * INTO v_row
  FROM public.withdrawal_requests
  WHERE id = p_request_id AND network = 'testnet'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'WITHDRAWAL_NOT_FOUND';
  END IF;

  IF v_row.status NOT IN ('completed', 'approved', 'processing') THEN
    RAISE EXCEPTION USING errcode = '22023', message = 'WITHDRAWAL_NOT_READY_FOR_COMPLETION';
  END IF;

  SELECT * INTO v_stake
  FROM public.stakes
  WHERE id = v_row.stake_id AND network = 'testnet'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING errcode = 'P0002', message = 'WITHDRAWAL_STAKE_NOT_FOUND';
  END IF;

  IF v_row.pi_uid IS DISTINCT FROM v_stake.pi_uid
     OR v_row.project_id IS DISTINCT FROM v_stake.project_id
     OR v_row.project_code IS DISTINCT FROM v_stake.project_code
     OR v_row.network IS DISTINCT FROM v_stake.network THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'WITHDRAWAL_STAKE_OWNER_PROJECT_NETWORK_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = v_row.user_id
      AND u.pi_uid = v_row.pi_uid
      AND u.network = 'testnet'
  ) THEN
    RAISE EXCEPTION USING errcode = '42501',
      message = 'WITHDRAWAL_USER_IDENTITY_MISMATCH';
  END IF;

  PERFORM public.assert_testnet_outflow_fee_ready('staker_withdrawal', p_request_id);
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'albukhr:testnet:project-withdraw:' || v_stake.project_id::text, 0
    )
  );

  v_gross := round(v_row.requested_amount, 7);

  IF v_row.status = 'completed' THEN
    IF EXISTS (
      SELECT 1 FROM public.project_staking_ledger
      WHERE idempotency_key IN (
        'withdrawal:' || v_row.id::text || ':settlement',
        'withdrawal:' || v_row.id::text || ':capital-reserve-settlement',
        'withdrawal:' || v_row.id::text || ':project-operating-settlement'
      )
    ) THEN
      UPDATE public.testnet_outflow_fee_assessments
      SET payout_txid = coalesce(payout_txid, v_txid), updated_at = now()
      WHERE source_type = 'staker_withdrawal'
        AND source_id = p_request_id
        AND network = 'testnet';
      RETURN v_row;
    END IF;
  END IF;

  IF v_row.withdrawal_type = 'reward' THEN
    SELECT coalesce(sum(CASE WHEN l.movement = 'credit' THEN l.amount ELSE -l.amount END), 0)
      INTO v_reward_balance
    FROM public.project_staking_ledger l
    WHERE l.project_id = v_stake.project_id
      AND l.network = 'testnet'
      AND l.bucket = 'reward_reserve';

    IF v_reward_balance < v_gross THEN
      RAISE EXCEPTION USING errcode = '22003',
        message = 'PROJECT_REWARD_RESERVE_INSUFFICIENT_AT_SETTLEMENT';
    END IF;

    INSERT INTO public.project_staking_ledger (
      network, project_id, stake_id, withdrawal_request_id, bucket, movement,
      event_type, amount, source_type, source_id, idempotency_key, metadata
    ) VALUES (
      'testnet', v_stake.project_id, v_stake.id, v_row.id, 'reward_reserve', 'debit',
      'reward_paid', v_gross, 'withdrawal', v_row.id::text,
      'withdrawal:' || v_row.id::text || ':settlement',
      jsonb_build_object(
        'txid', v_txid,
        'requested_amount', v_row.requested_amount,
        'fee_amount', 0,
        'gross_deduction', v_gross,
        'network', 'testnet'
      )
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  ELSE
    SELECT
      coalesce(sum(CASE WHEN l.movement = 'credit' THEN l.amount ELSE -l.amount END)
        FILTER (WHERE l.bucket = 'capital_reserve'), 0),
      coalesce(sum(CASE WHEN l.movement = 'credit' THEN l.amount ELSE -l.amount END)
        FILTER (WHERE l.bucket = 'project_operating'), 0)
    INTO v_capital_balance, v_operating_balance
    FROM public.project_staking_ledger l
    WHERE l.project_id = v_stake.project_id AND l.network = 'testnet';

    IF coalesce(v_capital_balance, 0) + coalesce(v_operating_balance, 0) < v_gross THEN
      RAISE EXCEPTION USING errcode = '22003',
        message = 'PROJECT_CAPITAL_RESERVE_INSUFFICIENT_AT_SETTLEMENT';
    END IF;

    v_from_capital := least(greatest(coalesce(v_capital_balance, 0), 0), v_gross);
    v_from_operating := v_gross - v_from_capital;

    IF v_from_capital > 0 THEN
      INSERT INTO public.project_staking_ledger (
        network, project_id, stake_id, withdrawal_request_id, bucket, movement,
        event_type, amount, source_type, source_id, idempotency_key, metadata
      ) VALUES (
        'testnet', v_stake.project_id, v_stake.id, v_row.id, 'capital_reserve', 'debit',
        'capital_returned', v_from_capital, 'withdrawal', v_row.id::text,
        'withdrawal:' || v_row.id::text || ':capital-reserve-settlement',
        jsonb_build_object('txid', v_txid, 'network', 'testnet')
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;

    IF v_from_operating > 0 THEN
      INSERT INTO public.project_staking_ledger (
        network, project_id, stake_id, withdrawal_request_id, bucket, movement,
        event_type, amount, source_type, source_id, idempotency_key, metadata
      ) VALUES (
        'testnet', v_stake.project_id, v_stake.id, v_row.id, 'project_operating', 'debit',
        'capital_returned', v_from_operating, 'withdrawal', v_row.id::text,
        'withdrawal:' || v_row.id::text || ':project-operating-settlement',
        jsonb_build_object('txid', v_txid, 'network', 'testnet')
      ) ON CONFLICT (idempotency_key) DO NOTHING;
    END IF;
  END IF;

  UPDATE public.withdrawal_requests
  SET status = 'completed',
      fee_rate = 0,
      fee_amount = 0,
      net_amount = requested_amount,
      txid = v_txid,
      reviewed_at = coalesce(reviewed_at, now()),
      updated_at = now()
  WHERE id = p_request_id AND network = 'testnet'
  RETURNING * INTO v_row;

  UPDATE public.testnet_outflow_fee_assessments
  SET payout_txid = v_txid, updated_at = now()
  WHERE source_type = 'staker_withdrawal'
    AND source_id = p_request_id
    AND network = 'testnet';

  RETURN v_row;
END;
$function$;

COMMIT;
