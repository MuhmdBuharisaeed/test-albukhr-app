-- Read-only post-apply verification for ALBUKHR Testnet.

-- 1. Verify the eight composite keys / foreign keys exist and are validated.
SELECT conname, contype, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conname IN (
  'users_id_pi_uid_network_key',
  'projects_id_code_network_key',
  'stakes_id_owner_project_network_key',
  'stakes_user_identity_fkey',
  'stakes_project_network_fkey',
  'withdrawal_requests_user_identity_fkey',
  'withdrawal_requests_project_network_fkey',
  'withdrawal_requests_stake_owner_project_fkey'
)
ORDER BY conname;

-- 2. Verify stake_id is NOT NULL on staker withdrawal requests.
SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'withdrawal_requests'
  AND column_name = 'stake_id';

-- 3. Verify the settlement function is hardened and remains server-only.
SELECT
  p.prosecdef AS security_definer,
  p.proconfig AS function_settings,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute,
  position('WITHDRAWAL_STAKE_OWNER_PROJECT_NETWORK_MISMATCH' in pg_get_functiondef(p.oid)) > 0 AS owner_project_check,
  position('WITHDRAWAL_USER_IDENTITY_MISMATCH' in pg_get_functiondef(p.oid)) > 0 AS user_identity_check
FROM pg_proc p
WHERE p.oid = 'public.complete_testnet_withdrawal_and_ledger(uuid,text)'::regprocedure;

-- 4. Check there are no current integrity mismatches.
SELECT
  (SELECT count(*) FROM public.stakes s
   LEFT JOIN public.users u ON u.id=s.user_id AND u.pi_uid=s.pi_uid AND u.network=s.network
   WHERE u.id IS NULL) AS stake_user_mismatches,
  (SELECT count(*) FROM public.stakes s
   LEFT JOIN public.projects p ON p.id=s.project_id AND p.project_code=s.project_code AND p.network=s.network
   WHERE p.id IS NULL) AS stake_project_mismatches,
  (SELECT count(*) FROM public.withdrawal_requests w
   LEFT JOIN public.users u ON u.id=w.user_id AND u.pi_uid=w.pi_uid AND u.network=w.network
   WHERE u.id IS NULL) AS withdrawal_user_mismatches,
  (SELECT count(*) FROM public.withdrawal_requests w
   LEFT JOIN public.stakes s ON s.id=w.stake_id AND s.pi_uid=w.pi_uid
    AND s.project_id=w.project_id AND s.project_code=w.project_code AND s.network=w.network
   WHERE s.id IS NULL) AS withdrawal_stake_mismatches;

-- 5. Confirm this hardening did not introduce or edit transaction records.
SELECT
  (SELECT count(*) FROM public.stakes) AS stakes_rows,
  (SELECT count(*) FROM public.withdrawal_requests) AS withdrawal_rows,
  (SELECT count(*) FROM public.testnet_stake_payments WHERE network='testnet') AS testnet_payment_rows,
  (SELECT count(*) FROM public.project_staking_ledger WHERE network='testnet') AS testnet_ledger_rows;


-- 6. Verify child-side indexes cover every new composite foreign key.
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'stakes_user_identity_idx',
    'stakes_project_network_idx',
    'withdrawal_requests_user_identity_idx',
    'withdrawal_requests_project_network_idx',
    'withdrawal_requests_stake_owner_project_idx'
  )
ORDER BY tablename, indexname;

-- 7. Confirm Testnet treasury remains active while staking policy remains paused.
SELECT network, active, staking_policy_active
FROM public.testnet_global_treasury_policy
WHERE singleton_id = 1;
