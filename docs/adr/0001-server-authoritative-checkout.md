# ADR 0001: Server-authoritative checkout

- Status: Accepted
- Date: 2026-07-23

## Context

Prices, promotions, stock, membership, and payment state can change while a
customer browses. Browser state is useful for presentation and recovery but
cannot safely reserve inventory or determine the payable total.

## Decision

All checkout creation goes through the `create-order` Edge Function and the
existing transactional order RPC. The server validates the cart, locks product
rows in stable order, reads current commercial rules, reserves stock, and
creates the pending order atomically. The browser supplies idempotency and
recovery identifiers and treats uncertain network outcomes as recoverable, not
as proof that no order exists.

## Consequences

- Anonymous direct inserts into order tables are forbidden.
- Pending creation reserves stock; confirmation finalizes that reservation.
- Cancellation and expiry restore inventory exactly once.
- Client totals and offline carts are advisory only.
- Production probes use CORS `OPTIONS`; they never submit a checkout payload.
