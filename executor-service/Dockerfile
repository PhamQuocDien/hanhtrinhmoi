FROM node:20-alpine
RUN apk add --no-cache docker-cli
WORKDIR /srv
COPY server.js package.json ./
ENV NODE_ENV=production EXECUTOR_PORT=8090
EXPOSE 8090
USER root
CMD ["node", "server.js"]
