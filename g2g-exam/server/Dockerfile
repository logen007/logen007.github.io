FROM node:22-alpine
WORKDIR /app/server
COPY server/package.json ./package.json
RUN npm install --omit=dev
WORKDIR /app
RUN mkdir -p /app/public/src /data/uploads
COPY vi.html index.html app.html styles.css enhancements.css /app/public/
COPY src /app/public/src
COPY server/runtime/repository.js /app/public/src/repository.js
COPY server/runtime/settings.js /app/public/src/settings.js
COPY server/runtime/media.js /app/public/src/media.js
COPY server/runtime/firebase-config.js /app/public/firebase-config.js
COPY server/schema.sql /app/server/schema.sql
COPY server/src /app/server/src
WORKDIR /app/server
ENV NODE_ENV=production PORT=8080 UPLOAD_DIR=/data/uploads
EXPOSE 8080
CMD ["node","src/index.js"]
