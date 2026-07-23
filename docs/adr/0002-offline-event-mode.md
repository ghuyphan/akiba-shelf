# ADR 0002: Allocated offline event mode

- Status: Accepted
- Date: 2026-07-23

## Context

Normal offline browsing cannot safely invent orders or stock reservations.
Event venues can nevertheless lose connectivity while staff must continue
selling from a known stock pool.

## Decision

Offline Event Mode is the only offline-sale exception. While online, the server
allocates stock to one designated staff device. That device records local sales
against the allocation, syncs them idempotently, and leaves payment verification
to staff. Closing the event returns only unsold allocation.

## Consequences

- An allocation is never cloned across independent devices.
- Local event identifiers and sync operations remain idempotent.
- Normal offline mode may persist carts and checkout identity but cannot create
  an order, payment, or reservation.
- Recovery prioritizes the local ledger and server reconciliation over manual
  database edits.
