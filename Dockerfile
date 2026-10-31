# Étape 1 : vérification des types et construction du front
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build && npm prune --omit=dev

# Étape 2 : image finale. Le back est exécuté directement en TypeScript par Node.
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production DB_PATH=/data/budget.db PORT=3000
RUN mkdir /data && chown node:node /data \
 && printf '#!/bin/sh\nexec node /app/backend/src/cli.ts "$@"\n' > /usr/local/bin/budget-cli \
 && chmod +x /usr/local/bin/budget-cli
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist/frontend ./dist/frontend
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "backend/src/main.ts"]
