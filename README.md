# Game Night Manager

An open source bot to help manage game nights on Discord.

## Features

- Allow staff to run game nights with minimal risk of granting permissions.
- Easy channel creation, management, and deletion.

## Prerequisites

- A Discord bot token.
- A Discord server with the necessary permissions to create and manage channels.
- A Cloudflare Workers account.
- A Cloudflare K/V storage object.

## Installation

This bot is designed to be deployed to Cloudflare Workers. To deploy, follow these steps:
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.example.dev.vars` to `.dev.vars.prod` and fill in the required variables.
4. Copy `example.wrangler.toml` to `wrangler.toml` and update it with the proper configuration for your server:
5. Add secrets to your Cloudflare Worker:
    - `npm run secret DISCORD_TOKEN`
    - `npm run secret DISCORD_APPLICATION_ID`
    - `npm run secret DISCORD_PUBLIC_KEY`
6. Register your bot's commands:
    - `npm run register prod`
7. Deploy your bot to Cloudflare Workers:
    - `npm run deploy`
8. Configure your bot's **Interactions Endpoint URL** in the Discord Developer Portal to point to your Cloudflare Workers URL.