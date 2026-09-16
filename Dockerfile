FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install only production dependencies
RUN npm install --production

# Copy built artifacts from the host environment
COPY dist ./dist

# Create a data directory for the local database
RUN mkdir -p data

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
