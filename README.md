# Freight_Quote_System
## Live Link: 
### https://freight-quote-generation-system-grp.vercel.app/
Landing page done, Authentication done.
Milestone-1 Completed.

## Milestone 1 — Rule-based quote generation

Backend (`server/`):
- `accounts`: signup/login now take a `role` (`retail` | `business`; `admin`
  is never self-registered). Business signups require `company_name`.
  `GET /api/auth/me/` returns the logged-in user's profile.
- Promote/create an admin from the CLI — this is the only way to get one:
  ```
  python manage.py create_admin admin@example.com --password s3cret --full-name "Ops Admin"
  ```
- `pricing` app: rule-based pricing engine (`pricing/engine.py`, pure
  functions, unit tested in `pricing/tests.py`).
  - `POST /api/quotes/estimate/` — validate a shipment request, price it,
    persist it, return the full breakdown. Scoped to the logged-in user.
  - `GET /api/quotes/` / `GET /api/quotes/<id>/` — a user's own quote
    history only.
  - `POST /api/quotes/<id>/confirm/` — move a quote from draft to confirmed.
  - `GET`/`PATCH /api/admin/rate-config/` — admin-only; edit the base rate,
    fuel surcharge %, and cargo/mode multipliers the engine uses. Changes
    apply to every quote generated afterwards.
  - Origin/destination cities are resolved against a small seeded table
    (`pricing/cities.py`) — a stand-in for the real ports/airports master
    data described in the project docs. Unresolved cities return a clear
    422 error rather than a guess.

Frontend (`client/`):
- Sessions persist across refresh (token in `localStorage`, rehydrated via
  `/me`). `ProtectedRoute` guards `/dashboard`, `/quote`, and `/admin`
  (admin-role only).
- Signup collects `retail`/`business` role and the business fields.
- `/quote` — the real, wired quote flow (`ShipmentForm` → `POST
  /api/quotes/estimate/` → `QuoteResult` with the live breakdown).
- `/dashboard` — real quote history pulled from the API, plus a link to the
  admin rate-config page for admin users.
- `OriginDestination.jsx`, `CargoClass.jsx`, `RouteSelection.jsx` are
  earlier, unused static drafts of the same fields now covered by
  `ShipmentForm` — left in place but not wired into any route.

Known open item carried over from planning: retail vs. business accounts
currently only differ in signup fields (company name/GST) — no feature
differences (bulk quotes, credit terms, etc.) are implemented yet.

