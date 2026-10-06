FROM node:22-alpine
WORKDIR /app/server
COPY server/package.json ./package.json
RUN npm install --omit=dev
WORKDIR /app
RUN mkdir -p /app/public/src /data/uploads
COPY vi.html index.html app.html styles.css enhancements.css /app/public/
RUN cp /app/public/vi.html /app/public/index.html
COPY src /app/public/src
# Production runs through the VPS REST API. Patch legacy demo-only Firebase wording/guard in the copied frontend.
RUN sed -i "s/if(repo.mode!=='firebase'){notify('Chưa cấu hình Firebase. Hãy dùng tài khoản thử nghiệm bên dưới.');return;}/if(repo.mode==='local'){notify('Đây là bản demo cục bộ. Đăng nhập Google chỉ hoạt động trên máy chủ G2G.');return;}/" /app/public/src/app.js \
 && sed -i "s/Khi cấu hình Firebase, hệ thống tự chuyển sang đăng nhập Google và dữ liệu thật./Bản demo cục bộ trên trình duyệt; dữ liệu không phải dữ liệu thật./" /app/public/src/app.js
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
