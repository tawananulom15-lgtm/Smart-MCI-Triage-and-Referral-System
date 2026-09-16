FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY package.json package-lock.json ./
COPY . .

# Install dependencies and build the app inside Docker
RUN npm install
RUN npm run build

# Create a data directory for the local database
RUN mkdir -p data

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
