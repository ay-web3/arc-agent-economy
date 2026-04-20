# Use Node 20 as the base for full ESM support
FROM node:20-slim

# Create and define the application directory
WORKDIR /usr/src/app

# Copy the dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Cloud Run expected port
ENV PORT 8080
EXPOSE 8080

# The definitive entry point at root
CMD [ "node", "index.js" ]
