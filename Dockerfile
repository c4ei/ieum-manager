FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN apk add --no-cache su-exec && npm ci --omit=dev
COPY . .
RUN addgroup -S ieum && adduser -S ieum -G ieum && chown -R ieum:ieum /app \
    && chmod 755 /app/docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
EXPOSE 8787
CMD ["node","server.js"]
