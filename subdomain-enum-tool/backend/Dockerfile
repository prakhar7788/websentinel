FROM node:20-slim

# Install docker CLI so we can exec into the recon-tools container
RUN apt-get update && apt-get install -y docker.io && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 4000

CMD ["node", "src/index.js"]
