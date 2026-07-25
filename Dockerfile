FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# El navegador llega al front y al BFF por el mismo origen (nginx). Baked en build.
ARG VITE_PURCHASE_BFF_URL=http://localhost:8080
ENV VITE_PURCHASE_BFF_URL=$VITE_PURCHASE_BFF_URL
RUN npm run build

FROM nginx:1.27-alpine AS runner
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
