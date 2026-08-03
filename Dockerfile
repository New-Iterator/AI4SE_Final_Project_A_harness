FROM node:20 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20
WORKDIR /workspace
COPY --from=builder /app/dist/ ./dist/
COPY --from=builder /app/node_modules/ ./node_modules/
COPY package.json ./
EXPOSE 3456
ENTRYPOINT ["node", "dist/src/index.js"]