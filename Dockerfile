# VEXARIUM frontend — self-host image (Hetzner path).
# NOTE: The app targets @sveltejs/adapter-cloudflare, whose build output lives in
# .svelte-kit/cloudflare (a Cloudflare Worker + static assets), not build/. For
# self-hosting we serve that static output with a tiny static server. The primary
# deployment target remains Cloudflare Pages (free tier); this image is optional
# infrastructure for the self-hosted path only.

FROM node:22-slim AS build
WORKDIR /app
# Yarn Berry requires a writable HOME for its cache
ENV YARN_CACHE_FOLDER=/tmp/yarn-cache
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
RUN corepack enable && yarn install --immutable
COPY . .
RUN yarn build

FROM node:22-slim AS runtime
WORKDIR /app
# Copy the adapter-cloudflare output (Worker + static assets) into a public dir.
COPY --from=build /app/.svelte-kit/cloudflare ./public
# serve static files from ./public on port 8080.
ENV NODE_ENV=production
EXPOSE 8080
CMD ["npx", "--yes", "serve", "-l", "8080", "public"]
