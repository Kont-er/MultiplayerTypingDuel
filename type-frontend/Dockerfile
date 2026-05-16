# Step 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code
COPY . .

# Run the build - this creates the /app/dist folder
RUN npm run build

# Step 2: Serve
FROM nginx:stable-alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy the build output from the 'dist' folder to nginx
# Note: Vite defaults to 'dist'. If your config uses 'build', change 'dist' to 'build' below.
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]