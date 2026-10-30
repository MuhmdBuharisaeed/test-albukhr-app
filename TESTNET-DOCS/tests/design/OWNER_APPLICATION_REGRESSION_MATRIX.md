ALBUKHR Testnet Owner Application — Phase 2 Implementation Blueprint
Status: Read-only design artifact. Not deployed. No database, Edge Function, GitHub, or Render changes were made.
1. Approved scope
The new self-application workflow applies only to Testnet mirrors of Mainnet projects where:
project_type IN ('internal','external');
Mainnet source project is approved or active;
Mainnet projects.owner_albukhr_user_id resolves to a Mainnet public.users.id;
Mainnet proof binds the canonical owner, exact source project, project code/type, network, issue time, expiry, and a unique nonce;
Testnet mirror has independently verified provenance from Mainnet.
Core projects are excluded unconditionally from applicant UI, application RPCs, Edge Function routes, Admin queue, and approval RPCs. Do not use core_slot IS NULL as the sole exclusion check; require project_type IN ('internal','external').
2. Preserve existing systems
Do not modify or repurpose:
public.project_owner_profiles;
public.project_owner_history;
private.manage_testnet_project_ownership / its public wrapper;
testnet_identity_link_requests;
legacy project-owner.html and its API contract;
owner ledger, owner balance, withdrawal creation/approval/completion, Horizon payout verification;
seven-project Core Admin workflow;
Dock Navigation.
RAHEEM-25 remains on the legacy Owner binding and must pass regression checks.
3. Proposed new data model
public.testnet_project_owner_applications
One row per application lifecycle, with append-only history:
id uuid primary key
project_id uuid not null references public.projects(id)
network text not null default 'testnet' check (network='testnet')
applicant_testnet_user_id uuid not null references public.users(id)
mainnet_source_project_code text not null
mainnet_source_project_type text not null check (mainnet_source_project_type in ('internal','external'))
mainnet_owner_proof_id text not null (opaque proof reference; never Mainnet user UUID)
status text not null check (status in ('submitted','changes_requested','resubmitted','approved','rejected','withdrawn'))
owner_submission jsonb not null (only applicant-entered business/team/contact fields)
submitted_at timestamptz not null default now()
reviewed_by uuid null references public.users(id)
reviewed_at timestamptz null
review_note text null
approved_testnet_user_id uuid null references public.users(id)
created_at/updated_at timestamptz
Indexes/uniqueness:
partial unique index to prevent more than one open application per project;
index (network,status,submitted_at desc);
index (project_id,network,created_at desc). Do not store the canonical Mainnet owner UUID in this Testnet table.
public.testnet_project_owner_application_history
Append-only state-transition audit:
id uuid primary key
application_id uuid not null references ...
project_id uuid not null references public.projects(id)
network text not null check (network='testnet')
actor_testnet_user_id uuid null references public.users(id)
actor_role text not null check (actor_role in ('owner','admin','system'))
action text not null check (action in ('submitted','changes_requested','resubmitted','approved','rejected','withdrawn'))
from_status text null
to_status text not null
note text null
metadata jsonb not null default '{}'
created_at timestamptz not null default now()
RLS and grants:
RLS enabled and forced where compatible with the existing service-role model.
Revoke direct INSERT/UPDATE/DELETE from anon and authenticated.
Only narrowly scoped Edge Functions/service-role RPCs may mutate application rows.
Owner reads only their own applications through a server-verified Testnet session.
Admin queue reads only through the existing authenticated Testnet Admin gateway and role check.
Public project registry must never return application rows, applicant identity, Mainnet Owner IDs, or proof contents.
4. Mainnet proof contract
The Mainnet issuer must validate the live Pi identity token with Pi API, resolve public.users by the verified pi_uid and network='mainnet', then verify the exact project row has owner_albukhr_user_id = users.id, project_type IN ('internal','external'), and approved/active status.
Signed short-lived assertion claims:
iss='albukhr-mainnet'
aud='albukhr-testnet-owner-application'
network='testnet'
source_network='mainnet'
project_code
project_type
opaque proof_id
pi_uid (verified identity binding)
iat, short exp (<= 120 seconds), unique nonce
purpose='project_owner_application'
Never place Mainnet users.id or owner_albukhr_user_id in browser-visible responses or public registry output. Testnet gateway must verify signature, issuer, audience, purpose, expiry, nonce replay, and exact mirrored source project provenance. A normal login assertion is not an Owner proof.
5. Testnet mirror provenance requirement
Current apply_mainnet_approved_project_mirror(jsonb) mirror payload is keyed by project code and does not persist a durable Mainnet source UUID or canonical Owner proof. registration_source='mainnet-approved-mirror' alone is insufficient.
Before enabling applications, introduce a private server-only provenance record or equivalent protected columns containing:
Mainnet source project UUID (server-only);
source project code/type;
source owner_albukhr_user_id proof binding as a non-reversible/opaque proof reference, not a public field;
last verified source state and timestamp;
signed mirror batch/reference.
Public registry projections must explicitly omit all provenance and owner identity fields.
6. RPC lifecycle
submit_testnet_project_owner_application(...)
derive applicant from verified Testnet session on server; ignore applicant IDs supplied by browser;
resolve the project by Testnet project ID/code and network='testnet';
reject unless type is exactly internal or external;
require approved mirror and valid one-time Mainnet project-owner proof;
reject if the project already has a different active Owner binding;
insert application and submitted history atomically.
review_testnet_project_owner_application(...)
callable only by Testnet Admin gateway after super-admin/authorized-role validation;
changes_requested, approved, or rejected only;
require reason/note and lock application/project rows;
reject all Core projects again inside SQL;
on approval, bind only the applicant's Testnet users.id to projects.owner_user_id and create the legacy Owner profile only after the canonical Mainnet proof and mirror provenance revalidate;
write history in the same transaction;
never mutate Mainnet.
resubmit_testnet_project_owner_application(...)
applicant may resubmit only own changes_requested application;
preserve prior submission and history; update only applicant-provided fields.
Do not make the existing owner-management RPC available to application users.
7. Frontend/Admin contract
Project detail:
new button appears only after server eligibility response;
Core never receives the button;
application form belongs to project detail and sends only applicant-entered data plus opaque proof;
applicant cannot set project ID, user ID, Mainnet owner ID, status, or approval fields;
old Owner portal link remains separate and visible only to already bound owners.
Admin:
separate page/module/Edge Function route for application queue;
collapsed cards by default; details open only after admin click;
display owner-submitted information read-only;
Admin can request changes, approve, or reject with reason;
Admin must not enter or edit Owner identity information;
existing project-owner-admin.html and Core workflow remain unchanged.
8. Required regression gates before deployment
Core project application denied at UI, Edge Function, RPC, and Admin queue.
External/internal without canonical Mainnet Owner denied.
Project owner A cannot apply to project B.
Mainnet user UUID never appears in Testnet browser response/public registry.
Expired, wrong-audience, wrong-purpose, replayed, or tampered proof denied.
Unverified mirror provenance denied.
Cross-network user/project mismatch denied.
Duplicate open application denied.
Owner can read only own application.
Admin can read/review only with valid Testnet Admin session and role.
RAHEEM-25 legacy Owner binding unchanged.
Existing Owner balance, ledger, withdrawal, fee assessment, completion, and Horizon verification unchanged.
Mainnet DB has zero writes from Testnet application/approval.
Testnet registry remains public-safe and contains no Owner identity.
9. Current verified blockers
Testnet has no new application/history tables.
Current Mainnet testnet-auth-issuer assertion carries Pi UID/username but no project-specific Owner proof.
Current Testnet registry mirror does not persist durable Mainnet project UUID / canonical Owner provenance.
Current project detail Owner bridge reveals only already-bound owners; it cannot initiate a new application.
Existing legacy Admin ownership page is labelled for Core but its backend list/assignment path does not itself enforce project_type='core'. Keep it unchanged for this new workflow; the new workflow must use separate endpoints and enforce Core exclusion at every layer.
Existing Testnet Owner financial functions rely on projects.owner_user_id; the new approval must create the correct Testnet binding atomically without changing financial functions.
10. Deployment status
This blueprint is not a migration and has not been applied. No source file or deployed service was changed. A complete 51-migration SQL body archive and all deployed Edge Function source files remain a separate recovery requirement; the prior v4 inventory ZIP is not a full source backup.
