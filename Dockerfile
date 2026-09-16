FROM node:20-alpine

WORKDIR /app

# Copy all files
COPY package.json package-lock.json ./
COPY . .

# บังคับให้ติดตั้งเครื่องมือสำหรับ Build ด้วย
RUN npm install --include=dev
RUN npm run build

# Create a data directory for the local database
RUN mkdir -p data

# Expose port 3000
EXPOSE 3000

# Start the application
CMD ["npm", "run", "start"]
