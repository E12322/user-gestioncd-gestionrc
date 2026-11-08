# Build complete du workspace puis lancement du microservice.
# Contexte de build : racine de backend-residences/ (docker compose y fait reference).
FROM node:20-alpine AS build
WORKDIR /repo
COPY . .
RUN npm install --no-audit --no-fund && npm run build:contracts && npm run build --workspace @residences/chambres

FROM node:20-alpine
WORKDIR /repo
COPY --from=build /repo .
WORKDIR /repo/apps/chambres
EXPOSE 3011
CMD ["node", "dist/main.js"]
