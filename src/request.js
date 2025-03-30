// custom http error
export class HTTPError extends Error {
    constructor(response, body, message) {
        super(message);
        this.name = 'HTTPError';
        this.response = response;
        this.body = body;
    }
}

export async function discordFetch(env, url, options) {
    options = options || {};
    url = `https://discord.com/api/v10/${url}`;
    options.headers = {
        ...options.headers || {},
        'Authorization': `Bot ${env.DISCORD_TOKEN}`,
        'User-Agent': 'DiscordBot (https://github.com/SkyKings-Guild/GameNightManager, 1.0)'
    }
    let response;
    console.log(`Fetching ${url}`);
    try {
        response = await fetch(url, options);
    } catch (error) {
        console.error('Error fetching', error);
        throw new HTTPError(null, null, `Error fetching: ${error}`);
    }
    console.log(`Response: ${response.status}`);
    const contentType = response.headers.get('content-type');
    if (!response.ok) {
        let body;
        if (contentType && contentType.includes('application/json')) {
            body = await response.json();
        } else {
            body = await response.text();
        }
        throw new HTTPError(response, body, `HTTP error! status: ${response.status}: ${body}`);
    }
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    } else {
        return await response.text();
    }
}

// Channels
export async function getGameNightChannels(env) {
    const channels = await discordFetch(env, `guilds/${env.GUILD_ID}/channels`);
    return channels.filter(channel => channel.type === 2 && channel.parent_id === env.GAME_NIGHT_CATEGORY_ID);
}

export async function getChannel(env, channelId) {
    return await discordFetch(env, `channels/${channelId}`);
}

export async function setChannelLimit(env, channelId, limit, reason) {
    return await discordFetch(env, `channels/${channelId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': reason,
        },
        body: JSON.stringify({ user_limit: limit }),
    });
}

export async function setChannelOverwrites(env, channelId, overwrites, reason) {
    return await discordFetch(env, `channels/${channelId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': reason,
        },
        body: JSON.stringify({ permission_overwrites: overwrites }),
    });
}

export async function createChannel(env, data, reason) {
    return await discordFetch(env, `guilds/${env.GUILD_ID}/channels`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': reason,
        },
        body: JSON.stringify(data),
    });
}

export async function deleteChannel(env, channelId, reason) {
    return await discordFetch(env, `channels/${channelId}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-Audit-Log-Reason': reason,
        },
    });
}

export async function sendMessage(env, channelId, data) {
    return await discordFetch(env, `channels/${channelId}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}


// User
export async function getUserVoiceState(env, userId) {
    return await discordFetch(env, `guilds/${env.GUILD_ID}/voice-states/${userId}`);
}

export async function moveUserToChannel(env, userId, channelId) {
    return await discordFetch(env, `guilds/${env.GUILD_ID}/members/${userId}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel_id: channelId }),
    });
}

// Interactions
export async function createInteractionResponse(env, interaction, data) {
    await discordFetch(env, `interactions/${interaction.id}/${interaction.token}/callback`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function editOriginalInteractionResponse(env, interaction, data) {
    await discordFetch(env, `webhooks/${interaction.application_id}/${interaction.token}/messages/@original`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}

export async function sendInteractionFollowup(env, interaction, data) {
    await discordFetch(env, `webhooks/${interaction.application_id}/${interaction.token}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    });
}