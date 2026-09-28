# Production deploy — app behind Caddy (HTTPS) + Authelia (login + TOTP)

This runs the **production** build of supasec (not `next dev`) with a real
login screen and a one-time-password (authenticator app) second factor. Only
Caddy is exposed (80/443); the app and Authelia stay on the internal network.

## What you need first

- A server with Docker + Docker Compose (your EC2 box).
- **A domain you control.** Authelia's login/SSO and automatic HTTPS need real
  hostnames — a bare IP won't get a Let's Encrypt cert and Authelia's session
  cookies won't behave. Pick a base domain, e.g. `supasec.nodetp.com.br`.
- Two DNS **A records** pointing at the server's public IP:
  - `supasec.nodetp.com.br`  → the app
  - `auth.supasec.nodetp.com.br` → the login portal
- Ports **80 and 443** open to the internet in the security group.
  (Also **close 3000** — it should not be reachable anymore.)

## First-run checklist

1. **Domain is already set** to `supasec.nodetp.com.br` (app) and
   `auth.supasec.nodetp.com.br` (portal). Just set a real ACME email in
   `deploy/Caddyfile` (the `email` line) so Let's Encrypt can notify you.

2. **Create the secrets file:**
   ```bash
   cp .env.prod.example .env.prod
   printf 'AUTHELIA_SESSION_SECRET=%s\n' "$(openssl rand -hex 64)" >> .env.prod
   printf 'AUTHELIA_STORAGE_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 64)" >> .env.prod
   ```
   (Remove the empty placeholder lines so each key appears once.)

3. **Set your operator password hash** in `deploy/authelia/users_database.yml`:
   ```bash
   docker run --rm authelia/authelia:4.38 \
     authelia crypto hash generate argon2 --password 'YOUR-STRONG-PASSWORD'
   ```
   Paste the `$argon2id$...` output as `password:` and set a real `email:`.

4. **Bring it up:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

5. **Log in and enroll TOTP.** Open `https://supasec.nodetp.com.br` → you'll be sent
   to the portal → sign in with your password → Authelia asks you to register a
   one-time-password device. The confirmation link is written to
   `deploy/authelia/notification.txt` (filesystem notifier, no email needed):
   ```bash
   docker compose -f docker-compose.prod.yml exec authelia cat /config/notification.txt
   ```
   Open that link, scan the QR with your authenticator app, done. Next logins ask
   for password + the 6-digit code.

## Verify it's actually production (not dev)

```bash
curl -s https://supasec.nodetp.com.br | grep -o 'hmr-client\|next-devtools' && echo "STILL DEV" || echo "prod ok"
```
`prod ok` means the dev/HMR chunks are gone. Also confirm `http://<ip>:3000` no
longer answers from outside once port 3000 is closed.

## Notes / caveats

- **No domain yet?** You can test with Caddy self-signed certs by adding
  `tls internal` inside each site block, but browsers will warn and Authelia on a
  bare IP is unreliable — get a domain for anything real.
- Pin versions: Authelia is `4.38` here. If it rejects a config key after an
  image bump, check `docker compose -f docker-compose.prod.yml logs authelia`.
- Runtime files under `deploy/authelia/` (`db.sqlite3`, `notification.txt`) and
  `.env.prod` are gitignored — keep them off version control.
