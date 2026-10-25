# Hugging Face Space image for the public live runner. The source is the public GitHub
# repository at an exact commit, so the running Space matches a reviewable revision.
FROM mcr.microsoft.com/playwright:v1.64.1-noble
ARG TABSTITCH_COMMIT=__COMMIT__
ADD https://codeload.github.com/cs113062273-bot/Nebius---NVIDIA-Global-AI-Hackathon/tar.gz/${TABSTITCH_COMMIT} /tmp/source.tgz
RUN mkdir -p /app && tar -xzf /tmp/source.tgz -C /app --strip-components=1 && rm /tmp/source.tgz \
 && cd /app && npm ci --ignore-scripts --omit=dev \
 && mkdir -p /app/artifacts/runs /app/artifacts/inference && chmod -R 777 /app/artifacts
WORKDIR /app
ENV HOST=0.0.0.0 PORT=7860 PUBLIC_DEMO=true LIVE_REPAIR=true LIVE_NEBIUS_TESTS=true NEBIUS_SPONSOR_CREDITS_CONFIRMED=true LIVE_DAILY_USD=1 LIVE_TOTAL_USD=10 TABSTITCH_LANDING=live.html TABSTITCH_COMMIT=${TABSTITCH_COMMIT}
EXPOSE 7860
CMD ["node", "src/server.js"]
