FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN apk add --no-cache postgresql16-client
COPY --from=build --chown=node:node /app ./
COPY --from=build --chown=node:node /app/public ./.next/standalone/public
COPY --from=build --chown=node:node /app/.next/static ./.next/standalone/.next/static
USER node
EXPOSE 3000
CMD ["node", ".next/standalone/server.js"]
