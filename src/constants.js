// Permissions
export const MANAGE_CHANNELS = 1 << 4;
export const ADD_REACTIONS = 1 << 6;
export const PRIORITY_SPEAKER = 1 << 8;
export const STREAM = 1 << 9;
export const VIEW_CHANNEL = 1 << 10;
export const SEND_MESSAGES = 1 << 11;
export const EMBED_LINKS = 1 << 14;
export const ATTACH_FILES = 1 << 15;
export const READ_MESSAGE_HISTORY = 1 << 16;
export const USE_EXTERNAL_EMOJIS = 1 << 18;
export const CONNECT = 1 << 20;
export const SPEAK = 1 << 21;
export const MUTE_MEMBERS = 1 << 22;
export const DEAFEN_MEMBERS = 1 << 23;
export const MOVE_MEMBERS = 1 << 24;
export const USE_VAD = 1 << 25;
export const MANAGE_ROLES = 1 << 28;
export const USE_EXTERNAL_STICKERS = 1 << 37;
export const USE_EMBEDDED_ACTIVITIES = 1 << 39;
export const USE_SOUNDOARD = 1 << 42;
export const USE_EXTERNAL_SOUNDS = 1 << 45;
export const SEND_VOICE_MESSAGES = 1 << 46;
export const SEND_POLLS = 1 << 49;
export const USE_EXTERNAL_APPS = 1 << 50;

export const STAFF_PERMISSIONS = PRIORITY_SPEAKER | STREAM | VIEW_CHANNEL | SEND_MESSAGES | 
    READ_MESSAGE_HISTORY | CONNECT | SPEAK | USE_VAD | 
    USE_EMBEDDED_ACTIVITIES | USE_SOUNDOARD;

export const USER_PERMISSIONS = VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES |
    READ_MESSAGE_HISTORY | USE_EXTERNAL_EMOJIS | CONNECT | USE_VAD | SPEAK | STREAM;
    
export const LOCK_PERMISSIONS = CONNECT;

export const BOT_PERMISSIONS = MANAGE_CHANNELS | VIEW_CHANNEL | SEND_MESSAGES | EMBED_LINKS | ATTACH_FILES | READ_MESSAGE_HISTORY | 
    MUTE_MEMBERS | DEAFEN_MEMBERS | MOVE_MEMBERS | MANAGE_ROLES | SEND_VOICE_MESSAGES | SEND_POLLS | USE_EXTERNAL_APPS;


export const STAFF_OVERWRITES = {
    allow: STAFF_PERMISSIONS,
}

export const USER_OVERWRITES = {
    allow: USER_PERMISSIONS,
}

export const LOCKED_OVERWRITES = {
    deny: LOCK_PERMISSIONS,
}

export const BOT_OVERWRITES = {
    allow: BOT_PERMISSIONS,
}
