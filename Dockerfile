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

# Start the application using tsx
CMD ["npm", "start"]
