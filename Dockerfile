# LEAKS — image de production
FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .
# Some VPS working copies may retain restrictive source-file permissions.
# The runtime user must still be able to read the application after a release.
RUN chmod -R a+rX /app
EXPOSE 3000
USER node

# Les migrations se rejouent à chaque démarrage (idempotentes),
# puis le serveur prend le trafic.
CMD ["sh", "-c", "node server/scripts/migrate.mjs && node server/app.mjs"]
