## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result. If running locally

I am running this on a VPS, so allowing it to be accessible via the internet. You can access my portfolio site by nativating to https://oi.loftrop.com which is portfolio spelled in reverse order.
Every Time I push commit to the main branch, the VPS is confgiured with Github Actions and the new version of the site goes live. If any content is needed for the site that is too large for GitHub, 
I use google cloud content servers, so those files will not be provided in this repo. Note that sensitive things such as api keys and my Personal details such as my CV are not included. 

## VPS stack scripts

Use the master script for normal VPS operations:

```bash
sudo bash scripts/website-stack-vps.sh setup
sudo bash scripts/website-stack-vps.sh deploy
sudo bash scripts/website-stack-vps.sh status
```

The lower-level scripts remain available for targeted operations:

```bash
sudo bash scripts/bootstrap-app-vps.sh
sudo bash scripts/deploy-rustfs-vps.sh
sudo bash scripts/deploy-app-vps.sh
```

Hierarchy:

- `website-stack-vps.sh` orchestrates the full website VPS flow.
- `bootstrap-app-vps.sh` fetches OpenBao secrets and writes deploy env files.
- `deploy-rustfs-vps.sh` starts RustFS, OAuth2 Proxy, and the media Caddy.
- `deploy-app-vps.sh` starts the Next.js website and website Caddy.
