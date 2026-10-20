FROM mcr.microsoft.com/playwright:v1.64.1-noble
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --omit=dev
COPY --chown=pwuser:pwuser src ./src
COPY --chown=pwuser:pwuser public ./public
COPY --chown=pwuser:pwuser fixtures ./fixtures
COPY --chown=pwuser:pwuser benchmarks ./benchmarks
RUN mkdir -p /app/artifacts && chown -R pwuser:pwuser /app/artifacts
USER pwuser
ENV HOST=0.0.0.0 PORT=4317 PUBLIC_DEMO=true
EXPOSE 4317
CMD ["node", "src/server.js"]
