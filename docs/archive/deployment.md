# Deployment status

The local workbench runs at `http://127.0.0.1:4317`. No always-on public browser execution service has been deployed. A Docker configuration is supplied, but Docker is not installed/available in this session, so container build/run is unverified.

To self-host on a genuinely free existing machine: build the provided image, bind its published port to loopback behind a TLS proxy, provide `PUBLIC_DEMO=true` and a private random `DEMO_TOKEN` of at least 24 characters. Give judges the token in testing instructions. Live mode additionally requires confirmed sponsor-only Token Factory credentials. Never put credentials in the image or frontend. Keep the process and quota available through December 15 judging; test a fresh judge run before publishing a claim.

Cloudflare Worker static hosting cannot execute Node/Chromium. Any Sites evidence gallery must explicitly state that it replays recorded artifacts; it is not the live inference agent or a substitute for the working test build. Public repository and video publication remain separate deliverables.
