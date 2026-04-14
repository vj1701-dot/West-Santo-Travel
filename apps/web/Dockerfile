FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
COPY . .
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace", "apps/web"]
