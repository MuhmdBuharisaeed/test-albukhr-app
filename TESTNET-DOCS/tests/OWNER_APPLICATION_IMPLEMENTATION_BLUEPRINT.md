Test Matrix — Testnet Owner Application
ID
Scenario
Expected
OA-001
Core project opens detail page
No application CTA
OA-002
Core project submits crafted application request
Denied at Edge Function and SQL
OA-003
External project with canonical Mainnet Owner
Eligible after proof verification
OA-004
Internal project with canonical Mainnet Owner
Eligible after proof verification
OA-005
Internal/External project without canonical Owner
Denied
OA-006
Applicant is not the Mainnet canonical Owner
Denied
OA-007
Proof is expired/tampered/wrong audience/wrong purpose
Denied
OA-008
Proof nonce replay
Denied
OA-009
Mirror has no durable Mainnet provenance
Denied
OA-010
Duplicate open application
Denied
OA-011
Applicant reads another Owner's application
Denied
OA-012
Non-admin attempts review
Denied
OA-013
Admin requests changes
State/history updated atomically
OA-014
Owner resubmits requested changes
New history row; prior submission preserved
OA-015
Admin approves
Testnet projects.owner_user_id and Owner profile created atomically
OA-016
Admin attempts approval of Core
Denied in SQL
OA-017
Testnet application attempts Mainnet write
No Mainnet mutation path exists
OA-018
RAHEEM-25 current Owner binding
Unchanged
OA-019
Existing Owner balance/ledger
Same results as baseline
OA-020
Existing Owner withdrawal create/approve/complete
Same behavior and ACLs
OA-021
Horizon payout verification
Same behavior
OA-022
Public Testnet registry response
No Mainnet owner UUID/proof/application fields
OA-023
Existing Core Admin page
No changes
OA-024
Dock Navigation
No changes
