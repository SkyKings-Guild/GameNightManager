/**
 * Share command metadata from a common spot to be used for both runtime
 * and registration.
 */

import { LOCKED_OVERWRITES, STAFF_OVERWRITES, USER_OVERWRITES, LOCK_PERMISSIONS, BOT_OVERWRITES } from "./constants.js";
import { editOriginalInteractionResponse, getGameNightChannels, setChannelLimit, getUserVoiceState, getChannel, HTTPError, createChannel, deleteChannel, moveUserToChannel, setChannelOverwrites, sendMessage, sendInteractionFollowup } from "./request.js";

export const SET_LIMIT = {
    name: 'set-limit',
    description: 'Set user limit for all game night channels.',
    options: [
        {
            type: 4,
            name: 'limit',
            description: 'The user limit for new game night channels. 0 for infinite',
            required: true,
            min_value: 0,
            max_value: 99,
        },
        {
            type: 5,
            name: 'existing',
            description: 'Whether to update existing game night channels. Default false.',
            required: false,
        }
    ],
};

export async function setLimitCommand(env, interaction) {
    const limit = interaction.data.options.find(option => option.name === 'limit').value;
    const existing = interaction.data.options.find(option => option.name === 'existing')?.value || false;
    try {
        await env.KV.put("user-limit", limit);
    } catch (e) {
        console.error('Error setting user limit', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error setting user limit.'
        });
    }
    if (existing) {
        try {
            const channels = await getGameNightChannels(env);
            const promises = channels.map(channel => setChannelLimit(
                env, channel.id, limit, 
                `${interaction.member.user.username} ${interaction.member.user.id} set user limit for all game night channels`
            ));
            if (existing) {
                await Promise.all(promises);
            }
            return await editOriginalInteractionResponse(env, interaction, {
                content: `✅ User limit set to \`${limit}\`.\n✅ ${promises.length} channels updated.`
            });
        } catch (e) {
            console.error('Error updating existing channels', e);
            return await editOriginalInteractionResponse(env, interaction, {
                content: `✅  User limit set to \`${limit}\`.\n❌ Error updating existing channels.`
            });
        }
    }
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ User limit set to \`${limit}\`.\n✅ Existing channels were not updated.`
    });
}

export const SET_CHANNEL_LIMIT = {
    name: 'set-channel-limit',
    description: 'Set user limit for a specific game night channel.',
    options: [
        {
            type: 4,
            name: 'limit',
            description: 'The user limit for the game night channel. 0 for infinite',
            required: true,
            min_value: 0,
            max_value: 99,
        },
        {
            type: 7,
            name: 'channel',
            description: 'The game night channel to set the limit for. Blank to default to user\'s current VC.',
            required: false,
            channel_types: [2],
        },
    ],
};

export async function setChannelLimitCommand(env, interaction) {
    const limit = interaction.data.options.find(option => option.name === 'limit').value;
    let channel = interaction.data.options.find(option => option.name === 'channel')?.value || null;
    let channel_data;
    if (!channel) {
        try {
            const userVoiceState = await getUserVoiceState(env, interaction.member.user.id);
            if (!userVoiceState || !userVoiceState.channel_id) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            channel = userVoiceState.channel_id;
        } catch (e) {
            // check http error
            if (e instanceof HTTPError && e.response.status === 404) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Error getting user voice state.'
            });
        }
        channel_data = await getChannel(env, channel);
    } else {
        channel_data = interaction.data.resolved.channels[channel];
    }
    if (!channel_data) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error resolving channel.'
        });
    }
    if (channel_data.type !== 2) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a voice channel.'
        });
    }
    if (channel_data.parent_id !== env.GAME_NIGHT_CATEGORY_ID) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a game night channel.'
        });
    }
    try {
        await setChannelLimit(env, channel, limit, `${interaction.member.user.username} ${interaction.member.user.id} set channel limit`);
    } catch (e) {
        console.error('Error setting user limit', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error setting user limit.'
        });
    }
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ User limit set to \`${limit}\` for <#${channel}>.`
    });
}

export const CREATE_CHANNEL = {
    name: 'create-channel',
    description: 'Create a new game night channel.',
    options: [
        {
            type: 3,
            name: 'name',
            description: 'The name for the game night channel. Will be shown as 🎮 {name}',
            required: true,
        },
        {
            type: 5,
            name: 'move',
            description: 'Whether to move the user to the new channel. Default true.',
            required: false,
        },
        {
            type: 5,
            name: 'locked',
            description: 'Whether to lock the new channel. Default false.',
            required: false,
        }
    ]
};

export async function createChannelCommand(env, interaction) {
    const limit = await env.KV.get("user-limit");
    if (limit === null || limit === undefined) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ User limit not set. Please run `/set-limit` first.'
        });
    }
    const name = interaction.data.options.find(option => option.name === 'name').value;
    let mv = interaction.data.options.find(option => option.name === 'move')?.value;
    const locked = interaction.data.options.find(option => option.name === 'locked')?.value || false;
    const move = mv === undefined ? true : mv;
    try {
        const existing = await getGameNightChannels(env);
        if (existing.length >= 10) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Maximum number of game night channels reached.'
            });
        }
    } catch (e) {
        console.error('Error getting existing channels', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error getting existing channels.'
        });
    }
    const STAFF_ROLE_IDS = env.STAFF_ROLE_IDS;
    const USER_ROLE_ID = env.USER_ROLE_ID || env.GUILD_ID;
    const BANNED_ROLE_ID = env.BANNED_ROLE_ID;
    const BOT_ID = env.DISCORD_APPLICATION_ID;
    const overwrites = [
        {
            id: USER_ROLE_ID,
            type: 0,
            ...(locked ? LOCKED_OVERWRITES : USER_OVERWRITES)
        },
        {
            id: BOT_ID,
            type: 1,
            ...BOT_OVERWRITES
        },
    ]
    if (USER_ROLE_ID !== env.GUILD_ID) {
        overwrites.push({
            id: env.GUILD_ID,
            type: 0,
            ...LOCKED_OVERWRITES
        });
    }
    if (BANNED_ROLE_ID) {
        overwrites.push({
            id: BANNED_ROLE_ID,
            type: 0,
            ...LOCKED_OVERWRITES
        });
    }
    for (const role of STAFF_ROLE_IDS) {
        overwrites.push({
            id: role,
            type: 0,
            ...STAFF_OVERWRITES
        });
    }
    let channel;
    try {
        channel = await createChannel(env, {
            name: `🎮 ${name}`,
            type: 2,
            parent_id: env.GAME_NIGHT_CATEGORY_ID,
            user_limit: limit,
            permission_overwrites: overwrites,
        }, `${interaction.member.user.username} ${interaction.member.user.id} created game night channel`)
    } catch (e) {
        console.error('Error creating channel', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error creating channel.'
        });
    }
    if (move) {
        try {
            await moveUserToChannel(env, interaction.member.user.id, channel.id);
        } catch (e) {
            if (e instanceof HTTPError && e.response.status === 400) {
                const data = e.body;
                if (data.code !== 40032) {
                    console.error('Error moving user to channel', e);
                }
            } else { 
                console.error('Error moving user to channel', e);
            }
        }
    }
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ Game night channel created: <#${channel.id}>`
    });
}

export const DELETE_CHANNEL = {
    name: 'delete-channel',
    description: 'Delete a game night channel.',
    options: [
        {
            type: 7,
            name: 'channel',
            description: 'The game night channel to delete. Blank to default to user\'s current VC.',
            required: false,
            channel_types: [2],
        },
    ],
};

export async function deleteChannelCommand(env, interaction) {
    let channel = interaction.data.options?.find(option => option.name === 'channel')?.value || null;
    let channel_data;
    if (!channel) {
        try {
            const userVoiceState = await getUserVoiceState(env, interaction.member.user.id);
            if (!userVoiceState || !userVoiceState.channel_id) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            channel = userVoiceState.channel_id;
        } catch (e) {
            // check http error
            if (e instanceof HTTPError && e.response.status === 404) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Error getting user voice state.'
            });
        }
        channel_data = await getChannel(env, channel);
    } else {
        channel_data = interaction.data.resolved.channels[channel];
    }
    if (!channel_data) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error resolving channel.'
        });
    }
    if (channel_data.type !== 2) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a voice channel.'
        });
    }
    if (channel_data.parent_id !== env.GAME_NIGHT_CATEGORY_ID) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a game night channel.'
        });
    }
    try {
        await deleteChannel(env, channel, `${interaction.member.user.username} ${interaction.member.user.id} deleted game night channel`);
    } catch (e) {
        console.error('Error deleting channel', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error deleting channel.'
        });
    }
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ Deleted \`${channel_data.name}\`.`
    });
}

export const CREATE_CHANNELS = {
    name: 'create-channels',
    description: 'Create multiple game night channels.',
    options: [
        {
            type: 4,
            name: 'count',
            description: 'The number of channels to create.',
            required: true,
            min_value: 1,
            max_value: 10,
        },
        {
            type: 3,
            name: 'name',
            description: 'The base name for the game night channels. Will be shown as 🎮 {name} {number}',
            required: true,
        },
        {
            type: 5,
            name: 'move',
            description: 'Whether to move the user to the first new channel. Default true.',
            required: false,
        },
        {
            type: 5,
            name: 'locked',
            description: 'Whether to lock the new channels. Default false.',
            required: false,
        }
    ]
}

export async function createChannelsCommand(env, interaction) {
    const count = interaction.data.options.find(option => option.name === 'count').value;
    const name = interaction.data.options.find(option => option.name === 'name').value;
    let mv = interaction.data.options.find(option => option.name === 'move')?.value;
    let locked = interaction.data.options.find(option => option.name === 'locked')?.value;
    const move = mv === undefined ? true : mv;
    const limit = await env.KV.get("user-limit");
    if (limit === null || limit === undefined) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ User limit not set. Please run `/set-limit` first.'
        });
    }
    let position = 0;
    try {
        const existing = await getGameNightChannels(env);
        if (existing.length + count > 10) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Maximum number of game night channels reached.'
            });
        }
        position = Math.max(...existing.map(channel => channel.position)) + 1;
    } catch (e) {
        console.error('Error getting existing channels', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error getting existing channels.'
        });
    }
    const STAFF_ROLE_IDS = env.STAFF_ROLE_IDS;
    const USER_ROLE_ID = env.USER_ROLE_ID || env.GUILD_ID;
    const BANNED_ROLE_ID = env.BANNED_ROLE_ID;
    const BOT_ID = env.DISCORD_APPLICATION_ID;
    const overwrites = [
        {
            id: USER_ROLE_ID,
            type: 0,
            ...(locked ? LOCKED_OVERWRITES : USER_OVERWRITES)
        },
        {
            id: BOT_ID,
            type: 1,
            ...BOT_OVERWRITES
        },
    ]
    if (USER_ROLE_ID !== env.GUILD_ID) {
        overwrites.push({
            id: env.GUILD_ID,
            type: 0,
            ...LOCKED_OVERWRITES
        });
    }
    if (BANNED_ROLE_ID) {
        overwrites.push({
            id: BANNED_ROLE_ID,
            type: 0,
            ...LOCKED_OVERWRITES
        });
    }
    for (const role of STAFF_ROLE_IDS) {
        overwrites.push({
            id: role,
            type: 0,
            ...STAFF_OVERWRITES
        });
    }
    const promises = Array.from({ length: count }).map(async (_, i) => {
        try {
            const channel = await createChannel(env, {
                name: `🎮 ${name} ${i + 1}`,
                type: 2,
                parent_id: env.GAME_NIGHT_CATEGORY_ID,
                user_limit: limit,
                position: position + i,
                permission_overwrites: overwrites,
            }, `${interaction.member.user.username} ${interaction.member.user.id} created ${count} game night channels`);
            if (move && i === 0) {
                try {
                    await moveUserToChannel(env, interaction.member.user.id, channel.id);
                } catch (e) {
                    if (e instanceof HTTPError && e.response.status === 400) {
                        const data = e.body;
                        if (data.code !== 40032) {
                            console.error('Error moving user to channel', e);
                        }
                    } else { 
                        console.error('Error moving user to channel', e);
                    }
                }
            }
            return channel;
        } catch (e) {
            console.error('Error creating channel', e);
            return null;
        }
    });
    // create in correct order
    const channels = await Promise.all(promises);
    const created = channels.filter(channel => channel !== null);
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ Created ${created.length} game night channels.`
    });
}

export const DELETE_ALL_CHANNELS = {
    name: 'delete-all-channels',
    description: 'Delete all game night channels.',
};

export async function deleteAllChannelsCommand(env, interaction) {
    try {
        const channels = await getGameNightChannels(env);
        const promises = channels.map(channel => deleteChannel(
            env, channel.id, 
            `${interaction.member.user.username} ${interaction.member.user.id} deleted all game night channels`
        ));
        await Promise.all(promises);
        await editOriginalInteractionResponse(env, interaction, {
            content: `✅ Deleted ${promises.length} game night channels.`
        });
    } catch (e) {
        console.error('Error deleting channels', e);
        await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error deleting channels.'
        });
    }
}


export const MOVE = {
    name: 'move',
    description: 'Move a user to a different channel.',
    options: [
        {
            type: 6,
            name: 'user',
            description: 'The user to move.',
            required: true,
        },
        {
            type: 7,
            name: 'channel',
            description: 'The game night channel to move the user to. Leave blank to just disconnect them.',
            channel_types: [2],
        }
    ]
}

export async function moveCommand(env, interaction) {
    const user = interaction.data.options.find(option => option.name === 'user').value;
    const member_data = interaction.data.resolved.members[user];
    member_data.user = interaction.data.resolved.users[user];
    if (!member_data) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error resolving user.'
        });
    }
    if (!member_data.user) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error resolving user.'
        });
    }
    if (env.STAFF_ROLE_IDS.some(role => member_data.roles.includes(role))) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Staff cannot be moved.'
        });
    }
    const channel = interaction.data.options.find(option => option.name === 'channel')?.value || null;
    if (channel) {
        const channel_data = interaction.data.resolved.channels[channel];
        if (!channel_data) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Error resolving channel.'
            });
        }
        if (channel_data.type !== 2) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Channel must be a voice channel.'
            });
        }
        if (channel_data.parent_id !== env.GAME_NIGHT_CATEGORY_ID) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Channel must be a game night channel.'
            });
        }
    }
    // Fetch member voice state
    let userVoiceState;
    try {
        userVoiceState = await getUserVoiceState(env, member_data.user.id);
    } catch (e) {
        if (e instanceof HTTPError && e.response.status === 400) {
            const data = e.body;
            if (data.code === 40032) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ User is not in voice.'
                });
            }
        }
        console.error('Error fetching voice state', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error fetching user voice state.'
        });
    }
    if (!userVoiceState || !userVoiceState.channel_id) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ User is not in voice.'
        });
    }
    if (channel && userVoiceState.channel_id === channel) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '✅ User is already in that channel.'
        });
    }
    try {
        const userChannel = await getChannel(env, userVoiceState.channel_id);
        if (userChannel.parent_id !== env.GAME_NIGHT_CATEGORY_ID) {
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ User is not in a game night channel.'
            });
        }
    } catch (e) {
        console.error('Error fetching user channel', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error fetching user channel.'
        });
    }
    try {
        await moveUserToChannel(env, member_data.user.id, channel);
    } catch (e) {
        if (e instanceof HTTPError && e.response.status === 400) {
            const data = e.body;
            if (data.code === 40032) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ User is not in voice.'
                });
            }
        }
        console.error('Error moving user to channel', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error moving user to channel.'
        });
    }
    if (channel) {
        await editOriginalInteractionResponse(env, interaction, {
            content: `✅ Moved <@${member_data.user.id}> to <#${channel}>.`
        });
    } else {
        await editOriginalInteractionResponse(env, interaction, {
            content: `✅ Disconnected <@${member_data.user.id}>.`
        });
    }
}

export const LOCK = {
    name: 'lock',
    description: 'Lock a game night channel.',
    options: [
        {
            type: 6,
            name: 'channel',
            description: 'The game night channel to lock. Blank to default to user\'s current VC.',
            required: false,
            channel_types: [2],
        }
    ]
}

export const UNLOCK = {
    name: 'unlock',
    description: 'Unlock a game night channel.',
    options: [
        {
            type: 6,
            name: 'channel',
            description: 'The game night channel to unlock. Blank to default to user\'s current VC.',
            required: false,
            channel_types: [2],
        }
    ]
}

export async function lockCommand(env, interaction, lock) {
    let channel = interaction.data.options?.find(option => option.name === 'channel')?.value || null;
    let channel_data;
    if (!channel) {
        try {
            const userVoiceState = await getUserVoiceState(env, interaction.member.user.id);
            if (!userVoiceState || !userVoiceState.channel_id) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            channel = userVoiceState.channel_id;
        } catch (e) {
            // check http error
            if (e instanceof HTTPError && e.response.status === 404) {
                return await editOriginalInteractionResponse(env, interaction, {
                    content: '❌ You must be in a voice channel to use this command, or specify a channel.'
                });
            }
            return await editOriginalInteractionResponse(env, interaction, {
                content: '❌ Error getting user voice state.'
            });
        }
        channel_data = await getChannel(env, channel);
    } else {
        channel_data = interaction.data.resolved.channels[channel];
    }
    if (!channel_data) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error resolving channel.'
        });
    }
    if (channel_data.type !== 2) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a voice channel.'
        });
    }
    if (channel_data.parent_id !== env.GAME_NIGHT_CATEGORY_ID) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Channel must be a game night channel.'
        });
    }
    const overwrites = channel_data.permission_overwrites;
    const user_overwrites = overwrites.find(overwrite => overwrite.id === (env.USER_ROLE_ID || env.GUILD_ID));
    if (!user_overwrites) {
        return await editOriginalInteractionResponse(env, interaction, {
            content: '❌ Error finding user overwrite.'
        });
    }
    if (lock) {
        user_overwrites.allow = user_overwrites.allow & ~LOCK_PERMISSIONS;
        user_overwrites.deny = user_overwrites.deny | LOCK_PERMISSIONS;
    } else {
        user_overwrites.allow = user_overwrites.allow | LOCK_PERMISSIONS;
        user_overwrites.deny = user_overwrites.deny & ~LOCK_PERMISSIONS;
    }
    try {
        await setChannelOverwrites(env, channel, overwrites, `${interaction.member.user.username} ${interaction.member.user.id} ${lock ? 'locked' : 'unlocked'} game night channel`);
    } catch (e) {
        console.error('Error setting overwrites', e);
        return await editOriginalInteractionResponse(env, interaction, {
            content: `❌ Error ${lock ? 'locking' : 'unlocking'} channel.`
        });
    }
    await editOriginalInteractionResponse(env, interaction, {
        content: `✅ ${lock ? 'Locked' : 'Unlocked'} <#${channel}>.`
    });
}


export const COMMANDS = [SET_LIMIT, SET_CHANNEL_LIMIT, CREATE_CHANNEL, DELETE_CHANNEL, CREATE_CHANNELS, DELETE_ALL_CHANNELS, MOVE, LOCK, UNLOCK];

export async function processCommands(env, interaction) {
    // sleep a tiny bit to make sure we respond *after* discord gets the return
    // idk if this is needed, but its here
    // await new Promise(r=> setTimeout(()=>r(), 5));
    try {
        switch (interaction.data.name.toLowerCase()) {
            case SET_LIMIT.name.toLowerCase(): {
                await setLimitCommand(env, interaction);
                return;
            }
            case SET_CHANNEL_LIMIT.name.toLowerCase(): {
                await setChannelLimitCommand(env, interaction);
                return;
            }
            case CREATE_CHANNEL.name.toLowerCase(): {
                await createChannelCommand(env, interaction);
                return;
            }
            case DELETE_CHANNEL.name.toLowerCase(): {
                await deleteChannelCommand(env, interaction);
                return;
            }
            case CREATE_CHANNELS.name.toLowerCase(): {
                await createChannelsCommand(env, interaction);
                return;
            }   
            case DELETE_ALL_CHANNELS.name.toLowerCase(): {
                await deleteAllChannelsCommand(env, interaction);
                return;
            }
            case MOVE.name.toLowerCase(): {
                await moveCommand(env, interaction);
                return;
            }
            case LOCK.name.toLowerCase(): {
                await lockCommand(env, interaction, true);
                return;
            }
            case UNLOCK.name.toLowerCase(): {
                await lockCommand(env, interaction, false);
                return;
            }
            default: {
                await editOriginalInteractionResponse(env, interaction, {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: {
                        content: "❌ Unknown Command",
                        flags: InteractionResponseFlags.EPHEMERAL,
                    }
                });
                return;
            }
        }
    } catch (e) {
        console.error('Error processing command', e);
        await sendInteractionFollowup(env, interaction, {
            content: '❌ Error processing command.'
        });
        await sendMessage(env, env.LOG_CHANNEL_ID, {
            content: `Error processing command: \`${interaction.data.name}\`\n${e.stack}`,
            embeds: [],
            allowed_mentions: {
                parse: [],
                users: [],
                roles: [],
            },
        });
    }
}