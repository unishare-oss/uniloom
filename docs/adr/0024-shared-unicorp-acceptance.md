# ADR-0024: Shared Unicorp acceptance

Status: Proposed
Date: 2026-10-21

## Context

The user chose one shared acceptance step in UniAuth and automatic sign-in across
Unicorp apps. App-local consent does not establish acceptance for the other apps.

## Decision

UniAuth records deliberate acceptance of the policy bundle for Unishare, Uniloom
and Unigym. Its validated OIDC identity includes `urn:unicorp:terms` with a version
and original acceptance timestamp. Uniloom stores that evidence in separate,
server-controlled fields. Existing `consentGivenAt` remains historical app-only
evidence. Missing or old shared evidence requires a fresh UniAuth flow.

Project membership may be provisioned before the invitee visits or accepts terms.
It never creates a session, accepts terms or verifies an email on their behalf.

## Consequences

Users with existing app-only acceptance may see one central step. Deployment must
ship UniAuth's new acceptance/claims before apps depend on them. Each app keeps
its own host-only session; third-party OAuth approval remains separate.
