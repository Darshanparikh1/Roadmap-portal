# Feature Request & Public Roadmap Portal

A customer-feedback portal in the spirit of Canny and Featurebase: people post feature requests, upvote the ones they
need, argue them out in threaded comments, and follow what the team accepted on a public three-column roadmap.

It ships branded as **Throughline** — the thread that runs from a customer's request to the thing that shipped. The
name is a single setting (`VITE_PRODUCT_NAME`), so pointing this at your own product is a one-line change.

**Stack:** MongoDB · Express 5 · React 19 · Node 22 (MERN), with Mongoose, Zod, TanStack Query, Tailwind CSS v4 and
[coss.com/ui](https://coss.com/ui) primitives.

![Request feed](docs/screenshots/feed.png)

---

## Quick start

Three things to install first: **Node 20+**, **MongoDB 6+** (running locally, or an Atlas connection string), and
**npm**. Then, in two terminals:

```bash
# Terminal 1 — API
cd server
npm install
cp .env.example .env          # then set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET
npm run db:start              # this project's own MongoDB, on port 27018
npm run seed                  # 15 accounts, 16 feature requests, 30 comments
npm run dev                   # http://localhost:5000

# Terminal 2 — web app
cd client
npm install
cp .env.example .env
npm run dev                   # http://localhost:5173
```

Open <http://localhost:5173>.

| Role   | Email                     | Password      |
| ------ | ------------------------- | ------------- |
| Admin  | `admin@roadmap.dev`       | `Admin@12345` |
| Member | `riya.sharma@example.com` | `Demo@12345`  |

Email is simulated, so verification and password-reset links land in the app's **dev inbox** at
<http://localhost:5173/dev/mailbox> instead of a real mailbox. There is no SMTP to configure.

A longer, beginner-friendly walkthrough — including how to install MongoDB on each OS and what to do when something
fails — is in [`docs/SETUP.md`](docs/SETUP.md). A guided tour of every feature, in the order worth demonstrating, is in
[`docs/DEMO.md`](docs/DEMO.md).

---

## Technology stack, and why

| Layer      | Choice                              | Why this one                                                                          |
| ---------- | ----------------------------------- | -------------------------------------------------------------------------------------- |
| Database   | MongoDB 6+ with Mongoose 8          | The brief's voting model is built on atomic array operators; documents fit the data      |
| API        | Express 5                           | Small and explicit; async errors now reach the error middleware without a wrapper hack   |
| Validation | Zod                                 | One schema validates, coerces and documents each endpoint's input                        |
| Auth       | jsonwebtoken + bcryptjs             | Signed pair tokens and slow password hashing, with no auth framework to explain away     |
| Frontend   | React 19 + TypeScript + Vite        | Typed end to end, instant HMR, minimal config                                            |
| Styling    | Tailwind CSS v4 + coss.com/ui       | Required by the brief; accessible Base UI primitives whose source lives in the repo      |
| Data layer | TanStack Query v5                   | Caching, background refetch and the optimistic upvote the brief asks for                 |
| Routing    | React Router v7 (data router)       | Route-level code splitting for the admin panel                                           |
| Tests      | Vitest + Supertest                  | 26 integration tests that run against a real MongoDB, not mocks                          |

### Third-party libraries

Server: **mongoose** (schemas, indexes, populate), **zod** (input validation), **jsonwebtoken** + **bcryptjs** (auth),
**cookie-parser**, **cors**, **helmet** (security headers), **express-rate-limit** (brute-force protection),
**morgan** (dev request log), **dotenv**.

Client: **@tanstack/react-query** (server state), **react-router** (routing), **react-markdown** + **remark-gfm**
(renders request and comment markdown without allowing raw HTML), **highlight.js/core** with a curated grammar set
(the full build ships ~190 languages), **lucide-react** (icons used by coss ui), **@fontsource** (self-hosted fonts —
no third-party request, no layout shift).

Dev only: **vitest**, **supertest**, **newman** (runs the Postman collection headless).

---

## Features

### Submission and feed

![Submission modal](docs/screenshots/new-request-modal.png)

A validated modal takes a title, a markdown description with live preview, and one of four category tags (UI/UX,
Integrations, Performance, General). Submitting counts the author's own vote — nobody posts an idea they disagree with.

The feed sorts by **Trending**, **Most voted**, **Newest** or **Most discussed**, filters by category and status, and
searches titles and descriptions with a 300 ms debounce. Sort, filters and the search term all live in the URL, so any
view is a shareable link. Pagination is infinite-scroll with a "Load more" fallback.

**Trending** is a stored score in the spirit of Reddit's hot ranking: `log10(votes + comments/2 + 1)` plus a recency
bonus. Votes are logarithmic, so the second vote matters far more than the two-hundredth, and a fresh request with a
few votes can outrank an old one with many. It's recomputed on every vote and comment, because MongoDB can't sort by a
time-decayed expression without running an aggregation on every read.

### Atomic upvoting

Each direction is a single `findOneAndUpdate` whose **filter carries the guard**:

```js
// add: only matches if this user is NOT already in voters
{ _id: id, voters: { $ne: userId } }  →  { $addToSet: { voters: userId }, $inc: { voteCount: 1 } }
// remove: only matches if they ARE
{ _id: id, voters: userId }           →  { $pull:     { voters: userId }, $inc: { voteCount: -1 } }
```

No read-then-write, no transaction, and no way for two racing clicks to double-count: the second one no longer matches
the filter. A test fires ten simultaneous votes and asserts `voteCount` never drifts from the `voters` array.

On the client the count moves the instant you click, across every cached copy of that request — feed, detail page,
roadmap column, admin table — and rolls back if the request fails. Anonymous visitors get a sign-in modal rather than a
redirect, because sending someone to a login page is a good way to lose the vote.

### Threaded discussion

![Request detail](docs/screenshots/request-detail.png)

Comments are markdown, nested up to three levels (deeper replies collapse onto the last level instead of being
refused), and assembled into a tree in memory from an adjacency list. Authors edit their own comments; authors **and**
admins can delete. Deleting a comment that has replies leaves a tombstone so the thread doesn't lose its shape. Every
comment carries per-viewer `canEdit` / `canDelete` flags, so the UI never offers an action the API would reject.

### Admin controls and the public roadmap

![Roadmap](docs/screenshots/roadmap.png)

Admins move requests through `under_review → planned → in_progress → completed` from the request page, the admin table,
or by dragging cards on the board. Every transition is recorded on the post with who changed it and when, and shown as
a small history on the request page. The public board shows the three post-review columns; anything still under review
stays on the requests page. Column order survives a drag because the board persists it.

![Admin panel](docs/screenshots/admin-panel.png)

The admin panel adds status tabs with live counts, category and sort filters, search, inline status changes and a
"most wanted" list. RBAC is enforced in middleware (`requireAuth` → `requireAdmin`) on the server; the route guard in
the SPA is convenience, not security.

---

## Interface

The UI is built from [coss.com/ui](https://coss.com/ui) primitives (Base UI under the hood), whose source is vendored
into `client/src/components/ui` so it can be adjusted rather than fought with. On top of that:

- **One accent colour, used sparingly.** The brand violet appears on primary actions and on the "you voted" state, so
  the vote control is the most obvious thing on a card. Everything else stays neutral.
- **A colour per category** (UI/UX, Integrations, Performance, General) and a status dot per state, so the feed can be
  scanned without reading every chip.
- **Layouts that hold their shape.** Skeletons match the real content's dimensions, so nothing jumps when data lands,
  and filtered results fade rather than flash.
- **Dark mode** is a first-class theme, not an inversion: both palettes are defined in tokens and the choice persists.
- **Responsive from 390px up.** The request page collapses its sidebar into the content flow, the board scrolls
  vertically as stacked columns, and the header keeps the primary action reachable.
- **Keyboard and screen-reader paths.** Every control is reachable and labelled, the vote button reports
  `aria-pressed`, filter state lives in the URL, and dragging on the board has a keyboard-accessible equivalent in the
  status dropdown.

![Roadmap board](docs/screenshots/roadmap.png)

---

## Authentication

Pair tokens in httpOnly cookies — JavaScript never touches a token, so an XSS bug can't walk away with the session.

| Token   | Lifetime | Cookie path      | Notes                                                                 |
| ------- | -------- | ---------------- | ---------------------------------------------------------------------- |
| Access  | 15 min   | `/`              | JWT, verified on every request                                          |
| Refresh | 7 days   | `/api/v1/auth`   | JWT whose `jti` is a row in `refreshtokens`, so it can be revoked        |

**Rotation with reuse detection.** Every refresh revokes the token presented and issues a new pair in the same
*family*. A token that reappears after it was rotated has probably leaked, so the entire family is revoked and everyone
signs in again. Two tabs refreshing in the same instant look identical to that attack, so a just-rotated token stays
valid for `REFRESH_REUSE_GRACE_SECONDS` (10 by default), and the client collapses concurrent refreshes into one
request. Both halves are needed; either alone still logs people out.

**The rest.** Signup sends a 24-hour single-use verification link and login is refused until it's used.
Forgot-password issues a 30-minute single-use link, invalidates any earlier one, and answers identically whether or not
the account exists. A completed reset revokes every session and stamps the user, so access tokens issued earlier stop
working immediately. Login runs bcrypt even for unknown emails, so response time doesn't reveal who's registered.
Auth endpoints are rate-limited per IP.

**On the client**, a 401 triggers one refresh and one retry, transparently, and the token is rotated a minute before it
expires. A non-secret `session_hint` cookie tells the SPA whether a session might exist, so anonymous visitors don't
fire requests that are guaranteed to fail.

---

## Data model

```
User      name · email (unique) · passwordHash · role: user|admin · isVerified · passwordChangedAt
Post      title · slug (unique) · description (markdown) · category · status · author →User
          voters: [→User] · voteCount · commentCount · trendingScore · boardOrder
          statusHistory: [{ from, to, at, by →User }]
Comment   post →Post · author →User · parent →Comment|null · depth (0-3) · body · isDeleted · editedAt
RefreshToken  jti (unique) · user →User · familyId · expiresAt · revokedAt · replacedBy   (TTL index)
OneTimeToken  user →User · purpose · tokenHash (SHA-256, never the raw token) · expiresAt · usedAt
OutboxEmail   to · subject · body · actionUrl                                  (the simulated mailbox)
```

Two decisions worth naming. **Counters are denormalized** (`voteCount`, `commentCount`, `trendingScore`) and kept
correct with `$inc` in the same atomic update that changes the underlying data, because the feed sorts by them on every
request and recounting per read doesn't scale. **`voters` is an array on the post** rather than a separate votes
collection: it makes the duplicate-vote guard a single-document operation, and it's bounded by the number of users who
care about one request. If a request could realistically collect a million voters, that array would move to its own
collection with a compound unique index.

Indexes cover the query patterns the feed actually uses: `{status, category, trendingScore}`,
`{status, category, createdAt}`, `{status, boardOrder, voteCount}`, a text index on `{title, description}`, and
`{post, createdAt}` on comments.

---

## API

Base URL `http://localhost:5000/api/v1`. The same router is also mounted at `/v1`, so deployments behind a proxy that
strips the `/api` prefix keep working. A request to an unknown path says so explicitly, and names the mount point,
rather than returning a bare 404.

Every error comes back in one shape:

```json
{ "error": { "code": "validation_error", "message": "Give it a title of at least 5 characters",
             "details": { "title": "Give it a title of at least 5 characters" } } }
```

### Auth — `/auth`

| Method | Path                   | Access | Purpose                                     |
| ------ | ---------------------- | ------ | -------------------------------------------- |
| POST   | `/signup`              | public | Create account, send verification link       |
| POST   | `/verify-email`        | public | Confirm the address                          |
| POST   | `/resend-verification` | public | New link (always 200)                        |
| POST   | `/login`               | public | Set access + refresh cookies                 |
| POST   | `/refresh`             | cookie | Rotate the pair                              |
| POST   | `/logout`              | cookie | Revoke the session family, clear cookies     |
| POST   | `/forgot-password`     | public | Send reset link (always 200)                 |
| POST   | `/reset-password`      | public | New password, all sessions revoked           |
| GET    | `/me`                  | member | Current user                                 |

### Feature requests — `/posts`

| Method | Path                | Access          | Purpose                                                    |
| ------ | ------------------- | --------------- | ----------------------------------------------------------- |
| GET    | `/`                 | public          | Feed: `sort`, `category`, `status`, `q`, `page`, `limit`     |
| POST   | `/`                 | verified member | Submit a request                                            |
| GET    | `/:slug`            | public          | One request                                                 |
| PATCH  | `/:id`              | author or admin | Edit title, description, category                           |
| DELETE | `/:id`              | author or admin | Delete the request and its comments                         |
| POST   | `/:id/vote`         | verified member | Toggle the viewer's vote (atomic)                           |
| GET    | `/:id/comments`     | public          | Comment tree                                                |
| POST   | `/:id/comments`     | verified member | Comment or reply (`parentId`)                               |

### Comments — `/comments`

| Method | Path    | Access          | Purpose                                        |
| ------ | ------- | --------------- | ----------------------------------------------- |
| PATCH  | `/:id`  | author          | Edit (admins deliberately can't rewrite words)  |
| DELETE | `/:id`  | author or admin | Delete, or tombstone if it has replies          |

### Roadmap and admin

| Method | Path                        | Access | Purpose                                        |
| ------ | --------------------------- | ------ | ----------------------------------------------- |
| GET    | `/roadmap`                  | public | The three board columns                        |
| GET    | `/admin/posts`              | admin  | All requests with status counts                |
| PATCH  | `/admin/posts/:id/status`   | admin  | Transition status (recorded in history)        |
| PATCH  | `/admin/roadmap/order`      | admin  | Persist a column's order after a drag          |
| GET    | `/admin/stats`              | admin  | Dashboard totals and most-wanted list          |
| GET    | `/dev/mailbox`              | dev    | Simulated inbox (404s in production)           |

### Postman

`postman/roadmap-portal.postman_collection.json` walks the whole API in order — signup, verify (the token is pulled
out of the dev mailbox automatically), login, refresh, reset, then requests, voting, comments, admin and roadmap.
Cookies are handled by Postman's jar; just press **Run**.

```bash
newman run postman/roadmap-portal.postman_collection.json
# 36 requests, 61 assertions, 0 failures
```

---

## Environment variables

Nothing secret is committed; `.env` is git-ignored and `.env.example` documents every key.

### `server/.env`

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `NODE_ENV` | `development` | `production` refuses to boot with dev secrets or non-secure cookies |
| `PORT` | `5000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27018/roadmap_portal` | This project's own MongoDB, or an Atlas SRV string |
| `MONGODB_TEST_URI` | `mongodb://127.0.0.1:27018` | Host for the throwaway databases the tests create |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | dev placeholders | **Set both.** `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` | `15` / `7` | Token lifetimes |
| `REFRESH_REUSE_GRACE_SECONDS` | `10` | Tolerates two tabs refreshing at once |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | `false` / `lax` / empty | `true` + `none` when SPA and API are on different sites |
| `CLIENT_URL` | `http://localhost:5173` | Used to build verification and reset links |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowlist |
| `EMAIL_SIMULATION` | `true` | `false` (or production) disables the dev inbox |
| `EMAIL_VERIFICATION_TTL_HOURS` / `PASSWORD_RESET_TTL_MINUTES` | `24` / `30` | One-time link lifetimes |
| `RATE_LIMIT_ENABLED` / `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MINUTES` | `true` / `20` / `5` | Per IP, on auth routes |
| `SEARCH_MODE` | `auto` | `auto` uses the text index and falls back to regex; `text` or `regex` force one |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | demo values | First admin, created on startup — **change before deploying** |

### `client/.env`

| Variable | Default | Notes |
| -------- | ------- | ----- |
| `VITE_API_PROXY_TARGET` | `http://localhost:5000` | Where the dev server proxies `/api` |
| `VITE_API_URL` | empty | Set only when the built SPA is served from a different origin than the API |
| `VITE_PRODUCT_NAME` | `Throughline` | Product name shown in the UI |

### Database setup

This project runs its **own** MongoDB instead of sharing the machine-wide one: the data lives in `.data/db` inside the
repository and the server listens on **27018**, so it never collides with a system MongoDB service on 27017, and
dropping this database can't touch anything else on the machine.

```bash
cd server
npm run db:start     # launches mongod on 127.0.0.1:27018 with .data/db as its data directory
npm run db:status    # up / down
npm run db:stop      # clean shutdown
```

`scripts/db.js` finds `mongod` on the `PATH` and falls back to the standard Windows install location; set `MONGOD_PATH`
if yours lives somewhere else. The app creates the collections and indexes on first connection, `npm run seed` loads
the content, and `npm run seed:reset` replaces it. The test suites create their own `test_*` databases on the same
instance, so running them never disturbs the development data.

To use MongoDB Atlas or an existing local server instead, put its connection string in `MONGODB_URI` and skip
`db:start` entirely. Step-by-step install instructions per OS are in [`docs/SETUP.md`](docs/SETUP.md).

---

## Tests

```bash
cd server && npm test     # 26 integration tests against a real MongoDB
cd client && npm run build  # type-check + production build
```

The server tests are integration tests, not unit tests with mocked models: each suite talks to a real database, so the
atomic vote guard, the unique indexes and the comment tree are actually exercised. They cover signup and verification,
cookie scoping, rotation, reuse detection, the two-tab race, password reset, submission and validation, slug
uniqueness, permissions, feed sorting, filtering, search and pagination, concurrent voting, comment nesting, tombstones
and RBAC on every admin route.

GitHub Actions runs the server tests (with a MongoDB service container) and the client build on every push.

---

## Assumptions and limitations

Honest list, with how I'd close each gap.

**Assumptions**

- One product, one board. Multi-tenancy would add a workspace scope to every query and index.
- Anyone can sign up as a member; admin is granted by seeding, not self-service.
- Status transitions are free-form rather than a strict pipeline: admins genuinely need to move a card backwards when
  something gets deferred. Every move is recorded instead.
- Email is simulated on purpose so reviewers can run verification and reset without SMTP credentials.

**Limitations**

- **No migrations.** Indexes are built from the schema at boot (`autoIndex` off in production). A real deployment would
  build them in a migration step instead.
- **Rate limiting is in-process.** Correct for one worker, ineffective behind a load balancer; the fix is Redis behind
  the same interface.
- **Search uses the text index where it exists, regex otherwise.** Regex search can't use an index and will slow down
  on a large corpus — at that point it's Atlas Search or a dedicated engine.
- **No duplicate detection.** The brief's "merge duplicates" problem is real; I'd start with a similarity check on
  title at submission time and an admin merge that transfers voters with `$addToSet`.
- **No frontend test suite is committed.** I drove every flow through a real browser with Playwright while building —
  that's how the tombstone bug surfaced — but the scripts aren't in the repo. Vitest for the vote and comment-tree
  logic, Playwright in CI.
- **Comment trees load in full.** Fine for dozens of comments; a very long thread wants pagination per level.
- **Accessibility** is covered at the level of semantics, labels, focus order and keyboard paths. Drag-and-drop on the
  board is mouse-only by design — the status dropdown on each request is the keyboard-accessible equivalent — but none
  of it has been through a screen-reader audit.

---

## Project layout

```
server/
  src/
    config/env.js        every setting, validated with Zod at boot
    db/connect.js        Mongoose connection
    models/              user · post · comment · token (refresh, one-time, outbox)
    middleware/          auth (optional/required/verified/admin) · validate · error · rate-limit
    controllers/         auth · post (incl. votes and comments) · admin · dev
    routes/index.js      one place to see the whole API surface
    services/            email simulation · search + slug helpers
    validators/          Zod schemas per endpoint
    utils/               api-error · tokens · ranking
    app.js · server.js · seed.js
  tests/                 auth · posts · votes · comments (26 tests)
client/
  src/
    components/ui/       coss ui primitives (vendored, editable)
    components/app/      post card · vote button · comment thread · submission modal · header
    features/            TanStack Query hooks (posts, admin)
    auth/                session context + route guards
    pages/               feed · request · edit · roadmap · admin · auth · dev inbox
    lib/                 api client · types · content constants · formatting
postman/                 collection that walks the whole API
docs/                    SETUP.md (beginner guide) + screenshots
```
