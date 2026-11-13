FROM node:25-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Unprivileged image: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Rendered at start-up by the image's envsubst step; needs OPAMP_BACKEND_URL.
COPY docker/nginx.conf /etc/nginx/templates/default.conf.template
ENV OPAMP_BACKEND_URL=http://opamp-api:8080
EXPOSE 8080
