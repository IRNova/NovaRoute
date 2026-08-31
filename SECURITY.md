# Security policy

## Reporting a vulnerability

Please report security issues privately, not as a public GitHub issue.

- Open a [private security advisory](https://github.com/IRNova/NovaRoute/security/advisories/new) on the repository, or
- write to the maintainer through the contact listed on the project page.

Include what you did, what happened, and the version or commit you tested. A
proof of concept helps, but a clear description is enough — please do not test
against someone else's instance.

## What this software protects

A NovaRoute install holds provider API keys, OAuth tokens and browser session
cookies for every provider you connect, the content of every request that passes
through the gateway, and — if the Nova agent is enabled — a path to running
commands on the host. Treat the install directory and `DATA_DIR` as secret
material.

## Hardening checklist

1. Finish first-time setup immediately after install. Until a password is
   stored, an unclaimed panel can be claimed.
2. Set `JWT_SECRET`, `API_KEY_SECRET` and `MACHINE_ID_SALT` to random values
   (`openssl rand -hex 32`). Without `API_KEY_SECRET`, provider credentials are
   stored in plain text.
3. Leave `Require API Key` on and give each client its own key.
4. Put the gateway behind TLS (the installer does this with Caddy when you give
   it a domain), or bind it to `127.0.0.1` and reach it over SSH/Tailscale.
5. `chmod 600` the `.env` file and `DATA_DIR/db/data.sqlite`.
6. Remove `ADMIN_MASTER_PASSWORD` once you have regained access.
7. If the Nova agent is enabled, never combine a channel that reads messages
   from strangers (Instagram, a Telegram user account) with the `terminal` or
   `files` tools. Indirect prompt injection starts there.

8. Give each client its own key with a request limit (`rpmLimit`) and a spend
   cap. Both are enforced on every gateway surface, so a leaked key cannot be
   used to burn the account overnight.
9. Watch `Settings > Security > Audit Trail` after any suspicious event, and
   scrape `/api/metrics` (with `METRICS_TOKEN`) to alert on a key's spend
   jumping.

10. Give each person their own account with the smallest role that works
    (Settings > Security > Users). Someone who only reads reports is a
    `viewer`, not an `admin`.

Run the posture check on a real install:

```bash
npm run audit:security          # add --fa for Farsi, --json for CI
```

It exits non-zero when it finds a critical issue, so it can gate a deploy.

## Security-sensitive code

Changes to these need a careful review — they are the boundaries everything
else rests on:

| File | Boundary |
|---|---|
| `custom-server.js` | Derives the client IP from the TCP socket and strips forged forwarding headers |
| `src/dashboardGuard.js` | Deny-by-default policy for `/api/*`, gateway key enforcement |
| `src/lib/auth/dashboardSession.js` | Session issuing, revocation epoch, password verification |
| `src/lib/nova/safeCommand.js` | The only thing between the agent and an unattended root shell |
| `src/lib/security/urlGuard.js` | SSRF guard (IP parsing, DNS, redirect revalidation) |
| `src/lib/security/fieldCipher.js` | Credential encryption at rest |
| `src/lib/auth/timingSafe.js` | Constant-time secret comparison |
| `src/lib/apiKeyPolicy.js` | Per-key policy: active flag, model access, spend and rate limits |
| `src/lib/security/keyRateLimiter.js` | Sliding-window request and concurrency limits |
| `src/lib/security/adminAudit.js` | Audit trail for administrative writes |
| `src/lib/auth/roles.js` | Role matrix: which role may call which route |

Regression tests for these live in `tests/unit/security.test.js`:

```bash
npm run test:unit
```

## Audit history

A full audit of this codebase (August 2026), its thirteen findings and the
patches that closed them, is documented in Farsi at
[`docs/fa/05-security-report.md`](docs/fa/05-security-report.md).
