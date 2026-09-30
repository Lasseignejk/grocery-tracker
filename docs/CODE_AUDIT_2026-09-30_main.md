# Code Audit — grocery-tracker

**Date:** 2026-09-30 · **Reviewed:** whole repo, branch `main` @ `0828a2c` · **Auth review:** on (detected — Supabase auth, admin role checks)

**Executed:** `npx tsc --noEmit` (29 errors), `npx eslint .` (34 errors, 19 warnings), `npm audit --omit=dev` (critical), `npm outdated`, `npx next build` (fails at type check). No test suite exists. Everything else below is from reading code.

---

## Status update — 2026-09-30 (after fixes, `main` @ `c50a5ac`)

Both blockers and five of the six majors are fixed and pushed. The type-check is now clean (0 errors), `next build` passes, and `npm audit` reports 0 vulnerabilities. Lint is at 29 errors / 19 warnings (down from 34 / 19); those errors don't block the build.

| Finding | Status | Commit |
|---|---|---|
| B1 Next.js RCE advisories | ✅ Fixed: next 16.3.8, react 19.3.0; `npm audit fix` for transitive `ws` | `94ad3e4` |
| B2 Build fails on type errors | ✅ Fixed: generated `lib/database.types.ts`, typed all Supabase clients, `lib/types.ts` now derives from it | `11ebef3` |
| M1 Price comparison never expands | ✅ Fixed | `11ebef3` |
| M2 Row cap truncates analytics | ✅ Fixed: `lib/supabase/fetch-all.ts` pages through with `.range()`; used on analytics, both store pages, item suggestions | `c50a5ac` |
| M3 Failed re-parse destroys items | ✅ Mostly fixed: delete moved after a successful parse, and a delete failure now aborts. A narrow window remains (delete succeeds, insert fails); closing it needs a DB function/transaction | `17fcb8f` |
| M4 Missing dates become "today" | ✅ Fixed: uploads start with `null`, the parser validates `YYYY-MM-DD` and keeps the existing date if unreadable, and the timeline charts skip undated receipts | `1feee7c` |
| M5 Prompt category mismatch | ✅ Fixed: DB checked (all 202 items use the 13-category list), prompt template now matches | `8bc67a1` |
| M6 Public receipt-image bucket | ⏳ Open | — |
| `middleware.ts` → `proxy.ts` | ✅ Fixed | `b373952` |
| Dead `link-items-dialog.tsx` | ✅ Deleted (it referenced a non-existent `product_id` column) | `11ebef3` |
| `top-items-grouped` prop type | ✅ Fixed | `11ebef3` |

Also done: the repo was flattened out of the nested `grocery-tracker/` folder (`dd860fd`), and `.env.example` was added (`0828a2c`).

**Still open:** M6; the remaining dependency updates (`@supabase/ssr`, `supabase-js`, `openai` 7.x, `recharts`, `tailwindcss`); the hard-coded `gpt-4o` model and deprecated `max_tokens`; the unused `tesseract.js`; the 20% "savings" estimate; lint errors; the auth callback ignoring errors; everything in §5 not listed above (duplicated `CATEGORIES`/`capitalizeWords`, repeated API-log insert, hand-rolled navs, unused `matched-badge.tsx`, stale comments); and the questions in §6.

**Data note:** 3 of the 15 existing receipts have a `purchase_date` equal to their upload day. They may be genuine, or they may be the old "today" default; worth checking by hand.

---

## 1. Verdict (original review, `0828a2c`)

A personal receipt-tracking app (Next.js 16 App Router + Supabase + OpenAI GPT-4o vision) at prototype / single-user stage. The core flow (upload → parse → edit → analytics) is well-structured and every page and API route checks auth itself, but **the current commit cannot be built** (29 type errors stop `next build`) and **the pinned Next.js 16.0.1 has critical, publicly exploited RCE advisories**. I would not deploy this as-is; both blockers are mechanical to fix. The biggest *product* risk heading into bulk import is that analytics queries fetch all rows without pagination and will silently undercount once the item count passes Supabase's row cap.

## 2. Blockers

### B1. ✅ FIXED (`94ad3e4`) — Next.js 16.0.1 is vulnerable to unauthenticated RCE — `package.json:15`
`next` is pinned to `16.0.1` (react/react-dom `19.2.0`). `npm audit` reports GHSA-9qr9-h5gf-34mp ("React2Shell", CVE-2025-55182; affects `<16.0.7`), reachable through any App Router RSC endpoint even without Server Actions — this app has 11 server-rendered pages. Two more critical RCEs affect `<16.3.3` (GHSA-2xp9-vwfh-vxw4 via the default `/_next/image` endpoint; GHSA-p293-qw3h-jr36 is Windows-only). Plus ~30 DoS/cache-poisoning/SSRF advisories and transitive `postcss`/`nanoid` issues.
**Fix:** `next` and `eslint-config-next` → `^16.3.8` (clears all criticals), `react`/`react-dom` → `^19.2.1`+, then `npm audit` again.
*Note:* the middleware/proxy-bypass advisories have no auth impact here — `middleware.ts` only refreshes the session; pages enforce auth themselves.

### B2. ✅ FIXED (`11ebef3`) — `next build` fails — 29 type errors
Confirmed by running `next build`: compiles, then `Type error: 'b' is of type 'unknown'` at `app/analytics/page.tsx:50` and exit 1. Installed versions match the lockfile, so these were present in November too — whatever is deployed predates them or was built another way.
Root cause for ~25 of them: the Supabase client is untyped, so rows are `any`, and `rows.reduce((acc, r) => …, {} as Record<…>)` on `any[]` infers `unknown` values. Affected: `app/analytics/page.tsx` (14), `app/stores/[name]/page.tsx` (7), `app/stores/page.tsx` (4), `spending-by-category.tsx:61`, `store-category-breakdown.tsx:68` (Recharts label `percent` is `unknown` in recharts 3 types).
**Fix:** generate DB types (`supabase gen types typescript`) and pass them to `createServerClient<Database>` / `createBrowserClient<Database>`; or, minimally, use `reduce<Record<string, number>>(…)` generics. Two errors are real bugs, below.

## 3. Major

### M1. ✅ FIXED (`11ebef3`) — Price comparison rows never expand — `components/stores/price-comparison.tsx:73`
`onClick={() => setIsExpanded ? setExpandedItem(null) : setExpandedItem(itemKey)}` — `setIsExpanded` doesn't exist (state is `expandedItem`/`setExpandedItem`, line 30). In dev, clicking throws `ReferenceError`; the detail panel can never open. **Fix:** `isExpanded ? setExpandedItem(null) : setExpandedItem(itemKey)`.

### M2. ✅ FIXED (`c50a5ac`) — Analytics & stores silently truncate at the Supabase row cap
`app/analytics/page.tsx:31`, `app/stores/page.tsx:32`, `app/stores/[name]/page.tsx:52` select *all* `receipt_items` with no pagination. PostgREST returns at most the project's `max_rows` (default 1000) with no error. At ~25–35 items per receipt, that's ~30–40 receipts — which the planned bulk import (20–100 receipts) will blow past. Totals, top items, category splits and price comparisons would all quietly undercount. *(Inferred: I couldn't check this project's `max_rows` setting.)*
**Fix:** aggregate in SQL (a view or RPC returning per-store/per-category/per-item sums), or page with `.range()` until exhausted. SQL aggregation is the better long-term answer.

### M3. ✅ MOSTLY FIXED (`17fcb8f`) — Failed re-parse destroys existing items — `app/api/parse-receipt/route.ts:70`
Existing items are deleted *before* the OpenAI call. If the call fails, times out, or the JSON can't be parsed, the route returns 500 and the receipt is left with zero items, including any manual edits. `parse-button.tsx` warns "will delete all existing items" but not that a failure loses them. **Fix:** delete only after a successful parse, immediately before the insert (ideally delete+insert in one RPC/transaction).

### M4. ✅ FIXED (`1feee7c`) — Missing dates silently become "today" — `route.ts:335`, `upload-receipt.tsx:87`
If GPT can't read a date, `purchase_date` falls back to the upload date. For old receipts (i.e. all of a bulk import) that puts spending in the wrong month in "spending over time" with no indication. **Fix:** allow `null`, and surface "date missing" on the receipt for manual entry.

### M5. ✅ FIXED (`8bc67a1`) — Parse prompt contradicts itself on categories — `route.ts:110` vs `route.ts:138-150`
The JSON template says `one of: produce, meat, dairy, bakery, beverages, snacks, household, personal-care, frozen, other`; the detailed list and the UI dropdowns (`add-item.tsx:13`, `edit-item.tsx:15`) use 13 categories including `dairy and eggs`, `bread`, `cans`, `pet`. The model can return either set, producing values the edit dropdown doesn't have. **Fix:** one `CATEGORIES` constant in `lib/`, used by both dropdowns and interpolated into the prompt (after checking which spelling the DB already holds).

### M6. ⏳ OPEN — Receipt images are in a public bucket — `upload-receipt.tsx:78`
`getPublicUrl` means anyone with the URL can view a receipt photo (which can include partial card numbers, loyalty IDs, store locations). Paths are `{user_id}/{timestamp}.{ext}`. It's public so OpenAI can fetch it. *(Inferred: bucket policy lives in Supabase, not the repo.)* **Fix:** private bucket + `createSignedUrl` (short TTL) passed to OpenAI and used for display; or send the image to OpenAI as base64 from the server.

## 4. Minor / out of date since November

- **Dependencies** (`npm outdated`): `@supabase/ssr` 0.7 → 0.12, `@supabase/supabase-js` 2.78 → 2.117, `openai` 6.7 → 7.x (major), `recharts` 3.3 → 3.10, `tailwindcss` 4.1 → 4.3. Do Next/React first (B1), then these, re-running tsc after each.
- ✅ *Fixed in `b373952`.* **`middleware.ts` → `proxy.ts`:** Next 16 deprecated the `middleware` file convention in favour of `proxy.ts` (`export function proxy`). Still works, but will warn and eventually break.
- **Supabase keys:** Supabase now issues `sb_publishable_…` keys in place of the legacy `anon` JWT. The code works with either; consider renaming the env var to `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` when you rotate.
- **OpenAI model & params:** `gpt-4o` is hard-coded 4 times (`route.ts:82, 276, 377, 415`) plus a hard-coded price at `:212`. It's now an older model — worth evaluating a newer vision model on a few receipts. `max_tokens` (`:197`) is deprecated in Chat Completions in favour of `max_completion_tokens` (newer models reject `max_tokens`).
- **Unused dependency:** `tesseract.js` isn't imported anywhere — remove it.
- **Invented "savings" number:** `app/analytics/page.tsx:69` estimates savings as 20% of sale-item price. That figure is displayed as if measured. Either label it clearly as a rough estimate or drop it.
- **Lint:** *(now 29 errors, 19 warnings)* 34 errors — 29 `no-explicit-any`, 4 unescaped quotes, and `components/ui/autocomplete-input.tsx:45` calling setState synchronously in an effect (cascading renders).
- **Auth callback** (`app/auth/callback/route.ts:11`) ignores the `exchangeCodeForSession` error; a failed login bounces to `/dashboard` → `/login` with no message.

## 5. Consistency & readability

- **Duplicated constants/helpers.** `CATEGORIES` is copy-pasted in `add-item.tsx` and `edit-item.tsx` (and a third, divergent copy lives in the prompt — see M5). `capitalizeWords` is defined in 4 files (`edit-item`, `autocomplete-input`, `price-comparison`, `top-items-grouped`) with slightly different null handling. → Move both to `lib/`.
- **Error handling style.** Dominant: `catch (err: any) { setError(err.message) }`. Deviation: `parse-receipt/route.ts` uses `unknown` + `getErrorMessage()`. Standardize on the latter (it also clears most `no-explicit-any` lint errors).
- **API-log insert repeated 3×** in `parse-receipt/route.ts` (`:271`, `:372`, `:410`) with the same 13 fields. → A `logApiCall(partial)` helper.
- **Navigation.** Most pages use `<Nav>`; `app/receipts/[id]/page.tsx:49` and `app/stores/[name]/page.tsx` hand-roll their own `<nav>`, so the admin link / active state differ there.
- *Partly fixed in `11ebef3`: `link-items-dialog.tsx` deleted; `matched-badge.tsx` and the commented-out JSX remain.* **Dead code from the removed linking feature** (`c04d66b`): `components/receipts/link-items-dialog.tsx` (305 lines) and `components/receipts/matched-badge.tsx` are imported nowhere; `edit-item.tsx:229-245` still has commented-out JSX for both; the README still lists linking as "ADDED not tested". → Delete or park on a branch.
- **Stale "✅ NEW / ✅ Now we track it!" comments** (`top-items-grouped.tsx`, `nav.tsx:8`, `route.ts:389`) describe past edits, not the code. Also `top-items-grouped.tsx:22` types `ungroupedItems` as having `item_name` while the caller actually passes `display_name` (it works at runtime; the prop type is just wrong, and it's one of the 29 build errors).

## 6. Questions for the author

1. **RLS:** Several writes go straight from the browser — `stores` logo/color update (`store-logo-upload.tsx:30`), item edits, receipt edits. Is `stores` UPDATE restricted to admins by RLS? If not, any signed-in user can change store logos site-wide. Does `api_logs` SELECT let admins read everyone's logs (the admin page assumes it does)?
2. **Store auto-creation:** the admin page says "Stores are auto-created from your receipts", but nothing in the repo inserts into `stores`. Is that a DB trigger?
3. **What's deployed?** Since `main` can't build, which commit is live (if any), and on what host?
4. Is this intended to stay single-user, or will others sign up? That changes how urgent M6 and Q1 are.

## 7. What I didn't review

- **Database schema, RLS policies, triggers, storage bucket policies** — none are in the repo (no `supabase/` or migrations folder), and the Supabase connection wasn't authorized in this session. Several findings (M2, M6, Q1, Q2) depend on them.
- `components/receipts/link-items-dialog.tsx` (dead code), the auth forms (`login-form`, `signup-form`, `google-signin-button`) beyond a skim, and chart presentation components beyond their type errors.
- Styling/UX, accessibility, and performance beyond the unbounded-query issue.
