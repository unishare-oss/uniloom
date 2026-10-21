# Shared account implementation report

Ready for review, 2026-10-21. See plan 57 and Proposed ADR-0024.

## Architecture and trade-offs

The user chose shared identity and one central acceptance, and deferred Unigym.
I reused existing OIDC, lazy issuer/subject provisioning and host-only sessions.
This avoids account fan-out and shared cookies, but every consumer must verify and
store central evidence. Existing app consent is history; returning users may need
one central acceptance. Third-party OAuth permissions and app roles stay separate.
No new dependency or environment variable; additive migrations introduce central
user/version acceptance history and two nullable fields in each consumer User.

## Built, by priority

P0 (required to use the feature):

| Boundary                                                 | Access and behaviour                                                         | Main errors                                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| UniAuth GET `/api/account/terms`                         | Signed-in non-guest reads current policy and own evidence                    | 401 unauthorized, 503 policy_unavailable                                                      |
| UniAuth POST `/api/account/terms`                        | Same identity, public Origin, current version; idempotent server timestamp   | 400 invalid_body, 401 unauthorized, 403 forbidden, 409 policy_changed, 503 policy_unavailable |
| UniAuth OAuth authorize/continue                         | Existing provider routes now require central acceptance before code issuance | Existing provider errors; prompt=none returns interaction_required                            |
| Uniloom GET `/api/me`                                    | Session-only; adds shared version and original timestamp                     | 401                                                                                           |
| Uniloom POST `/api/users/me/consent`                     | Session-only compatibility confirmation, no local acceptance write           | 401, 403 consent_required                                                                     |
| Unishare GET `/api/users/me`, GET `/api/users/me/export` | Existing self-account access; evidence included in session/export            | Existing authentication errors                                                                |
| Unishare POST `/api/users/me/consent`                    | Existing session; confirms shared evidence                                   | 401, 403 consent_required                                                                     |
| Existing protected REST/MCP routes                       | Current shared acceptance plus existing auth, scopes and roles               | 401, 403 consent_required; existing privacy-safe 404s                                         |

UniAuth `/unicorp-terms` links both apps' policies and records explicit acceptance;
signup/account/university paths reach it without losing their destination.
Uniloom and Unishare consent screens refresh through UniAuth with bounded retries;
auth-return handles interaction_required. Sidebar queries use shared evidence.
Keep central rollout first, followed by consumer migrations/API/web.

P1 (account recovery): UniAuth `/account` explains unverified email and links to
existing ownership proof when email login is available; `/login?verify_email=1`
lets an already signed-in user reach that flow. No email or real account change
was triggered. Verification still governs directory eligibility.

P2 (safety net): strict-input/signature/guard/old-consent tests, provisioning races,
seed scenarios and generated contracts. The next step is staging deployment and
a disposable end-to-end Unishare-to-Uniloom browser test.

## Proof and status

The five plan criteria are mapped to evidence in plan 57. Uniloom: 147 unit tests,
55 targeted app/directory/identity integration cases across relevant runs, and
8 focused MCP cases passed. API/web typecheck and lint and API build passed.
UniAuth: 3 DB integration tests, 4 web tests, workspace typecheck and 2 real-browser
checks passed. Unishare: 15 API auth/guard/signature and 3 frontend gate tests,
API build/build typecheck, web typecheck and focused lint passed.

A dropped SSH test tunnel caused one infrastructure failure; restored tunnel and
MCP rerun passed. Publication was subsequently authorized by the user on 2026-10-21. Full live cross-app browser
journey is untested; boundaries were exercised separately. No independent reviewer
ran (implementation was not delegated). No reviewer verdict or findings claimed.

## Try after staging rollout

1. Register a disposable account through Unishare and prove email ownership.
2. Accept the central two-app policy once and enter Unishare.
3. From an authorized disposable Uniloom project, add that exact email before its
   first Uniloom visit; confirm one linked user and membership.
4. Open Uniloom in the same browser and confirm the project opens without another
   acceptance prompt. Repeat with an old app-only consent record to see the central
   step once instead.
5. Confirm a missing/forged central claim cannot unlock REST or MCP access.

## Risky spots and plan changes

Inspect `apps/api/src/auth/auth.ts`, `auth/middleware.ts`,
`modules/mcp/mcp.auth.ts`, `modules/uniauth/uniauth.service.ts`, and the additive
Prisma migration. Consumer evidence must come from validated issuer/subject-bound
claims; provisioning must not create evidence or browser sessions.

Small implementation changes: explicit trusted persistence because Better Auth
filters read-only fields; shared gates in MCP/sidebar; deterministic one-insert,
one-winner-read test replacing a wall-clock assertion. The user explicitly changed
scope to defer Unigym. Rules bent: no additional exceptions or tech debt introduced.
The user's direct implementation authorization supplied the scope approval.
