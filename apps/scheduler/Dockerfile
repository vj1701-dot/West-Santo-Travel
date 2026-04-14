FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps ./apps
RUN npm install
CMD ["npm", "run", "start", "--workspace", "apps/scheduler"]
