# Rolling Tools

A mobile-friendly dungeon master toolbox with 3D dice rolling, configurable named dice presets, a stateful card deck, draw history, shuffle, refill, empty-deck handling, and optional Discord channel history.

## Discord channel history

Rolling Tools can post every new dice roll and card draw to a Discord channel as a rich message:

1. In Discord, open the channel settings and create an incoming webhook under **Integrations → Webhooks**.
2. Copy the webhook URL.
3. Open **Connect Discord** in Rolling Tools, paste the URL, and connect.
4. Roll dice or draw cards. New results will be posted automatically.

The webhook URL is stored only in that browser's local storage. It is never committed to this repository or included in the production bundle. Treat it like a password: anyone with the URL can post to the channel. Use **Disconnect** to remove it from the browser, and delete or rotate the webhook in Discord if it is ever exposed.

This zero-backend connection is intended for a private group. A public multi-user deployment should replace it with a Discord app plus a server-side bot or Activity integration so no shared channel credential is stored in a browser.

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The GitHub Pages workflow publishes `dist` from the `main` branch.
