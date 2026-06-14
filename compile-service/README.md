# TailorMe LaTeX compile service

A tiny, zero-dependency Node service that compiles the moderncv LaTeX produced
by the app (`src/lib/apply/latex.ts`) into a real PDF — on **your own
infrastructure**, so resume content never goes to a third party.

## Contract

```
POST /            Authorization: Bearer <COMPILE_TOKEN>   (only if token set)
Body (JSON):      { "tex": "<latex source>", "engine": "xelatex" }
200:              application/pdf  (the compiled bytes)
4xx/5xx (JSON):   { "error": "...", "log": "<tail of the TeX log>" }
GET /healthz      -> { "ok": true }
```

The Next app calls this when `LATEX_COMPILE_URL` is set (and sends
`LATEX_COMPILE_TOKEN` as the bearer token if you set one). If the service is
unreachable or unset, the app falls back to the in-app print view.

## Run it

```bash
docker build -t tailorme-latex ./compile-service
docker run -p 8080:8080 -e COMPILE_TOKEN=choose-a-long-secret tailorme-latex

# quick check
curl -s localhost:8080/healthz
```

Then in the app's `.env.local`:

```
LATEX_COMPILE_URL=http://localhost:8080
LATEX_COMPILE_TOKEN=choose-a-long-secret
```

## Deploy

Ready-made configs are included. Pick one host:

**Fly.io** (one command, uses [`fly.toml`](./fly.toml)):

```bash
cd compile-service
fly launch --copy-config --no-deploy        # choose an app name + region
fly secrets set COMPILE_TOKEN="$(openssl rand -hex 24)"
fly deploy
```

**Render** (uses [`render.yaml`](./render.yaml)): dashboard → New → Web Service →
build from this repo → Root Directory `compile-service`, Runtime `Docker`,
Health Check Path `/healthz`, add a `COMPILE_TOKEN` env var. (Or any Docker host —
Cloud Run, ECS, a Claude Managed-Agents container — the image just needs port
8080 reachable and `COMPILE_TOKEN` set.)

Then point the app at it in `.env.local` and restart:

```
LATEX_COMPILE_URL=https://<your-service-url>
LATEX_COMPILE_TOKEN=<the COMPILE_TOKEN you set>
```

`/api/applications/<id>/pdf` will now return a compiled moderncv PDF; if the
service is ever down or unset, the app silently falls back to the print view.

Keep it private/internal — the token is a second layer, not a substitute for
network isolation. Fly's config scales to zero when idle (first request after
idle cold-starts in a few seconds); set `min_machines_running = 1` to avoid that.

## Safety

- `xelatex -no-shell-escape` blocks `\write18` shell execution (RCE).
- 25s hard timeout (`SIGKILL`) and a 512 KB source cap stop runaway/oversized jobs.
- Engine is allowlisted (`xelatex`/`lualatex`/`pdflatex`); each request compiles
  in its own temp dir, removed afterward.
- Runs as a non-root user in the container.

It is still a LaTeX compiler — keep it on a private network and require the
token. Don't expose it directly to the public internet.

## Engines / packages

The image installs `texlive-xetex`, `texlive-luatex`, `texlive-latex-extra`
(which provides `moderncv`), and recommended fonts. xelatex is the default and
matches the app's request.
