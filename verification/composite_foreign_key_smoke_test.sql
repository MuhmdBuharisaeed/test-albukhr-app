-- Isolated positive/negative test for the composite ownership/project/network FK pattern.
-- Uses TEMP tables only. The transaction is rolled back; no public rows are changed.
BEGIN;

CREATE TEMP TABLE ci_users (
  id uuid primary key, pi_uid text not null, network text not null,
  unique(id,pi_uid,network)
) ON COMMIT DROP;

CREATE TEMP TABLE ci_projects (
  id uuid primary key, project_code text not null, network text not null,
  unique(id,project_code,network)
) ON COMMIT DROP;

CREATE TEMP TABLE ci_stakes (
  id uuid primary key, pi_uid text not null, project_id uuid not null,
  project_code text not null, network text not null,
  unique(id,pi_uid,project_id,project_code,network),
  foreign key(project_id,project_code,network)
    references ci_projects(id,project_code,network)
) ON COMMIT DROP;

CREATE TEMP TABLE ci_withdrawals (
  id uuid primary key, stake_id uuid not null, user_id uuid not null,
  pi_uid text not null, project_id uuid not null,
  project_code text not null, network text not null,
  foreign key(user_id,pi_uid,network)
    references ci_users(id,pi_uid,network),
  foreign key(project_id,project_code,network)
    references ci_projects(id,project_code,network),
  foreign key(stake_id,pi_uid,project_id,project_code,network)
    references ci_stakes(id,pi_uid,project_id,project_code,network)
) ON COMMIT DROP;

CREATE TEMP TABLE ci_results(test_name text primary key, passed boolean not null);

INSERT INTO ci_users VALUES
('00000000-0000-0000-0000-000000000001','pi-user-a','testnet'),
('00000000-0000-0000-0000-000000000002','pi-user-b','testnet');
INSERT INTO ci_projects VALUES
('10000000-0000-0000-0000-000000000001','PROJECT-A','testnet'),
('10000000-0000-0000-0000-000000000002','PROJECT-B','testnet');
INSERT INTO ci_stakes VALUES
('20000000-0000-0000-0000-000000000001','pi-user-a',
 '10000000-0000-0000-0000-000000000001','PROJECT-A','testnet');

-- Positive: matching identity/stake/project/network is accepted.
INSERT INTO ci_withdrawals VALUES (
 '30000000-0000-0000-0000-000000000001',
 '20000000-0000-0000-0000-000000000001',
 '00000000-0000-0000-0000-000000000001','pi-user-a',
 '10000000-0000-0000-0000-000000000001','PROJECT-A','testnet'
);
INSERT INTO ci_results VALUES ('MATCHING_WITHDRAWAL_ACCEPTED', true);

-- Negative: another user's identity cannot be attached to a foreign stake.
DO $test$
BEGIN
  BEGIN
    INSERT INTO ci_withdrawals VALUES (
      '30000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000002','pi-user-b',
      '10000000-0000-0000-0000-000000000001','PROJECT-A','testnet'
    );
    RAISE EXCEPTION 'TEST_FAILED: OWNER_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO ci_results VALUES ('OWNER_MISMATCH_REJECTED', true);
  END;
END;
$test$;

-- Negative: project B cannot be attached to a stake belonging to project A.
DO $test$
BEGIN
  BEGIN
    INSERT INTO ci_withdrawals VALUES (
      '30000000-0000-0000-0000-000000000003',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001','pi-user-a',
      '10000000-0000-0000-0000-000000000002','PROJECT-B','testnet'
    );
    RAISE EXCEPTION 'TEST_FAILED: PROJECT_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO ci_results VALUES ('PROJECT_MISMATCH_REJECTED', true);
  END;
END;
$test$;

-- Negative: a Mainnet network label cannot be mixed with a Testnet stake.
DO $test$
BEGIN
  BEGIN
    INSERT INTO ci_withdrawals VALUES (
      '30000000-0000-0000-0000-000000000004',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001','pi-user-a',
      '10000000-0000-0000-0000-000000000001','PROJECT-A','mainnet'
    );
    RAISE EXCEPTION 'TEST_FAILED: NETWORK_MISMATCH_WAS_ACCEPTED';
  EXCEPTION WHEN foreign_key_violation THEN
    INSERT INTO ci_results VALUES ('NETWORK_MISMATCH_REJECTED', true);
  END;
END;
$test$;

SELECT * FROM ci_results ORDER BY test_name;
ROLLBACK;
