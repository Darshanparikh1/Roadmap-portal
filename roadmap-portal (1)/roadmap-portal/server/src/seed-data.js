/**
 * The dataset the portal ships with.
 *
 * It is written as plain data so the seeder stays mechanical: every counter the app stores
 * (votes, comments, trending score, last activity) is derived in seed.js from the documents
 * actually created here, never hardcoded. Dates are expressed as "days before the seed run"
 * so the board always looks freshly used, and each status change is dated after the request
 * it belongs to.
 *
 * The accounts are demo accounts on example.com, the domain RFC 2606 reserves for exactly
 * this purpose — nothing here can reach a real mailbox.
 */

/** Everyone who has an account, keyed by the short handle the requests refer to. */
export const PEOPLE = [
  { key: "nadia", name: "Nadia Vogel", email: "nadia.vogel@example.com", role: "admin" },
  { key: "riya", name: "Riya Sharma", email: "riya.sharma@example.com" },
  { key: "marcus", name: "Marcus Bell", email: "marcus.bell@example.com" },
  { key: "ana", name: "Ana Duarte", email: "ana.duarte@example.com" },
  { key: "tom", name: "Tom Okafor", email: "tom.okafor@example.com" },
  { key: "lena", name: "Lena Fischer", email: "lena.fischer@example.com" },
  { key: "priya", name: "Priya Nair", email: "priya.nair@example.com" },
  { key: "daniel", name: "Daniel Kim", email: "daniel.kim@example.com" },
  { key: "sofia", name: "Sofia Rossi", email: "sofia.rossi@example.com" },
  { key: "hugo", name: "Hugo Martins", email: "hugo.martins@example.com" },
  { key: "yuki", name: "Yuki Tanaka", email: "yuki.tanaka@example.com" },
  { key: "elena", name: "Elena Petrova", email: "elena.petrova@example.com" },
  { key: "james", name: "James Whitfield", email: "james.whitfield@example.com" },
  { key: "aisha", name: "Aisha Rahman", email: "aisha.rahman@example.com" },
];

/** The shared password for every demo account (the first admin uses ADMIN_PASSWORD instead). */
export const DEMO_PASSWORD = "Demo@12345";

/**
 * Feature requests.
 *
 * - `days`     how long ago the request was filed
 * - `voters`   the people who voted, in the order they did (the author votes first)
 * - `track`    status changes an admin made, each `after` days from the filing date
 * - `comments` the discussion; `replies` nest one level under their parent
 */
export const REQUESTS = [
  {
    title: "Dark mode across the whole app",
    category: "ui_ux",
    status: "in_progress",
    days: 96,
    author: "riya",
    voters: ["riya", "marcus", "lena", "priya", "daniel", "sofia", "yuki", "elena", "james", "aisha", "tom", "hugo"],
    description:
      "Our support team works a late shift, and by 9pm the dashboard is the only bright window left on their screens.\n\nA proper dark theme — one that follows the operating system setting by default and can still be overridden per user — would fix that. To be genuinely useful it needs to cover more than the main shell:\n\n- the board and the request detail view\n- exported PDF reports\n- the embedded public widget\n- notification emails\n\nA half-dark app where one panel flashes white is worse than no dark mode at all.",
    track: [
      { to: "planned", after: 11 },
      { to: "in_progress", after: 38 },
    ],
    comments: [
      {
        by: "lena",
        after: 2,
        body: "Seconding the export point. We send the weekly PDF to a screen in a dark room — the white background is genuinely blinding.",
        replies: [
          {
            by: "nadia",
            after: 3,
            body: "Noted. Exports go through a separate rendering path, so they may land a release after the app itself, but they are in scope.",
          },
        ],
      },
      {
        by: "daniel",
        after: 9,
        body: "Please make the toggle remember the choice per account rather than per browser. Half our team works from two machines.",
      },
      {
        by: "nadia",
        after: 38,
        body: "Update: this is in build. The theme follows `prefers-color-scheme` on a first visit, and the override is stored on the account, as asked above.",
      },
    ],
  },
  {
    title: "Slack notification when a request ships",
    category: "integrations",
    status: "in_progress",
    days: 74,
    author: "marcus",
    voters: ["marcus", "ana", "tom", "priya", "hugo", "yuki", "james", "aisha", "riya"],
    description:
      "We collect feedback here but we live in Slack. Today someone has to remember to check the board and paste the news into `#product-updates` by hand, which means customers often hear about a shipped feature before our own account managers do.\n\nWhat would close the loop:\n\n1. Pick a channel per status transition, at minimum for **Completed**.\n2. Post the request title, who filed it, and a link back to the portal.\n3. Let us mute the noisier transitions — nobody needs a message for every new request.",
    track: [
      { to: "planned", after: 15 },
      { to: "in_progress", after: 52 },
    ],
    comments: [
      {
        by: "hugo",
        after: 6,
        body: "A Microsoft Teams version of this would matter just as much for us. Same shape, different webhook.",
      },
      {
        by: "nadia",
        after: 16,
        body: "Planned. We are building it on outgoing webhooks first, so Slack and Teams are both a URL and a payload template. That saves writing the same integration twice.",
        replies: [
          { by: "hugo", after: 17, body: "That works. A raw webhook is honestly all we need — we can format it on our side." },
        ],
      },
    ],
  },
  {
    title: "The board takes six seconds to load with 500 cards",
    category: "performance",
    status: "in_progress",
    days: 41,
    author: "tom",
    voters: ["tom", "sofia", "elena", "james", "marcus", "daniel", "ana"],
    description:
      "Once a column passes a few hundred cards the board stops being usable. Measured on a 2023 laptop, Chrome 141, against our staging copy with 512 requests:\n\n```\nTTFB              182 ms\nJS parse + boot   410 ms\nFirst render      5.8 s\nScroll (avg fps)  11\n```\n\nThe API is clearly not the problem — the render is. Virtualised columns, or pagination per column with an explicit \"load more\", would both work for us. We do not need all 500 cards on screen at once; we need the first twenty immediately.",
    track: [
      { to: "planned", after: 5 },
      { to: "in_progress", after: 19 },
    ],
    comments: [
      {
        by: "elena",
        after: 1,
        body: "Same picture here at around 380 cards. The profiler says most of the time goes into re-rendering every card on each drag event, not into the initial mount.",
        replies: [
          {
            by: "nadia",
            after: 4,
            body: "That matches what we found. The drag handler updated shared state on every pointer move; memoising the card and lifting the drag state out of the list is the first fix landing.",
          },
        ],
      },
      {
        by: "james",
        after: 20,
        body: "Happy to test a beta build against our data — we are the worst case here at just over 900 cards.",
      },
    ],
  },
  {
    title: "Bulk CSV import for existing feedback",
    category: "integrations",
    status: "planned",
    days: 58,
    author: "ana",
    voters: ["ana", "riya", "priya", "sofia", "aisha", "yuki", "elena"],
    description:
      "We have two years of feedback sitting in a spreadsheet, and starting the board empty means throwing that history away.\n\nAn import that accepts a CSV with `title`, `description`, `category`, `author_email` and `created_at` would let us begin from reality. Two things matter more than the format itself:\n\n- a dry run that reports what *would* be created before anything is written\n- matching `author_email` to existing accounts instead of silently attributing everything to whoever ran the import",
    track: [{ to: "planned", after: 21 }],
    comments: [
      {
        by: "yuki",
        after: 3,
        body: "The dry run is the important half. We imported into a different tool last year, got the date column wrong, and spent a day undoing it.",
      },
      {
        by: "nadia",
        after: 21,
        body: "Agreed on both counts. Scheduled for next quarter; the importer will refuse to write anything until a dry run of the same file has been reviewed.",
      },
    ],
  },
  {
    title: "Public read-only API for the roadmap",
    category: "integrations",
    status: "planned",
    days: 52,
    author: "priya",
    voters: ["priya", "marcus", "daniel", "hugo", "james", "tom"],
    description:
      "We would like to render the roadmap inside our own product rather than sending customers away to a separate portal.\n\nA read-only JSON endpoint for public requests — title, status, category, vote count, dates — behind a scoped API key would be enough. We do not need write access; new requests can keep going through the portal itself.",
    track: [{ to: "planned", after: 18 }],
    comments: [
      {
        by: "daniel",
        after: 5,
        body: "Please include an `ETag` or an `updated_since` parameter. Polling the whole roadmap every five minutes to spot one status change is wasteful for both sides.",
        replies: [{ by: "nadia", after: 18, body: "Both, in fact: the collection will be cacheable and accept `updated_since`." }],
      },
    ],
  },
  {
    title: "Keyboard shortcuts for triaging the board",
    category: "ui_ux",
    status: "planned",
    days: 33,
    author: "lena",
    voters: ["lena", "riya", "tom", "sofia", "elena"],
    description:
      "Triage is a daily job for me — roughly twenty requests a morning — and each one currently costs a click to open, a click to change the status, and a click to close.\n\nWhat I would use immediately:\n\n| Key | Action |\n| --- | --- |\n| `J` / `K` | move between cards |\n| `1`–`4` | set status |\n| `E` | open the editor |\n| `?` | show the shortcut list |\n\nThe last row matters: shortcuts nobody can discover are shortcuts nobody uses.",
    track: [{ to: "planned", after: 12 }],
    comments: [
      {
        by: "sofia",
        after: 4,
        body: "Please leave `/` for search rather than binding it to something else — that convention is worth keeping.",
      },
    ],
  },
  {
    title: "Merge duplicate requests and carry the votes over",
    category: "general",
    status: "under_review",
    days: 19,
    author: "sofia",
    voters: ["sofia", "lena", "ana", "riya", "daniel", "james"],
    description:
      "Dark mode was filed four separate times before anyone noticed. Right now the only way to clean that up is to close three of them, which loses their votes and quietly annoys the three people who filed them.\n\nMerging should keep one request as the survivor, move the votes across without double-counting anyone who voted on both, move the comments, and leave the merged request as a redirect so old links keep working.",
    comments: [
      {
        by: "riya",
        after: 2,
        body: "De-duplicating the voters is the subtle part. If I voted on both, the merged total should go up by zero, not by one.",
        replies: [
          {
            by: "nadia",
            after: 6,
            body: "Right — which is why this is still under review rather than planned. Votes are stored per request, so a merge has to reconcile two sets rather than add two numbers.",
          },
        ],
      },
    ],
  },
  {
    title: "Let customers vote without creating an account",
    category: "general",
    status: "under_review",
    days: 12,
    author: "yuki",
    voters: ["yuki", "hugo", "aisha", "elena"],
    description:
      "Asking someone to create an account before they can click one button loses most of the signal from the quiet majority. The people who sign up are the people who were already going to email us.\n\nA single-use link sent to their address — click it, the vote is recorded, no password ever set — would tell us far more about what the wider customer base actually wants.",
    comments: [
      {
        by: "james",
        after: 3,
        body: "Worth thinking about how this gets abused. An unauthenticated vote button is a brigading target unless the link is genuinely single-use and rate limited per address.",
        replies: [
          {
            by: "nadia",
            after: 5,
            body: "That is the open question here. We would rather ship this late than ship a vote count nobody trusts.",
          },
        ],
      },
    ],
  },
  {
    title: "Weekly email digest of roadmap changes",
    category: "general",
    status: "completed",
    days: 168,
    author: "daniel",
    voters: ["daniel", "marcus", "priya", "ana", "tom", "lena", "sofia", "james"],
    description:
      "Nobody checks a board on a schedule. A Friday summary of what moved — new requests, status changes, anything shipped — would keep the team current without anyone having to remember to look.\n\nOpt-in per account please, and one email rather than one per change.",
    track: [
      { to: "planned", after: 14 },
      { to: "in_progress", after: 47 },
      { to: "completed", after: 88 },
    ],
    comments: [
      { by: "ana", after: 5, body: "Opt-in is the right default. We already get enough automated mail on a Friday." },
      {
        by: "nadia",
        after: 88,
        body: "Shipped. The digest goes out on Friday at 16:00 in each account's own timezone, and the opt-in sits under notification settings.",
      },
    ],
  },
  {
    title: "Search stopped matching partial words",
    category: "performance",
    status: "completed",
    days: 141,
    author: "elena",
    voters: ["elena", "tom", "yuki", "riya", "marcus", "hugo"],
    description:
      "Searching for `auth` used to return everything about authentication. Since the update it returns nothing at all, and we only find those requests by scrolling.\n\nIt looks like search now matches whole words only. Prefix matching would restore what we had — I do not think anyone needs fuzzy matching here, just prefixes.",
    track: [
      { to: "in_progress", after: 9 },
      { to: "completed", after: 23 },
    ],
    comments: [
      {
        by: "nadia",
        after: 10,
        body: "Confirmed, and thank you for the precise report — moving to a text index brought stemming with it and dropped prefix matches. We are restoring prefix behaviour without giving up the index.",
        replies: [
          { by: "elena", after: 24, body: "Working again on our side. `auth`, `integ` and `perf` all return what I expect now." },
        ],
      },
    ],
  },
  {
    title: "Roadmap columns should show a count and a vote total",
    category: "ui_ux",
    status: "completed",
    days: 119,
    author: "james",
    voters: ["james", "sofia", "priya", "aisha", "lena"],
    description:
      "In our Monday review the first question is always \"how much is in progress?\", and the answer is currently arrived at by counting cards on a projector.\n\nA count in each column header, plus the combined vote total for that column, would answer it before anyone asks.",
    track: [
      { to: "planned", after: 20 },
      { to: "in_progress", after: 44 },
      { to: "completed", after: 61 },
    ],
    comments: [
      {
        by: "nadia",
        after: 61,
        body: "Live now — each column header shows the card count and the sum of the votes behind it.",
      },
    ],
  },
  {
    title: "Attach screenshots to a request",
    category: "ui_ux",
    status: "under_review",
    days: 26,
    author: "aisha",
    voters: ["aisha", "elena", "yuki", "hugo", "ana", "marcus", "tom"],
    description:
      "Describing a layout bug in prose is slow and usually inaccurate. Letting people drop an image straight into the description — or paste one from the clipboard — would make these reports much easier to act on.\n\nA size limit and a restriction to image types would be entirely reasonable.",
    comments: [
      { by: "ana", after: 4, body: "Clipboard paste is the part that matters. Saving a screenshot to disk first is most of the friction." },
      {
        by: "hugo",
        after: 8,
        body: "Please strip EXIF on upload. Screenshots from phones carry location data more often than people realise.",
      },
    ],
  },
  {
    title: "Per-category email routing to the owning team",
    category: "general",
    status: "under_review",
    days: 8,
    author: "hugo",
    voters: ["hugo", "daniel", "james"],
    description:
      "Requests filed under **Performance** should reach the platform team and **UI / UX** should reach design, without a person in the middle forwarding mail every morning.\n\nOne address per category, configurable by an admin, would cover it.",
    comments: [],
  },
  {
    title: "Rate-limit the vote endpoint per account",
    category: "performance",
    status: "completed",
    days: 105,
    author: "marcus",
    voters: ["marcus", "james", "elena", "daniel"],
    description:
      "A script hitting the vote endpoint in a loop can move a request up the board in seconds. We noticed this on our own staging instance rather than in anger, but it would be trivial to do on purpose.\n\nA per-account limit on write endpoints would make the vote counts mean something.",
    track: [
      { to: "in_progress", after: 6 },
      { to: "completed", after: 17 },
    ],
    comments: [
      {
        by: "nadia",
        after: 7,
        body: "Thank you for flagging this privately first. Write endpoints are now rate limited per account and per address, with the auth endpoints held to a stricter limit than the rest.",
        replies: [
          {
            by: "marcus",
            after: 18,
            body: "Verified on our instance — the loop that used to work now returns 429 after the first few calls.",
          },
        ],
      },
    ],
  },
  {
    title: "Export the roadmap as a PDF for board meetings",
    category: "general",
    status: "planned",
    days: 44,
    author: "james",
    voters: ["james", "nadia", "priya", "ana", "sofia", "riya"],
    description:
      "Our quarterly board pack needs the roadmap as a static page, and a screenshot of a scrolling board is not something I want to put in front of investors.\n\nOne page per status column, the request titles and vote counts, the date it was generated, and our logo in the header.",
    track: [{ to: "planned", after: 16 }],
    comments: [
      {
        by: "priya",
        after: 6,
        body: "If the generated date sits in the footer of every page it saves an argument about which version someone is holding.",
      },
    ],
  },
  {
    title: "Show who voted on a request",
    category: "general",
    status: "under_review",
    days: 5,
    author: "riya",
    voters: ["riya", "lena"],
    description:
      "When a request has thirty votes, the useful question is *which* thirty. If three of them are our largest accounts, that changes the priority more than the raw number does.\n\nThis clearly needs to be a setting rather than a default — on a public board it would be a privacy problem.",
    comments: [
      {
        by: "aisha",
        after: 1,
        body: "Strongly agree on making it opt-in, and ideally opt-in per voter rather than per board. I am happy for my own team to see my votes and not for a public page to list them.",
      },
    ],
  },
];
