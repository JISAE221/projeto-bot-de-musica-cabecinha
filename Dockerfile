FROM node:22-slim

RUN apt-get update && apt-get install -y python3 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY cabecinhabot.js .
COPY config.json .

CMD ["node", "cabecinhabot.js"]
