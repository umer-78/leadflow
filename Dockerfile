# LeadFlow — one container: the API, the background email worker and the web app.
FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app .
EXPOSE 3000
# Migrations run automatically on start.
CMD ["npm", "start"]
