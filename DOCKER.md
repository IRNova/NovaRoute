# Docker

Run NovaRoute in a container by building the image from this repo.

> **No `IRNova/novaroute` image published yet.** Every command below builds
> locally instead. Once an image is published to a registry, swap the
> `docker build` steps for a `docker pull` and restore the `image:` line in
> `docker-compose.yml`.

---

# 👤 For Users

## Quick start

```bash
docker build -t novaroute:local .

docker run -d \
  -p 20128:20128 \
  -v "$HOME/.novaroute:/app/data" \
  -e DATA_DIR=/app/data \
  --name novaroute \
  novaroute:local
```

App listens on port `20128`. Open: http://localhost:20128

Or with compose, which builds the image for you:

```bash
docker compose up -d
```

## Manage container

```bash
docker logs -f novaroute        # view logs
docker stop novaroute           # stop
docker start novaroute          # start again
docker rm -f novaroute          # remove
```

## Data persistence

```bash
-v "$HOME/.novaroute:/app/data" \
-e DATA_DIR=/app/data
```

Without `DATA_DIR`, the app falls back to `~/.novaroute/` (macOS/Linux) or `%APPDATA%\novaroute\` (Windows). In the container, `DATA_DIR=/app/data` makes the bind mount work.

Data layout under `$DATA_DIR/`:

```text
$DATA_DIR/
├── db/
│   ├── data.sqlite       # main SQLite database
│   └── backups/          # auto backups
└── ...                   # certs, logs, runtime configs
```

Host path: `$HOME/.novaroute/db/data.sqlite`
Container path: `/app/data/db/data.sqlite`

## Optional env vars

```bash
docker run -d \
  -p 20128:20128 \
  -v "$HOME/.novaroute:/app/data" \
  -e DATA_DIR=/app/data \
  -e PORT=20128 \
  -e HOSTNAME=0.0.0.0 \
  -e DEBUG=true \
  --name novaroute \
  novaroute:local
```

## Optional Headroom sidecar

The NovaRoute image does not bundle Python or Headroom. Headroom is a separate
third-party project and powers only the Token Saver page; the gateway runs fine
without it. It is behind a compose profile so it is never pulled unless you ask
for it:

```bash
docker compose --profile headroom up -d
```

To run it by hand instead, start it as its own service and point NovaRoute at it:

```yaml
services:
  novaroute:
    build:
      context: .
    ports:
      - "20128:20128"
    volumes:
      - "$HOME/.novaroute:/app/data"
    environment:
      DATA_DIR: /app/data
      HEADROOM_URL: http://headroom:8787

  headroom:
    image: ghcr.io/chopratejas/headroom:latest
    ports:
      - "8787:8787"
```

In the dashboard, open `Endpoint` → `Token Saver` → `Headroom`, confirm the URL is `http://headroom:8787`, recheck status, then enable Headroom.

If Headroom runs on the Docker host instead of as a sidecar, use `http://host.docker.internal:8787` on macOS/Windows. On Linux, add `--add-host=host.docker.internal:host-gateway` or the equivalent compose `extra_hosts` entry.

## Update

Pull the latest source, rebuild, and recreate the container:

```bash
git pull
docker compose up -d --build
```

---

# 🛠 For Developers

## Build image locally

```bash
docker build -t novaroute:local .

docker run --rm -p 20128:20128 \
  -v "$HOME/.novaroute:/app/data" \
  -e DATA_DIR=/app/data \
  novaroute:local
```

## Publish

Not wired up yet. Publishing needs a registry namespace owned by IRNova (for
example `ghcr.io/IRNova/novaroute`) and a workflow with IRNova credentials
before it is turned back on.
