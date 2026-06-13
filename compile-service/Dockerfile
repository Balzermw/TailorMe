# LaTeX compile service for TailorMe — Node handler on a TeX Live base.
# Includes xelatex/lualatex/pdflatex + moderncv (texlive-latex-extra).
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      nodejs \
      texlive-xetex \
      texlive-luatex \
      texlive-latex-extra \
      texlive-fonts-recommended \
      lmodern \
      fontconfig \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Run as a non-root user.
RUN useradd --create-home --uid 10001 tex
WORKDIR /app
COPY server.js ./
USER tex

ENV PORT=8080
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
