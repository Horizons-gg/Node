# Use official Node.js LTS image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm install

# Copy the rest of the project
COPY . .

# Expose the port your Next.js app runs on
EXPOSE 5006

# Start the Next.js app
CMD ["npm", "start"]