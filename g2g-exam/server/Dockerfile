FROM node:22-alpine

WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

WORKDIR /app
COPY package.json /app/package.json
RUN mkdir -p /app/public/src /data/uploads
COPY vi.html styles.css enhancements.css runtime-config.js /app/public/
COPY media-worker.js /app/public/media-worker.js
RUN cp /app/public/vi.html /app/public/index.html
COPY src /app/public/src
COPY src/domain/student-profile.js /app/src/domain/student-profile.js
COPY src/domain/account-name.js /app/src/domain/account-name.js
COPY src/domain/gradebook.js /app/src/domain/gradebook.js
COPY src/domain/result-summary.js /app/src/domain/result-summary.js
COPY src/domain/attempt-review.js /app/src/domain/attempt-review.js
COPY src/domain/question-score.js /app/src/domain/question-score.js
COPY src/domain/exam-clock.js /app/src/domain/exam-clock.js
COPY src/domain/exam-last-edit.js /app/src/domain/exam-last-edit.js
COPY src/domain/exam-completion.js /app/src/domain/exam-completion.js
COPY src/domain/manual-grading.js src/domain/writing-form.js src/domain/letter-answers.js /app/src/domain/
COPY src/domain/question-display.js /app/src/domain/question-display.js
COPY src/domain/question-numbering.js /app/src/domain/question-numbering.js
COPY src/domain/part-audio.js /app/src/domain/part-audio.js
COPY src/domain/section-instructions.js /app/src/domain/section-instructions.js
COPY src/exam-specs /app/src/exam-specs
COPY src/settings/layout.js /app/src/settings/layout.js
COPY src/settings/palette.js /app/src/settings/palette.js
COPY specs /app/public/specs
COPY specs /app/specs
COPY server/runtime/runtime-config.js /app/public/runtime-config.js

COPY server/schema.sql /app/server/schema.sql
COPY server/src /app/server/src

WORKDIR /app/server
ENV NODE_ENV=production PORT=8080 UPLOAD_DIR=/data/uploads
EXPOSE 8080
CMD ["node","src/index.js"]
