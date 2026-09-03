# ---- stage 1: build the React demo console ----
# web/dist is gitignored, so it must be built here or the container falls back to the
# older hand-written panel.
FROM node:24-alpine AS ui
WORKDIR /ui
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web ./
RUN npm run build

# ---- stage 2: runtime ----
# The service itself has zero npm dependencies, so there is no install step here.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=development \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATABASE_PATH=/app/data/pillar9-voice.sqlite
COPY package.json ./
COPY src ./src
COPY scripts ./scripts
COPY datasets ./datasets
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --from=ui /ui/dist ./web/dist
RUN chmod +x /usr/local/bin/entrypoint.sh \
 && mkdir -p /app/data /app/generated \
 && chown -R node:node /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
