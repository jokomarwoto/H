require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const play = require("play-dl");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const prefix = "!";
const queue = new Map();

client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on("messageCreate", async message => {
  if (!message.content.startsWith(prefix) || message.author.bot) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();
  const serverQueue = queue.get(message.guild.id);

  if (command === "play") {
    execute(message, args, serverQueue);
  } else if (command === "skip") {
    skip(message, serverQueue);
  } else if (command === "stop") {
    stop(message, serverQueue);
  } else if (command === "pause") {
    pause(message, serverQueue);
  } else if (command === "resume") {
    resume(message, serverQueue);
  }
});

async function execute(message, args, serverQueue) {
  const voiceChannel = message.member?.voice.channel;
  if (!voiceChannel) return message.reply("❌ Masuk ke voice channel dulu!");

  const query = args.join(" ");
  if (!query) return message.reply("❌ Masukkan link/nama lagu YouTube.");

  const yt_info = await play.search(query, { limit: 1 });
  if (!yt_info || yt_info.length < 1) return message.reply("❌ Lagu tidak ditemukan.");

  const song = { title: yt_info[0].title, url: yt_info[0].url };

  if (!serverQueue) {
    const queueConstruct = {
      voiceChannel,
      connection: null,
      songs: [],
      player: createAudioPlayer(),
    };

    queue.set(message.guild.id, queueConstruct);
    queueConstruct.songs.push(song);

    try {
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator
      });
      queueConstruct.connection = connection;
      playSong(message.guild, queueConstruct.songs[0]);
    } catch (err) {
      console.error(err);
      queue.delete(message.guild.id);
      return message.reply("❌ Error saat mencoba join VC.");
    }
  } else {
    serverQueue.songs.push(song);
    return message.reply(`🎶 Ditambahkan ke antrian: **${song.title}**`);
  }
}

async function playSong(guild, song) {
  const serverQueue = queue.get(guild.id);
  if (!song) {
    serverQueue.connection.destroy();
    queue.delete(guild.id);
    return;
  }

  const stream = await play.stream(song.url);
  const resource = createAudioResource(stream.stream, { inputType: stream.type });

  serverQueue.player.play(resource);
  serverQueue.connection.subscribe(serverQueue.player);

  serverQueue.player.on(AudioPlayerStatus.Idle, () => {
    serverQueue.songs.shift();
    playSong(guild, serverQueue.songs[0]);
  });

  const channel = serverQueue.voiceChannel;
  channel.send(`🎵 Sekarang memutar: **${song.title}**`);
}

function skip(message, serverQueue) {
  if (!serverQueue) return message.reply("❌ Tidak ada lagu yang diputar.");
  serverQueue.player.stop();
}

function stop(message, serverQueue) {
  if (!serverQueue) return message.reply("❌ Tidak ada lagu yang diputar.");
  serverQueue.songs = [];
  serverQueue.player.stop();
  serverQueue.connection.destroy();
  queue.delete(message.guild.id);
}

function pause(message, serverQueue) {
  if (!serverQueue) return message.reply("❌ Tidak ada lagu yang diputar.");
  serverQueue.player.pause();
  message.reply("⏸️ Musik dijeda.");
}

function resume(message, serverQueue) {
  if (!serverQueue) return message.reply("❌ Tidak ada lagu yang diputar.");
  serverQueue.player.unpause();
  message.reply("▶️ Musik dilanjutkan.");
}

client.login(process.env.DISCORD_TOKEN);
