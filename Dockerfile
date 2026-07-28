FROM node:22-alpine AS build
WORKDIR /app

COPY intelligent-backoffice-frontend/package*.json ./
RUN npm ci

COPY intelligent-backoffice-frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_URL=http://host.docker.internal:5260
EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'" ]
