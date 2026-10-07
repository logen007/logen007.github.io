FROM node:22-alpine

WORKDIR /app/server
COPY server/package.json ./package.json
RUN npm install --omit=dev

WORKDIR /app
RUN mkdir -p /app/public/src /data/uploads
COPY vi.html styles.css enhancements.css runtime-config.js /app/public/
RUN cp /app/public/vi.html /app/public/index.html
COPY src /app/public/src
COPY specs /app/public/specs
COPY specs /app/specs
COPY server/runtime/runtime-config.js /app/public/runtime-config.js

COPY server/schema.sql /app/server/schema.sql
COPY server/src /app/server/src

WORKDIR /app/server
ENV NODE_ENV=production PORT=8080 UPLOAD_DIR=/data/uploads
EXPOSE 8080
CMD ["node","src/index.js"]
