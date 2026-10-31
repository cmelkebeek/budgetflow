# Étape 1 : vérification des types, construction du front, dépendances de production.
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm run build && npm prune --omit=dev \
 # Fichiers inutiles à l'exécution : définitions de types, sourcemaps, documentation.
 && find node_modules -type f \( -name '*.d.ts' -o -name '*.d.mts' -o -name '*.d.cts' -o -name '*.map' -o -name '*.md' \) -delete
# Exécutable node allégé de ses symboles de débogage (~17 Mo).
RUN apk add --no-cache binutils && cp /usr/local/bin/node /tmp/node && strip /tmp/node

# Étape 2 : image finale minimale. On repart d'un Alpine nu (même version que node:24-alpine) avec seulement
# l'exécutable node : npm, yarn et les en-têtes C de l'image node officielle n'y sont pas.
# Le back est exécuté directement en TypeScript par Node.
FROM alpine:3.24
RUN apk add --no-cache libstdc++ \
 && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node \
 && mkdir /data && chown node:node /data \
 && printf '#!/bin/sh\nexec node /app/backend/src/cli.ts "$@"\n' > /usr/local/bin/budget-cli \
 && chmod +x /usr/local/bin/budget-cli
COPY --from=build /tmp/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production DB_PATH=/data/budget.db PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist/frontend ./dist/frontend
USER node
VOLUME /data
EXPOSE 3000
CMD ["node", "backend/src/main.ts"]
