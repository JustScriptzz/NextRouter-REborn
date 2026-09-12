// One-time setup: registers the /getkey and /regenkey slash commands with
// Discord. Run locally after creating a bot in the Discord Developer
// Portal (discord.com/developers/applications):
//
//   DISCORD_APPLICATION_ID=... DISCORD_BOT_TOKEN=... node scripts/register-discord-commands.mjs
//
// Then in the same app's "General Information" tab, set the
// "Interactions Endpoint URL" to:
//   https://<your-deployment>/api/discord/interactions
// and copy the "Public Key" shown there into the DISCORD_PUBLIC_KEY env
// var on Vercel. No gateway connection, no always-on bot process needed.

const appId = process.env.DISCORD_APPLICATION_ID;
const token = process.env.DISCORD_BOT_TOKEN;

if (!appId || !token) {
  console.error('Set DISCORD_APPLICATION_ID and DISCORD_BOT_TOKEN env vars first.');
  process.exit(1);
}

const commands = [
  {
    name: 'getkey',
    description: 'Get your private NextRouter API key (creates one if you don\'t have it yet)',
    type: 1,
  },
  {
    name: 'regenkey',
    description: 'Invalidate your current NextRouter API key and get a new one',
    type: 1,
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${appId}/commands`, {
  method: 'PUT',
  headers: {
    Authorization: `Bot ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(commands),
});

if (!res.ok) {
  console.error('Failed:', res.status, await res.text());
  process.exit(1);
}

console.log('Registered commands:', await res.json());
