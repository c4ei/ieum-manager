FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN addgroup -S ieum && adduser -S ieum -G ieum && chown -R ieum:ieum /app
USER ieum
EXPOSE 8787
CMD ["node","server.js"]
