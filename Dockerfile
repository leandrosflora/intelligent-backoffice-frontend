FROM node:22-alpine AS build
WORKDIR /app

COPY intelligent-backoffice-frontend/package*.json ./
RUN npm ci

COPY intelligent-backoffice-frontend/ ./
RUN npm run build

FROM nginx:1.27-alpine
RUN apk add --no-cache gettext

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY nginx/config.js.template /etc/nginx/templates/config.js.template
COPY --from=build /app/dist /usr/share/nginx/html

ENV BACKEND_URL=http://host.docker.internal:5260
ENV AUTH_MODE=headers
ENV OIDC_AUTHORITY=
ENV OIDC_CLIENT_ID=
ENV OIDC_SCOPE="openid profile"
ENV OIDC_AUDIENCE=
EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$BACKEND_URL' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && envsubst '$AUTH_MODE $OIDC_AUTHORITY $OIDC_CLIENT_ID $OIDC_SCOPE $OIDC_AUDIENCE' < /etc/nginx/templates/config.js.template > /usr/share/nginx/html/config.js && nginx -g 'daemon off;'" ]
