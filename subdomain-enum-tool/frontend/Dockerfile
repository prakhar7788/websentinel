FROM node:20-slim AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
COPY public/ ./public/
COPY src/ ./src/
RUN npm run build

# ── Production: serve with nginx ──────────────
FROM nginx:1.25-alpine

COPY --from=builder /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
