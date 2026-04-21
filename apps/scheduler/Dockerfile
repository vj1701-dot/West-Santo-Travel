FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps ./apps
RUN npm install
RUN npx prisma generate --schema prisma/schema.prisma
CMD ["npm", "run", "start", "--workspace", "apps/scheduler"]
