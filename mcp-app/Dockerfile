FROM node:22-alpine
WORKDIR /app
# The build reads the form assets from the skill folder, so copy the whole repo.
COPY mcp-app/package.json mcp-app/package-lock.json ./mcp-app/
RUN cd mcp-app && npm ci --omit=dev
COPY . ./
RUN cd mcp-app && npm run build
WORKDIR /app/mcp-app
ENV PORT=3033 HOST=0.0.0.0 NODE_ENV=production
EXPOSE 3033
CMD ["node", "server.mjs"]
