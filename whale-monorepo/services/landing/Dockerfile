FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run build

ENV PORT=3000
EXPOSE 3000

# Run as non-root user
RUN addgroup --system app && adduser --system --ingroup app app \
  && chown -R app:app /app
USER app

CMD ["npm", "run", "start"]
