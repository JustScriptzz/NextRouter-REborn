import { verifyKey } from 'discord-interactions';
import { getOrCreateKey, regenerateKey } from '@/lib/discord-keys';

export const runtime = 'edge';

const DISCORD_PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY || '';

// Discord's HTTP-only interactions endpoint: no persistent gateway
// connection, so this runs as a plain serverless/edge function like the
// rest of the app (no separate bot process to host). Register the
// /getkey and /regenkey slash commands once with
// scripts/register-discord-commands.mjs, then set this URL as the
// "Interactions Endpoint URL" in the Discord Developer Portal.
export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519') || '';
  const timestamp = req.headers.get('x-signature-timestamp') || '';
  const rawBody = await req.text();

  if (!DISCORD_PUBLIC_KEY) {
    return new Response('DISCORD_PUBLIC_KEY not configured', { status: 500 });
  }

  const isValid = await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
  if (!isValid) {
    return new Response('invalid request signature', { status: 401 });
  }

  const body = JSON.parse(rawBody) as {
    type: number;
    data?: { name?: string };
    member?: { user?: { id?: string } };
    user?: { id?: string };
  };

  // PING
  if (body.type === 1) {
    return Response.json({ type: 1 });
  }

  // APPLICATION_COMMAND
  if (body.type === 2) {
    const name = body.data?.name;
    const discordUserId = body.member?.user?.id ?? body.user?.id;

    if (!discordUserId) {
      return Response.json({
        type: 4,
        data: { content: 'Could not identify your Discord account.', flags: 64 },
      });
    }

    if (name === 'getkey') {
      const { key, created } = await getOrCreateKey(discordUserId);
      return Response.json({
        type: 4,
        data: {
          content: created
            ? `Your private API key:\n\`\`\`${key}\`\`\`\nKeep it secret - it's tied to your Discord account. Use \`/regenkey\` if it ever leaks.`
            : `You already have a key:\n\`\`\`${key}\`\`\`\nUse \`/regenkey\` to replace it.`,
          flags: 64, // ephemeral: only the caller sees it
        },
      });
    }

    if (name === 'regenkey') {
      const key = await regenerateKey(discordUserId);
      return Response.json({
        type: 4,
        data: {
          content: `New private API key (the old one no longer works):\n\`\`\`${key}\`\`\``,
          flags: 64,
        },
      });
    }

    return Response.json({ type: 4, data: { content: 'Unknown command.', flags: 64 } });
  }

  return new Response('unhandled interaction type', { status: 400 });
}
