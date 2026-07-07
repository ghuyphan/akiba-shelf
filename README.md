# Akiba Shelf

Touch-friendly React catalog for festival merch booths, backed by Supabase for catalog data, admin auth, image uploads, and Realtime updates.

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Supabase Tables

Run the SQL in `supabase/migrations/20260707000000_merch_catalog_setup.sql` in your Supabase project. It creates these tables with explicit Data API grants, RLS policies, Realtime publication entries, and public storage buckets for uploaded images:

- `products`
- `booth_settings`
- `payment_settings`

The app subscribes to Supabase Realtime for all three tables, so catalog/admin screens refresh when another device updates products, booth info, or QR settings.

Configure the frontend with:

```bash
VITE_SUPABASE_URL=https://kicvenppgjvzqpyagdih.supabase.co
VITE_SUPABASE_ANON_KEY=your-publishable-or-anon-key
```

Then create at least one Supabase Auth user for the admin screen. Anonymous users can read active catalog items and settings; authenticated users can manage products, settings, and upload to the `product-images` and `payment-qr` buckets.
