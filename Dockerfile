# Multi-stage build for SignLens AI (Express + Vite + WebSockets)
FROM node:22-alpine AS builder

WORKDIR /app

# Copy dependency configs
COPY package*.json ./

# Install all dependencies for build
RUN npm install --legacy-peer-deps

# Copy source files
COPY . .

# Build Vite SPA client
RUN npm run build

# Production runtime image
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Install production dependencies
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps

# Copy built frontend assets and server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./server.ts
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data

# Expose HTTP / WebSocket port (Google Cloud Run default is 8080)
EXPOSE 8080

# Start server
CMD ["npm", "start"]
