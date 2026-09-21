# Setup guide (start here if you've never run a MERN project)

This walks through everything from installing the tools to seeing the app in your browser. Follow it in order. If a
step fails, jump to [Troubleshooting](#troubleshooting) at the bottom — the common failures are all listed there.

You'll end up with three things running: **MongoDB** (the database), the **API** on port 5000, and the **web app** on
port 5173.

---

## 1. Install the tools

### Node.js 20 or newer

Download the LTS build from <https://nodejs.org> and install it. Then check:

```bash
node -v    # v20.x or newer
npm -v     # 10.x or newer
```

### MongoDB

Pick **one** of these two options.

**Option A — MongoDB on your own machine (recommended for local work)**

Install the MongoDB server as described below, then let the project run its *own* instance:

```bash
cd server
npm run db:start
```

That launches `mongod` on **127.0.0.1:27018** with the repository's `.data/db` folder as its data directory, so this
project's database is completely separate from any machine-wide MongoDB you already have on 27017. You do not need the
MongoDB service to be running, and you do not need administrator rights to start it. `npm run db:status` says whether
it is up, `npm run db:stop` shuts it down cleanly, and `MONGOD_PATH=/path/to/mongod` overrides the binary if the script
cannot find it.

*Windows*
1. Download the MongoDB Community Server MSI from <https://www.mongodb.com/try/download/community>.
2. Run it and choose **Complete**. Installing it as a service is optional — `npm run db:start` launches the project's
   own instance either way, and on a different port, so the two never clash.
3. If the installer put `mongod.exe` somewhere other than `C:\Program Files\MongoDB\Server\<version>\bin`, set
   `MONGOD_PATH` to it before running `npm run db:start`.

*macOS (Homebrew)*
```bash
brew tap mongodb/brew
brew install mongodb-community@8.0
brew services start mongodb-community@8.0
```

*Ubuntu / Debian*
```bash
sudo apt-get install -y gnupg curl
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/8.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list
sudo apt-get update && sudo apt-get install -y mongodb-org
sudo systemctl start mongod && sudo systemctl enable mongod
```

Verify the project's instance is up:

```bash
cd server && npm run db:status     # -> up on 127.0.0.1:27018
```

**Option B — MongoDB Atlas (free cloud database, nothing to install)**

1. Create a free cluster at <https://www.mongodb.com/atlas>.
2. **Database Access** → add a user with a password you'll remember.
3. **Network Access** → add your current IP address.
4. **Connect → Drivers** → copy the connection string. It looks like
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/roadmap_portal`.
5. Use that string as `MONGODB_URI` in step 3 below.

### Git (only if you're cloning the repo)

<https://git-scm.com/downloads>

---

## 2. Get the project

```bash
git clone <your-repository-url>
cd roadmap-portal
```

You should see three folders: `server`, `client` and `postman`.

---

## 3. Set up the API

```bash
cd server
npm install
```

Create your environment file:

```bash
cp .env.example .env        # Windows PowerShell: copy .env.example .env
```

Open `server/.env` in an editor. Two things need changing:

**a) The JWT secrets.** Generate two different random strings:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Run that twice and paste the results:

```
JWT_ACCESS_SECRET=<first random string>
JWT_REFRESH_SECRET=<second random string>
```

**b) The database URL**, only if you chose Atlas:

```
MONGODB_URI=mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/roadmap_portal
```

If you are using the project's own local instance, leave `MONGODB_URI` as it is — it already points at
`mongodb://127.0.0.1:27018/roadmap_portal`.

Now load the content:

```bash
npm run db:start     # skip this on Atlas
npm run seed
```

You should see:

```
Seeding roadmap_portal on 127.0.0.1:27018
Created admin account admin@roadmap.dev
Seeded 16 feature requests, 30 comments, 97 votes across 15 accounts.
```

Start the API:

```bash
npm run dev
```

It prints `API listening on http://localhost:5000/api/v1`. **Leave this terminal running** and open a new one.

Quick check — visit <http://localhost:5000/api/v1/health> in a browser. You should see `{"status":"ok"}`.

---

## 4. Set up the web app

In your second terminal:

```bash
cd client
npm install
cp .env.example .env        # Windows PowerShell: copy .env.example .env
npm run dev
```

Open <http://localhost:5173>. You should see the request feed with ten seeded requests.

You don't need to edit `client/.env` for local development — the dev server proxies `/api` to port 5000 already.

---

## 5. Log in and look around

| Role   | Email                     | Password      | What you can do                                     |
| ------ | ------------------------- | ------------- | --------------------------------------------------- |
| Admin  | `admin@roadmap.dev`       | `Admin@12345` | Everything, plus status changes and the admin panel |
| Member | `riya.sharma@example.com` | `Demo@12345`  | Post, vote, comment                                 |

Every seeded account uses `Demo@12345`; the full list is in `server/src/seed-data.js`. The addresses are on
`example.com`, the domain reserved for documentation, so none of them can reach a real mailbox.

Try this tour, in order — it touches every feature:

1. **Feed** — switch between Trending / Most voted / Newest, filter by category, and search. Notice the URL changes, so
   any view can be shared.
2. **Upvote while logged out** — you'll get a sign-in modal rather than losing your place.
3. **Sign in as the member**, upvote a request, and reload — the vote is still there.
4. **New request** — click the button, submit it empty to see the validation, then write a real one with markdown and
   use the Preview toggle.
5. **Comment** on your new request, then reply to your own comment to see the threading.
6. **Sign out, sign in as the admin**, open **Roadmap**, and drag a card from Planned to In progress. Reload — it
   stayed.
7. **Admin panel** — status tabs with counts, inline status changes, search.
8. **Sign up as a brand-new user** — you'll be blocked at login until you verify. Open
   <http://localhost:5173/dev/mailbox>, click the verification link, then sign in. Try **Forgot password** the same way.

---

## 6. Run the tests (optional, but it's the fastest way to see it all works)

MongoDB must be running; the tests create their own throwaway databases.

```bash
cd server && npm test
```

Expect `Tests 26 passed (26)`.

Type-check and build the frontend:

```bash
cd client && npm run build
```

Run the API collection end to end (needs the API running):

```bash
npm install -g newman
newman run postman/roadmap-portal.postman_collection.json
```

Expect `36 requests, 61 assertions, 0 failures`. You can also import that file into the Postman app and press **Run**.

---

## 7. Build for production

```bash
cd client && npm run build      # outputs client/dist
cd ../server && npm start       # serves the API only
```

Before deploying anywhere public, set these in `server/.env`:

```
NODE_ENV=production
COOKIE_SECURE=true              # requires HTTPS
JWT_ACCESS_SECRET=<real secret>
JWT_REFRESH_SECRET=<real secret>
ADMIN_PASSWORD=<something other than the demo>
CLIENT_URL=https://your-frontend-domain
CORS_ORIGINS=https://your-frontend-domain
```

The server refuses to start in production with the dev secrets or with `COOKIE_SECURE=false` — that's deliberate.

If the SPA and the API end up on different domains, also set `COOKIE_SAMESITE=none` on the server and
`VITE_API_URL=https://your-api-domain` in `client/.env` before building.

---

## Troubleshooting

**`MongooseServerSelectionError: connect ECONNREFUSED 127.0.0.1:27018`**
The project's database isn't running. `cd server && npm run db:start`. If that reports that it cannot launch `mongod`,
MongoDB isn't installed or isn't on your `PATH` — install it (above) or set `MONGOD_PATH` to the binary. On Atlas,
check instead that your current IP is allowed under Network Access.

**"Requests didn't load" with `No route for GET /v1/posts` (or `No route for POST /v1/auth/login`)**
The request reached the API but without the `/api` prefix, so nothing matched. The API is mounted at `/api/v1`, and
since v1.1 it also answers on `/v1`, so this specific failure shouldn't happen any more — if you see it, you're running
an older build of the server. Pull the latest code and restart it. If you changed `VITE_API_URL` in `client/.env`, set
it to the API's **origin only** (`http://localhost:5000`), not `.../api` or `.../api/v1`; the client adds the path
itself. In local development, leave `VITE_API_URL` empty and let the Vite proxy handle it.

**`Invalid environment configuration`**
A value in `server/.env` is missing or malformed — the message names the key. Most often it's a JWT secret shorter than
16 characters.

**Port 5000 already in use**
Something else has it (on macOS, AirPlay Receiver is a common culprit). Either free the port or set `PORT=5001` in
`server/.env` and `VITE_API_PROXY_TARGET=http://localhost:5001` in `client/.env`.

**Port 5173 already in use**
`npm run dev -- --port 5174` in `client`.

**The page loads but every request fails**
The API isn't running, or it's on a different port than `VITE_API_PROXY_TARGET`. Check
<http://localhost:5000/api/v1/health>.

**"Too many attempts. Try again later"**
The rate limiter allows 20 auth attempts per IP per 5 minutes. Restart the API to clear it, or set
`RATE_LIMIT_ENABLED=false` in `server/.env` while developing.

**I can't find the verification email**
It's simulated — nothing is sent. Open <http://localhost:5173/dev/mailbox>.

**Login says "Verify your email before signing in"**
That account hasn't used its verification link yet. Get it from the dev inbox. The seeded demo accounts are already
verified.

**I want to start the data over**
`cd server && npm run seed:reset` replaces the requests and comments. To wipe everything including the accounts, stop
the database (`npm run db:stop`), delete the `.data/db` folder, then `npm run db:start && npm run seed`. Because the
instance is this project's alone, deleting that folder cannot affect any other database on your machine.

**`npm install` fails on an old Node version**
Check `node -v`. Anything below 20 won't work; install the current LTS.
