import {
    InteractionResponseFlags,
    InteractionResponseType,
    InteractionType,
    verifyKey,
} from 'discord-interactions';
import { processCommands } from './commands.js';

class JsonResponse extends Response {
  constructor(body, init) {
    const jsonBody = JSON.stringify(body);
    init = init || {
      headers: {
        'content-type': 'application/json;charset=UTF-8',
      },
    };
    super(jsonBody, init);
  }
}

async function verifyDiscordRequest(request, env) {
    const signature = request.headers.get('x-signature-ed25519');
    const timestamp = request.headers.get('x-signature-timestamp');
    const body = await request.text();
    const isValidRequest =
      signature &&
      timestamp &&
      (await verifyKey(body, signature, timestamp, env.DISCORD_PUBLIC_KEY));
    if (!isValidRequest) {
      return { isValid: false };
    }
  
    return { interaction: JSON.parse(body), isValid: true };
  }

async function processDiscordRequest(request, env, ctx) {
    try {
        const { isValid, interaction } = await verifyDiscordRequest(
            request,
            env,
        );
        if (!isValid || !interaction) {
            console.error('Bad request signature.');
            return new Response('Bad request signature.', { status: 401 });
        }

        if (interaction.type === InteractionType.PING) {
            return new JsonResponse({
            type: InteractionResponseType.PONG,
            });
        }

        if (interaction.type === InteractionType.APPLICATION_COMMAND) {
            // Permission Check
            if (interaction.guild_id !== env.GUILD_ID) {
                return new JsonResponse(
                    {
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: "❌ This command can only be used in the game night server.",
                            flags: InteractionResponseFlags.EPHEMERAL,
                        }
                    }
                )
            }
            const member_roles = interaction.member.roles;
            const member_permissions = interaction.member.permissions;
            const staff_roles = env.STAFF_ROLE_IDS;
            if (!(staff_roles.some(role => member_roles.includes(role)) || (member_permissions & 0x8 === 0x8))) {
                return new JsonResponse(
                    {
                        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                        data: {
                            content: "❌ You do not have permission to use this command.",
                            flags: InteractionResponseFlags.EPHEMERAL,
                        }
                    }
                )
            }
            ctx.waitUntil(
                processCommands(
                    env,
                    interaction,
                )
            );
            return new JsonResponse(
                {
                    type: InteractionResponseType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, 
                    data: {flags: InteractionResponseFlags.EPHEMERAL}
                }
            );
        }
        
        console.error('Unknown Type');
        return new JsonResponse(
            {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: {
                    content: "❌ Unknown interaction type.",
                    flags: InteractionResponseFlags.EPHEMERAL,
                }
            }
        )
    } catch (error) {
        console.log('Error processing request:', error);
        console.error('Error processing request:', error);
        return new Response('Internal Server Error', { status: 500 });
  }
};

async function handleFetch(request, env, ctx) {
    if (request.method === 'POST') {
        return await processDiscordRequest(request, env, ctx);
    }
    return new Response('Method Not Allowed', { status: 405 });
}

const server = {
    fetch: handleFetch,
};

export default server;
