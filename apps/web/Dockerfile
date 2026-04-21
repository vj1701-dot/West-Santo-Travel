FROM node:24-alpine AS runner
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

# Install postgresql client for database checks
RUN apk add --no-cache postgresql-client

COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts

RUN npm install
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build --workspace apps/web

# Make bootstrap script executable
RUN chmod +x scripts/bootstrap-db.sh

ENV NODE_ENV=production
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "apps/web"]
