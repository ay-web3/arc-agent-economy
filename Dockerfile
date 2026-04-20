# Use Node 20 as the base for full ESM support
FROM node:20-slim

# Align with Cloud Run's expected workdir logic
WORKDIR /workspace

# Copy the dependency manifests
COPY package*.json ./

# Install production dependencies only
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Cloud Run expected port
ENV PORT 8080
EXPOSE 8080

# Hardened absolute path entrypoint
CMD [ "node", "/workspace/index.js" ]
