# AWS EC2 Deployment Guide

## Goal

This guide is the public-repo runbook for hosting this stack on AWS EC2 with Docker, a domain, HTTPS, and the required credentials.

It is written so someone can clone the public repository, add their own private values on the server, and bring the system online without reverse-engineering local assumptions.

## What stays public vs private

Safe to keep in the public repository:

- `docker-compose.yml`
- `docker-compose.ec2.yml`
- `deploy/Caddyfile.ec2`
- `.env.example`
- `workflows/whatsapp-ai-auto-reply.json`
- `scripts/bootstrap-n8n-credentials.sh`
- `connect-ui` source
- documentation in `docs/`

Never commit to the public repository:

- real `.env` files
- OpenAI API keys
- Evolution API keys
- WooCommerce consumer keys and secrets
- SSH private keys such as `.pem`
- n8n exports containing encrypted credentials
- database files, backups, or screenshots containing business data

This repo already tracks the template file `.env.example`. Create the real `.env` only on the server.

## Recommended AWS shape

### Operating system

Use:

- Ubuntu Server 24.04 LTS

Ubuntu 22.04 LTS is also fine, but 24.04 LTS is the cleaner default for a fresh EC2 build.

### EC2 instance size

Use one of these:

1. `t3.small` or `t4g.small` for low-traffic testing and pilot usage
2. `t3.medium` or `t4g.medium` for the better small-production baseline

Avoid:

- `t3.micro`
- free-tier sized instances for production

Reason:

- this stack runs n8n, Evolution API, PostgreSQL, Redis, and Connect UI together
- 1 GB RAM is too tight for reliable always-on automation

### Storage

Use:

- 30 GB gp3 minimum for test deployments
- 60 GB gp3 preferred for production

### Security group

Open only these inbound ports:

- `22` from your office IP or your own IP only
- `80` from `0.0.0.0/0`
- `443` from `0.0.0.0/0`

Do not expose these publicly unless you intentionally want them reachable:

- `5678`
- `8080`
- `3000`
- PostgreSQL
- Redis

The recommended design is:

- expose only `80/443`
- put n8n and Connect UI behind a reverse proxy
- keep Evolution API internal if possible

## Domain layout

Recommended subdomains:

- `n8n.example.com` for the n8n editor and webhook base
- `connect.example.com` for the Connect UI

Optional but not recommended unless needed:

- `evolution.example.com` for Evolution API

If you expose Evolution publicly, protect it behind authentication, allowlists, or Cloudflare/WAF controls.

## Step 1: Create the EC2 instance

In AWS:

1. Open EC2.
2. Click Launch instance.
3. Name it something like `whatsapp-automation-prod`.
4. Select `Ubuntu Server 24.04 LTS`.
5. Choose `t3.small` for low traffic or `t3.medium` for a safer baseline.
6. Create or select an SSH key pair.
7. Set storage to at least `30 GB`, preferably `60 GB` gp3.
8. Attach the security group described above.
9. Launch the instance.

After launch, note:

- public IPv4 address
- elastic IP if you assign one
- instance DNS name

Use an Elastic IP for anything intended to stay live. That avoids DNS changes if the instance stops or is rebuilt.

## Step 2: Point your domain to the EC2 instance

In Route 53 or your DNS provider:

1. Create an `A` record for `n8n.example.com` pointing to the Elastic IP.
2. Create an `A` record for `connect.example.com` pointing to the same Elastic IP.
3. Wait for DNS to resolve.

You can validate with:

```bash
dig +short n8n.example.com
dig +short connect.example.com
```

## Step 3: SSH into the server

From your machine:

```bash
chmod 400 your-key.pem
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## Step 4: Update the server and install Docker

Run these commands on the EC2 instance:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl gnupg git ufw
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

Optional firewall hardening:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Step 5: Clone the public repository

Choose a deployment directory and clone the repo:

```bash
mkdir -p ~/apps
cd ~/apps
git clone https://github.com/sanjuacodez/whatsapp-automation.git
cd whatsapp-automation
```

If the repository visibility is still private on GitHub, change it manually in GitHub:

1. Open the repository on GitHub.
2. Go to `Settings`.
3. Open `General`.
4. Scroll to `Danger Zone`.
5. Use `Change repository visibility`.
6. Switch to `Public` only after confirming no secrets are committed.

I cannot change GitHub visibility directly from this workspace.

## Step 6: Create the production `.env`

On the EC2 instance:

```bash
cp .env.example .env
```

Edit it:

```bash
nano .env
```

Recommended production values:

```env
COMPOSE_PROJECT_NAME=whatsapp-ai-auto-reply
TZ=Asia/Kolkata

OPENAI_API_KEY=sk-live-key-here
HUMAN_HANDOFF_WEBHOOK_URL=

EVOLUTION_API_KEY=replace-with-a-long-random-secret
EVOLUTION_INSTANCE=live-whatsapp

# Recommended internal container-to-container URL
EVOLUTION_SERVER_URL=http://evolution-api:8080

WOOCOMMERCE_BASE_URL=https://shop.example.com
WOOCOMMERCE_CONSUMER_KEY=ck_live_key
WOOCOMMERCE_CONSUMER_SECRET=cs_live_secret

N8N_HOST=n8n.example.com
N8N_PORT=5678
N8N_PROTOCOL=https
N8N_EDITOR_BASE_URL=https://n8n.example.com
N8N_WEBHOOK_URL=https://n8n.example.com/
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=replace-with-a-strong-n8n-password
N8N_NODE_TLS_REJECT_UNAUTHORIZED=1

POSTGRES_USER=evolution
POSTGRES_PASSWORD=replace-with-a-strong-db-password
POSTGRES_DB=evolution

REDIS_URL=redis://redis:6379/6
```

Important notes:

- keep `.env` only on the server
- do not commit `.env`
- for production, `N8N_NODE_TLS_REJECT_UNAUTHORIZED` should be `1`
- using `EVOLUTION_SERVER_URL=http://evolution-api:8080` keeps Evolution private inside Docker

## Step 7: Start the containers once

From the project root on the server:

```bash
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ec2.yml up -d
docker compose ps
```

The EC2 override does three important things:

- binds `n8n`, `connect-ui`, and `evolution-api` to `127.0.0.1` only
- enables n8n basic auth for the editor
- adds no-new-privileges and log rotation defaults

Check logs if needed:

```bash
docker compose logs -f n8n evolution-api connect-ui
```

## Step 8: Add a reverse proxy and HTTPS

Use Caddy because it is simple and handles HTTPS automatically.

Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

This repo already includes a ready-to-use production file at `deploy/Caddyfile.ec2`.

Create the Caddy config:

```bash
sudo cp deploy/Caddyfile.ec2 /etc/caddy/Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Replace these placeholders before reloading Caddy:

- `n8n.example.com`
- `connect.example.com`
- optionally `evolution.example.com` if you intentionally expose Evolution

Reload Caddy:

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

After DNS is ready, Caddy will automatically request TLS certificates.

## Step 9: Open n8n and finish the owner account

Open:

- `https://n8n.example.com`

If this is a fresh server:

1. Complete the n8n owner setup.
2. Confirm the editor loads correctly over HTTPS.

## Step 10: Configure credentials for OpenAI and WooCommerce

You have two supported paths.

### Option A: Bootstrap credentials from `.env`

Run:

```bash
./scripts/bootstrap-n8n-credentials.sh
```

This creates or updates the native n8n credentials expected by the workflow:

- `OpenAI account`
- `WooCommerce account`

Use this option when you want the server to rebuild the required n8n credentials automatically.

### Option B: Create credentials manually in n8n

In n8n:

1. Open `Credentials`.
2. Create `OpenAI account` using your OpenAI API key.
3. Create `WooCommerce account` using:
   - store URL
   - consumer key
   - consumer secret
4. Test both credentials.

Use this option when you want all application credentials managed inside n8n instead of server scripts.

### Which credentials belong where?

Use n8n Credentials for:

- OpenAI
- WooCommerce

Use `.env` for infrastructure/runtime values:

- Evolution API key
- Evolution instance name
- n8n host and webhook URLs
- Postgres password
- timezone
- optional handoff webhook

The Connect UI does not store OpenAI or WooCommerce credentials. It helps with:

- WhatsApp QR and pairing flow
- webhook restore
- instance settings restore
- quick access to the n8n credentials page

## Step 11: Import and activate the workflow

In n8n:

1. Import `workflows/whatsapp-ai-auto-reply.json`.
2. Save the workflow.
3. Confirm the credential bindings resolve.
4. Activate the workflow.

If you used the bootstrap script first, the workflow should bind to the expected native credentials automatically.

## Step 12: Connect WhatsApp with the Connect UI

Open:

- `https://connect.example.com`

Then:

1. Check that the instance state loads.
2. Use QR scan or phone pairing.
3. Wait for the state to become `open`.
4. Click webhook restore if needed.
5. Click settings restore if needed.

The Connect UI talks to Evolution inside Docker and uses the n8n base URL from `.env`.

## Step 13: Validate the live stack

Test these in order:

1. `https://n8n.example.com` loads
2. `https://connect.example.com` loads
3. n8n workflow is active
4. OpenAI credential works
5. WooCommerce credential works
6. WhatsApp instance is connected
7. product question returns a product-backed reply
8. order-status question returns an order-backed reply
9. payment or store-info question returns the configured reply path
10. image or refund/account question still routes to human handoff

## Optional: expose Evolution behind a domain

Recommended only if you really need external API access.

If you must expose it:

1. Add `evolution.example.com` DNS.
2. Add a third Caddy site block.
3. Reverse proxy it to `127.0.0.1:8080`.
4. Protect it with IP allowlists or another access control layer.

Example Caddy block:

```caddy
evolution.example.com {
    reverse_proxy 127.0.0.1:8080
}
```

If you expose Evolution publicly, review `EVOLUTION_SERVER_URL` and use the public HTTPS URL only if the rest of your workflow and admin tooling need it.

## Updating the server later

To pull changes from the public repo:

```bash
cd ~/apps/whatsapp-automation
git pull
docker compose --env-file .env -f docker-compose.yml -f docker-compose.ec2.yml up -d --build
```

If workflow or credential logic changed:

1. rerun `./scripts/bootstrap-n8n-credentials.sh`
2. re-import the workflow if needed
3. run end-to-end tests again

## Backup checklist

Back up these before major upgrades:

- `.env` in a secure password manager or secrets vault
- Docker volume for `/home/node/.n8n`
- Postgres volume
- Redis volume if you rely on persistence
- Evolution volume

## Final public-repo checklist

Before pushing to GitHub as a public repo, verify:

1. `.env` is not tracked
2. no private `.pem` or certificate files are tracked
3. no exported n8n credentials are tracked
4. no database dumps or SQLite files are tracked
5. only `.env.example` contains placeholder values
6. all real secrets exist only on the server or inside n8n credentials