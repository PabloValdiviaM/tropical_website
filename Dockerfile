# Etapa 1: Construir el frontend
FROM node:20-alpine AS build-frontend
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

# Etapa 2: Servidor backend + frontend construido
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
COPY --from=build-frontend /app/web/dist ./web/dist
EXPOSE 3000
CMD ["node", "server.cjs"]