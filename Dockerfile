# Etapa 1: Construir el frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# Etapa 2: Backend + Frontend construido
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps
COPY --from=build-frontend /app/dist ./dist
COPY server.cjs ./
EXPOSE 3000
CMD ["node", "server.cjs"]