# Grocery Tracker

Upload photos of grocery receipts and have every item read out automatically, then see where your money goes by store, category and item over time.

## Features

- **Upload one receipt or a whole stack.** The dashboard takes a single photo; **Import** (`/receipts/import`) takes as many as you like and works through them three at a time, with a status for each one, retry for failures, and a summary at the end.
- **Long receipts in several photos.** Tick the photos and choose **Combine** to turn them into one receipt, before or after importing. Pieces that look like parts of one receipt (one has no total, the next has no store) are suggested automatically.
- **Photos are prepared in the browser.** They're resized to 2048px, turned upright, and stripped of metadata such as GPS location before upload.
- **Accurate parsing with a built-in check.** Receipts are read by OpenAI's `gpt-6-luna` using structured outputs. If the items don't add up to the printed subtotal or total (allowing for tax and whole-order rewards like Shop&Earn), the receipt is re-read by `gpt-6-sol`, and anything that still doesn't add up is flagged with a "check prices" warning.
- **Duplicate detection.** A new receipt with the same store and total as an existing one is flagged as a possible duplicate.
- **Edit anything.** Receipt details and items can be edited, added or deleted, with brand, generic name and variant suggestions from your past purchases.
- **Analytics.** Spending by store, category and over time, most-bought items grouped by brand or generic name, per-store pages and cross-store price comparisons.
- **Admin pages.** Admins can set store logos and colors and see every parse's token usage and cost.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) and React 19, styled with Tailwind CSS 4
- [Supabase](https://supabase.com) for auth (Google sign-in), Postgres and photo storage
- [OpenAI](https://platform.openai.com) for reading receipts
- [Recharts](https://recharts.org) for charts

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

   | Variable | Where to find it |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API (the anon or publishable key) |
   | `OPENAI_API_KEY` | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |

3. Start the dev server and open [http://localhost:3000](http://localhost:3000):

   ```bash
   npm run dev
   ```

Other scripts: `npm run build` (production build, includes the type check) and `npm run lint`.

## Database

The schema lives in `supabase/migrations/`. `20251030000000_baseline.sql` is the original schema, which was built in the Supabase dashboard; every later file is a change on top of it.

- **New project:** `supabase db push` (or `supabase db reset` locally) creates everything from scratch.
- **Changing the schema:** add a new migration file rather than editing the dashboard directly, so the repo stays the source of truth.

Row level security keeps each user's receipts, items, API logs and photos private to them. Stores are shared; only admins (users listed in `admin_users`) can add or edit them.

## Project layout

| Path | What's there |
| --- | --- |
| `app/` | Pages and API routes (`api/parse-receipt`, `api/merge-receipts`, `api/delete-receipt`) |
| `components/` | UI, grouped by area (receipts, analytics, stores, admin) |
| `lib/receipt-parser.ts` | Model choice, prompt, JSON schema and the totals check |
| `lib/receipt-processing.ts` | Parsing a receipt's photos and saving the result |
| `lib/receipt-upload.ts` | Browser-side resizing, upload, merging and duplicate checks |
| `lib/database.types.ts` | Types generated from the Supabase schema |
| `supabase/migrations/` | Database schema history |
| `docs/` | Code audit |

## To do

### General

- [x] Sign in with Google
- [x] Show Google profile icon
- [x] Change icon to grocery cart or something simmilar
- [ ] Change Google sign-in to be more branded
- [ ] Add ability to search through purchased items by keyword

### Receipts

- [x] Upload a receipt and view past receipts
- [x] Parse a receipt and insert grocery items into database
- [x] Parse a receipt on upload
- [x] CRUD on parsed items
- [x] Add brand and generic name for items to help with analytics, as well as 'variant'

| Brand Name (optional) | Generic Name    | Variant  |
| --------------------- | --------------- | -------- |
| Kraft                 | Shredded Cheese | Cheddar  |
| Food Lion             | Mushrooms       | Shiitake |

- [x] Bulk import many receipts at once
- [x] Support long receipts photographed in several parts
- [x] Flag receipts whose items don't add up to the total
- [x] Flag possible duplicate receipts
- [ ] Add ability to link items, so no matter what store 'Kraft Cheddar Shredded Cheese' remains the same (removed for now; to revisit)
- [ ] Make receipt photos fully private (signed URLs instead of a public bucket)

### Analytics

- [x] Create analytics page so users can view basic stats about their shopping (most visited store, top spending category, est. savings, etc.)
- [x] Create 'Spending by store' graph
- [x] Create 'Spending by category' graph
- [x] Create 'Spending over time' graph
- [x] Allow users to select a store and receive store-specific stats
- [x] Allow users to filter purchased items by 'generic name' (lunch meat) and 'brand' (Oscar Mayer) to see how often they buy those items
- [ ] Allow users to view by month/year to see change over time

### Admin

- [x] Let admins add and edit stores (logo, color)
- [x] Make it so not everyone is an admin
