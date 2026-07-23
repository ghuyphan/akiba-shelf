# ADR 0003: Durable order notifications

- Status: Accepted
- Date: 2026-07-23

## Context

Order creation is authoritative; push notification delivery is not. Browser
delivery made alert durability depend on the customer keeping a tab open and
allowed a provider failure to lose the alert even though the order was safely
stored. Notification work therefore needs its own durable lifecycle without
becoming part of payment or inventory correctness.

## Decision

Checkout enqueues one `order_notification_events` row per pending order inside
the authoritative database transaction. Enqueueing is idempotent by order ID;
checkout never waits for or calls a push provider.

A one-minute database schedule asks the `notify-new-order` Edge Function to
drain the queue through `pg_net`. The endpoint and shared worker credential live
in Supabase Vault, while the matching credential is an Edge Function secret.
The asynchronous request ID is not proof of HTTP success, so operations monitor
both `net._http_response` and queue age.

Workers claim due jobs with row locking and a two-minute lease. Concurrent
workers skip locked rows, stale leases are reclaimable, and a lease token stops
late workers from completing a superseded attempt. Delivery retries only the
endpoints that had a transient failure. Backoff starts at 15 seconds, doubles
per attempt, is capped at one hour, and defaults to six attempts.

The durable states are `queued`, `sending`, `retryable_failed`, `delivered`,
`skipped`, and `dead_letter`. A non-pending order or an order with no valid push
subscriptions is truthfully `skipped`, not delivered. Exhausted attempts enter
the dead letter state. Each completed attempt records its outcome, bounded error
code, failed endpoint count, timestamps, and lease token.

Shop members can inspect recent status plus due count, retryable-failure count,
dead-letter count, and oldest-due time. Owners and admins can replay a skipped
or dead-lettered notification only while its order is still pending; the action
and optional reason are audited. Terminal events and attempt history move to a
30-day archive in bounded batches.

## Consequences

- Checkout success does not depend on push provider availability.
- Closing the customer browser cannot cancel queued notification work.
- Delivery is at-least-once at the job level. Provider behavior prevents a
  strict exactly-once guarantee, so staff screens and notifications must tolerate
  duplicates.
- No malformed or expired subscription blocks delivery to other subscribers;
  invalid rows are removed and transient endpoint failures are isolated.
- Dead letters and skipped jobs remain visible and replay is authorized,
  bounded, and auditable.
- The live order queue remains the operational source of truth when push is
  delayed or unavailable.
- Vault configuration, the cron schedule, `pg_net` responses, oldest-due age,
  and dead letters are production dependencies that require monitoring.
