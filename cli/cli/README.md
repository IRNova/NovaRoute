# NovaRoute - FREE AI Router & Token Saver

**Never stop coding. Save 20-40% tokens with RTK + auto-fallback to FREE & cheap AI models.**

**Connect All AI Code Tools (Claude Code, Cursor, Antigravity, Copilot, Codex, Gemini, OpenCode, Cline, OpenClaw...) to 40+ AI Providers & 100+ Models.**

> **Not published yet.** The npm, Docker Hub, GHCR and website badges that used
> to sit here all pointed at the upstream author's releases, not at anything
> IRNova ships. They have been removed rather than left to imply this build is
> the one on the registry. Build from source until IRNova publishes its own.

---

## 🤔 Why NovaRoute?

**Stop wasting money, tokens and hitting limits:**

- ❌ Subscription quota expires unused every month
- ❌ Rate limits stop you mid-coding
- ❌ Tool outputs (git diff, grep, ls...) burn tokens fast
- ❌ Expensive APIs ($20-50/month per provider)

**NovaRoute solves this:**

- ✅ **RTK Token Saver** - Auto-compress tool_result, save 20-40% tokens
- ✅ **Maximize subscriptions** - Track quota, use every bit before reset
- ✅ **Auto fallback** - Subscription → Cheap → Free, zero downtime
- ✅ **Multi-account** - Round-robin between accounts per provider
- ✅ **Universal** - Works with any OpenAI/Claude-compatible CLI

---

## ⚡ Quick Start

**Option 1 — from source (desktop):**

```bash
git clone <this repo> novaroute && cd novaroute
cp .env.example .env          # set JWT_SECRET and INITIAL_PASSWORD
npm install
npm run build && npm start
```

> `npm install -g novaroute` installs the upstream author's package, not this
> build. Do not use it to install this fork.

**Option 2 — Docker (server/VPS):**

```bash
docker build -t novaroute:local .

docker run -d --name novaroute -p 20128:20128 \
  -v "$HOME/.novaroute:/app/data" -e DATA_DIR=/app/data \
  novaroute:local
```

See [DOCKER.md](../DOCKER.md) for the full container guide.

🎉 Dashboard opens at `http://localhost:20128`

**2. Connect a FREE provider (no signup needed):**

Dashboard → Providers → Connect **Kiro AI** (free Claude unlimited) or **OpenCode Free** (no auth) → Done!

**3. Use in your CLI tool:**

```
Claude Code/Codex/OpenClaw/Cursor/Cline Settings:
  Endpoint: http://localhost:20128/v1
  API Key:  [copy from dashboard]
  Model:    kr/claude-sonnet-4.5
```

That's it! Start coding with FREE AI models.

---

## 🚀 CLI Options

```bash
NovaRoute                    # Start with default settings
NovaRoute --port 8080        # Custom port
NovaRoute --no-browser       # Don't open browser
NovaRoute --skip-update      # Skip auto-update check
NovaRoute --help             # Show all options
```

**Dashboard**: `http://localhost:20128/dashboard`

---

## 🛠️ Supported CLI Tools

Claude-Code • OpenClaw • Codex • OpenCode • Cursor • Antigravity • Cline • Continue • Droid • Roo • Copilot • Kilo Code • Gemini CLI • Qwen Code • iFlow • Crush • Crusher • Aider

Any tool supporting OpenAI/Claude-compatible API works.

---

## 💾 Data Location

- **macOS/Linux**: `~/.novaroute/db/data.sqlite`
- **Windows**: `%APPDATA%/novaroute/db/data.sqlite`
- **Docker**: `/app/data/db/data.sqlite` (mount `$HOME/.novaroute` to persist)

---

## 📚 Documentation

Docs live in this repo:

- **Architecture**: [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md)
- **Docker**: [`DOCKER.md`](../DOCKER.md)
- **Agent skills**: [`skills/README.md`](../skills/README.md)
- **Changelog**: [`CHANGELOG.md`](../CHANGELOG.md)

---

## 🙏 Acknowledgments

- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** - Original Go implementation

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.
