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

(For production, deploy the container to your platform — Fly.io, Cloud Run,
Render, ECS, or a Claude Managed-Agents container — and point
`LATEX_COMPILE_URL` at its URL. Keep it private/internal; the token is a second
layer, not a substitute for network isolation.)

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
