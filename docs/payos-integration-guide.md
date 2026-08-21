# payOS Integration & Webhook Guide for Matsuri

This guide covers connecting [payOS](https://payos.vn) to a Matsuri shop for 100% automated VietQR payment verification.

---

## Architecture Overview

```
[Customer]                [VietQR / Napas]             [payOS Gateway]          [Matsuri Supabase]
    │                            │                            │                         │
    │── 1. Scan VietQR ─────────>│                            │                         │
    │   (Contains AK-00000001)   │── 2. Bank Transfer ───────>│                         │
    │                            │      (Open Banking API)    │── 3. HTTPS Webhook ────>│ POST /payment-webhook
    │                                                         │      (HMAC-SHA256)      │ (verify signature)
    │                                                         │                         │ (confirm order in DB)
    │<── 4. Polling / Realtime Unlocks "Payment Complete" ──────────────────────────────│
```

---

## Prerequisites (For Shop Owners)

* A free account on [payOS.vn](https://payos.vn).
* A supported Vietnamese bank account (MB Bank, VietinBank, ACB, TPBank, BIDV, etc.).

---

## Step-by-Step Setup

### Step 1: Create a Payment Channel on payOS
1. Log in to [payOS Dashboard](https://payos.vn).
2. Go to **Kênh thanh toán (Payment Channels)** -> **Tạo kênh mới (Create Channel)**.
3. Select your bank and link your bank account via Open Banking / Napas.

### Step 2: Copy the Matsuri Webhook URL
1. In your Matsuri shop dashboard, open **Admin > Settings > Payment & QR**.
2. Turn on **Enable automated confirmation**.
3. Copy the generated **Webhook URL**:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/payment-webhook?shop=<your-shop-slug>
   ```

### Step 3: Register Webhook in payOS
1. In the payOS Dashboard, open your Payment Channel settings -> **Webhook**.
2. Paste the Matsuri Webhook URL into the **Webhook URL** field and save.
3. Click **Kiểm tra Webhook (Test Webhook)** in payOS to verify network connectivity.

### Step 4: Add Checksum Key into Matsuri
1. In the payOS Dashboard, find **Thông tin tích hợp (Integration Info)**:
   * Copy the **Checksum Key**.
2. In Matsuri **Admin > Settings > Payment & QR**:
   * Paste the **Checksum Key** into the **payOS Checksum Key** field.
   * *(Optional)* Paste `Client ID` and `API Key` if you wish to store them.
3. Click **Save payment settings**.

---

## Verification & Security Invariants

* **HMAC-SHA256 Signature:** Matsuri validates every incoming payOS request using your `payos_checksum_key`. Spoofed or tampered requests are rejected with HTTP 401.
* **Exact Amount Verification:** Matsuri verifies `received_amount >= order.total_amount`. Underpayments will log a transaction record but will NOT confirm the order.
* **Idempotency:** Bank transaction IDs are stored with a unique database constraint `(shop_id, provider, transaction_reference)`. Duplicate webhooks are safely ignored.
* **Order Code Matching:** The system extracts the order code (`AK-XXXXXXXX`) from the transfer description (`description` / `content`).
