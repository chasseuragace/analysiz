# Use a smaller base image for Node.js (Alpine Linux-based)
FROM node:14-alpine

# Set the working directory in the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json files to the container
COPY package*.json ./

# Install only production dependencies (faster and lighter)
RUN npm install --only=production

# Copy the rest of the application files to the container
COPY . .

# Expose the application's port (optional, if the app runs on a specific port)
# EXPOSE 3000

# Define the command to run the application
CMD ["node", "src/index.js"]
