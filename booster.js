const { Client, GatewayIntentBits, Partials, REST, Routes } = require("discord.js")
const SteamUser = require("steam-user")
const axios = require("axios")
const express = require("express")
const path = require("path")
const WebSocket = require("ws")
const fs = require("fs")
const { send } = require("process")
require("dotenv").config()

let config
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"))
  console.log("✅ Configuration loaded successfully")
} catch (error) {
  console.error("❌ Error loading configuration:", error)
  config = {}
}

const app = express()
app.use(express.static(path.join(__dirname)))
app.use(express.json())

const discordClient = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] })

let targetChannelId = config.targetChannelId || ""
let serverID = config.serverID || ""
let steamUsername = config.steamUsername || ""
let steamPassword = config.steamPassword || ""
let webhookURL = config.webhookURL || ""
let gameIds = config.gameIds || [730]

const steamClient = new SteamUser()
const PERSONA_STATES = {
  OFFLINE: SteamUser.EPersonaState.Offline,
  ONLINE: SteamUser.EPersonaState.Online,
  BUSY: SteamUser.EPersonaState.Busy,
  AWAY: SteamUser.EPersonaState.Away,
  SNOOZE: SteamUser.EPersonaState.Snooze,
  LOOKING_TO_TRADE: SteamUser.EPersonaState.LookingToTrade,
  LOOKING_TO_PLAY: SteamUser.EPersonaState.LookingToPlay,
  INVISIBLE: SteamUser.EPersonaState.Invisible,
}

let username = steamUsername
let password = steamPassword
let boosting = false
let startTime = null
const timerInterval = null
let statusInterval = null

const wss = new WebSocket.Server({ port: 8080 })

function formatDuration(milliseconds) {
  const seconds = Math.floor((milliseconds / 1000) % 60)
  const minutes = Math.floor((milliseconds / (1000 * 60)) % 60)
  const hours = Math.floor(milliseconds / (1000 * 60 * 60))

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`
}

function getGameTitle(appId) {
  return new Promise((resolve) => {
    steamClient.getProductInfo([appId], [], (err, apps, packages) => {
      if (err || !apps || !apps[appId]) {
        resolve(`Unknown Game (${appId})`)
        return
      }
      try {
        resolve(apps[appId].appinfo.common.name)
      } catch (error) {
        console.error("Error parsing game info:", error)
        resolve(`Unknown Game (${appId})`)
      }
    })
  })
}

function setPersonaState(state) {
  if (PERSONA_STATES.hasOwnProperty(state)) {
    steamClient.setPersona(PERSONA_STATES[state])
    sendDiscordWebhook(`🎮 Steam status changed to: ${state}`)
    console.log(`Steam status changed to: ${state}`)
  } else {
    console.error("Invalid persona state")
  }
}

wss.on("connection", (ws) => {
  console.log("Client connected")
  sendDiscordWebhook('👤Client connected')
  ws.send(
    JSON.stringify({
      username: username,
      gameId: gameIds[0],
      boosting: boosting,
      duration: startTime ? formatDuration(Date.now() - startTime) : "00:00:00",
    }),
  )
})

async function broadcastStatus() {
  let duration = "00:00:00"
  if (boosting && startTime) {
    duration = formatDuration(Date.now() - startTime)
  }

  const gameTitle = await getGameTitle(gameIds[0])

  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(
        JSON.stringify({
          username: username,
          gameId: gameIds[0],
          gameTitle: gameTitle,
          boosting: boosting,
          duration: duration,
        }),
      )
    }
  })
}

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "home.html"))
})

app.post("/api/start", (req, res) => {
  if (!boosting) {
    boosting = true
    startTime = Date.now()

    setPersonaState("ONLINE")

    statusInterval = setInterval(() => {
      broadcastStatus()
    }, 1000)

    const webhookInterval = setInterval(() => {
      if (!boosting) {
        clearInterval(webhookInterval)
        return
      }
      const duration = formatDuration(Date.now() - startTime)
      sendDiscordWebhook(`⏱️ Current boost duration: ${duration}`)
    }, 60000)

    startSteamBoost()
    res.json({ success: true, message: "Boosting started" })
  } else {
    res.json({ success: false, message: "Already boosting" })
  }
})

app.post("/api/stop", (req, res) => {
  if (boosting) {
    boosting = false
    steamClient.gamesPlayed([])

    if (statusInterval) {
      clearInterval(statusInterval)
      statusInterval = null
    }

    setPersonaState("OFFLINE")

    res.json({ success: true, message: "Boosting stopped" })
  } else {
    res.json({ success: false, message: "Not boosting" })
  }
})

app.post("/api/setStatus", (req, res) => {
  const { status } = req.body
  try {
    setPersonaState(status)
    res.json({ success: true, message: `Status set to ${status}` })
  } catch (error) {
    res.json({ success: false, message: "Failed to set status" })
  }
})

function sendDiscordWebhook(message) {
  if (!webhookURL) {
    console.log("Discord webhook URL not set. Message not sent.")
    return
  }
}

discordClient.once("ready", async () => {
  console.log(`✅ Logged in as ${discordClient.user.tag}`)

  const commands = [
    {
      name: "startboost",
      description: "Start the game boosting process",
    },
    {
      name: "stopboost",
      description: "Stop the game boosting process",
    },
    {
      name: "setusername",
      description: "Set the Steam username for the bot",
      options: [
        {
          name: "username",
          type: 3,
          description: "The new username to set",
          required: true,
        },
      ],
    },
    {
      name: "setpassword",
      description: "Set the Steam password for the bot",
      options: [
        {
          name: "password",
          type: 3,
          description: "The new password to set",
          required: true,
        },
      ],
    },
    {
      name: "setgameid",
      description: "Set the Steam Game ID to boost",
      options: [
        {
          name: "gameid",
          type: 4,
          description: "The game ID to set",
          required: true,
        },
      ],
    },
  ]

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN)
  try {
    console.log("✅ Registering Slash Commands...")
    await rest.put(Routes.applicationCommands(discordClient.user.id), { body: commands })
    console.log("✅ Slash Commands Registered!")
  } catch (error) {
    console.error("❌ Failed to register commands:", error)
  }

  sendDiscordWebhook("✅ Bot is online and ready.")
})

discordClient.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return

  if (targetChannelId && interaction.channel.id !== targetChannelId) {
    console.log("Message skipped. Not in the target channel.")
    return
  }

  const { commandName, options } = interaction
  
  const updateConfig = () => {
    const updatedConfig = {
      steamUsername: username,
      steamPassword: password,
      webhookURL: webhookURL,
      gameIds: gameIds,
      targetChannelId: targetChannelId,
      serverID: serverID,
    }
    fs.writeFileSync("config.json", JSON.stringify(updatedConfig, null, 2))
  }

  if (commandName === "startboost") {
    if (boosting) {
      await interaction.reply("Boosting is already in progress.")
    } else {
      boosting = true
      startTime = Date.now()

      statusInterval = setInterval(() => {
        broadcastStatus()
      }, 1000)

      const webhookInterval = setInterval(() => {
        if (!boosting) {
          clearInterval(webhookInterval)
          return
        }
        const duration = formatDuration(Date.now() - startTime)
        sendDiscordWebhook(`⏱️ Current boost duration: ${duration}`)
      }, 60000)

      await interaction.reply("Boosting started.")
      startSteamBoost()
    }
  } else if (commandName === "stopboost") {
    if (boosting) {
      boosting = false
      const totalDuration = formatDuration(Date.now() - startTime)
      steamClient.gamesPlayed([])

      if (statusInterval) {
        clearInterval(statusInterval)
        statusInterval = null
      }

      await interaction.reply("Boosting stopped.")
      sendDiscordWebhook(`⏱️ Boost session ended. Total duration: ${totalDuration}`)
      startTime = null
    } else {
      await interaction.reply("Boosting is not in progress.")
    }
  } else if (commandName === "setusername") {
    username = options.getString("username")
    steamUsername = username
    updateConfig()
    await interaction.reply(`Username set to: ${username}`)
  } else if (commandName === "setpassword") {
    password = options.getString("password")
    steamPassword = password
    updateConfig()
    await interaction.reply("Password set successfully.")
  } else if (commandName === "setgameid") {
    const newGameId = options.getInteger("gameid")
    if (!isNaN(newGameId)) {
      gameIds = [newGameId]
      updateConfig()
      await interaction.reply(`Game ID set to: ${newGameId}`)
    } else {
      await interaction.reply("Invalid game ID.")
    }
  }
})

steamClient.on("loggedOn", () => {
  console.log("✅ Successfully logged into Steam.")
  sendDiscordWebhook("✅ Successfully logged into Steam.")

  setPersonaState("ONLINE")

  if (boosting) {
    startSteamBoost()
  }
})

steamClient.on("error", (error) => {
  console.error("❌ Steam client error:", error)
  sendDiscordWebhook(`❌ Steam client error: ${error.message}`)
})

function startSteamBoost() {
  if (!boosting) return

  const currentGames = gameIds.map((gameId) => ({
    appId: gameId,
    playing: false,
  }))

  function playGame(game) {
    steamClient.gamesPlayed(game.appId)
    game.playing = true
    console.log(`▶️ Now playing game with ID ${game.appId}.`)
    sendDiscordWebhook(`▶️ Boosting game hours for ID ${game.appId}.`)
    broadcastStatus()
  }

  function stopPlayingGame(game) {
    steamClient.gamesPlayed([])
    game.playing = false
    console.log(`⏹️ Stopped boosting game hours for ID ${game.appId}.`)
    sendDiscordWebhook(`⏹️ Stopped boosting game hours for ID ${game.appId}.`)
    broadcastStatus()
  }

  const intervalId = setInterval(() => {
    if (!boosting) {
      clearInterval(intervalId)
      currentGames.forEach(stopPlayingGame)
      return
    }

    for (const game of currentGames) {
      if (!game.playing) {
        playGame(game)
      }
    }
  }, 5000)
}

app.post("/api/updateSettings", (req, res) => {
  const {
    steamUsername: newUsername,
    steamPassword: newPassword,
    webhookURL: newWebhookURL,
    gameId,
    targetChannelId: newTargetChannelId,
    serverId: newServerId,
  } = req.body

  try {
    if (newUsername) {
      username = newUsername
      steamUsername = newUsername
    }

    if (newPassword) {
      password = newPassword
      steamPassword = newPassword
    }

    if (newWebhookURL) {
      webhookURL = newWebhookURL
    }

    if (gameId && !isNaN(Number.parseInt(gameId))) {
      gameIds = [Number.parseInt(gameId)]
    }

    if (newTargetChannelId) {
      targetChannelId = newTargetChannelId
    }

    if (newServerId) {
      serverID = newServerId
    }

    const updatedConfig = {
      steamUsername: username,
      steamPassword: password,
      webhookURL: webhookURL,
      gameIds: gameIds,
      targetChannelId: targetChannelId,
      serverID: serverID,
    }

    fs.writeFileSync("config.json", JSON.stringify(updatedConfig, null, 2))

    if (boosting) {
      steamClient.logOff()

      setTimeout(() => {
        steamClient.logOn({
          accountName: username,
          password: password,
        })
      }, 2000)
    }

    console.log("✅ Settings updated successfully")
    console.log("✅ Restarting IdlePlay")
    sendDiscordWebhook("✅ Settings updated successfully")
    sendDiscordWebhook("✅ Restarting IdlePlay please wait")

    res.json({ success: true, message: "Settings updated successfully" })
  } catch (error) {
    console.error("❌ Failed to update settings:", error)
    res.json({ success: false, message: "Failed to update settings: " + error.message })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})

discordClient.login(process.env.TOKEN)
steamClient.logOn({
  accountName: username,
  password: password,
})

discordClient
  .login(process.env.TOKEN)
  .then(() => {
    console.log("✅ Discord bot logged in successfully.")
  })
  .catch((error) => {
    console.error("❌ Failed to log in to Discord:", error)
  })
