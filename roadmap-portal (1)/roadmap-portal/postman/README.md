# Postman

`roadmap-portal.postman_collection.json` — import it into Postman, or run it headless:

```bash
newman run roadmap-portal.postman_collection.json
```

Run the folders in order (the Collection Runner does that for you). Nothing needs pasting by hand: verification and
reset tokens are read from the simulated dev mailbox, and the created request's id and slug are reused by the later
folders.

- The API must be running with `EMAIL_SIMULATION=true` (the default).
- Auth uses httpOnly cookies; Postman's cookie jar handles them, so leave it enabled.
- Change `baseUrl` in the collection variables to point at a deployed instance.
