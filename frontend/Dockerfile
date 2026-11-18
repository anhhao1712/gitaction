# Stage 1: Build React App
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .
ENV CI=true
RUN npm run build

# Stage 2: Minimal Production Server (Nginx Alpine < 25MB)
FROM nginx:stable-alpine

RUN apk upgrade --no-cache libxslt

COPY --from=builder /usr/src/app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
