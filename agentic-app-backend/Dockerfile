# syntax=docker/dockerfile:1
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# 1. Install dependencies first, so this layer is cached until package files change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# 2. Then copy the source (see .dockerignore: no .env, tests or node_modules)
COPY tsconfig.json index.ts ./
COPY src ./src

# 3. Never run as root
USER node

EXPOSE 4200

# Passwords and keys come from the environment (compose / your host), never from the image.
# Plain `node --import tsx` is used instead of `npm start`, because `npm start` loads a .env file that is not in the image.
CMD ["node", "--import", "tsx", "index.ts"]