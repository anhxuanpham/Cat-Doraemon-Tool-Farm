FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including devDependencies like tsx)
RUN npm install

# Copy source code
COPY . .

# Environment variable to auto start all accounts by default
ENV AUTO_START=all

# Limit Node.js heap to 512MB so GC runs more aggressively
ENV NODE_OPTIONS="--max-old-space-size=512"

# Start the application using tsx
CMD ["npm", "start"]
