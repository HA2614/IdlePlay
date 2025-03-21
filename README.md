# IdlePlay

IdlePlay is a tool that automates Steam playtime for your games, allowing you to effortlessly boost your playtime hours. Perfect for users who want to increase their Steam profile activity with minimal effort.

## Features

- Automates playtime for 1 selected game.
- Keeps track of playtime via a Discord webhook.
- Lightweight and easy to use with minimal setup.
<p align="center">
<img src="https://github.com/user-attachments/assets/63f21f3a-2ffb-4cc9-b9ab-bd69021a08f5" width="35%">
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/78828194-eb28-4e23-984a-afec84e7fc58" width="45%">
  <img src="https://github.com/user-attachments/assets/2dd5c80b-6c76-43f7-b036-054f7e3e79d3" width="45%">
</p>


## Requirements

- [Node.js](https://nodejs.org/) - To run the tool.
- [Steam account](https://store.steampowered.com/) - The tool will work with your Steam games.
- [Discord Bot Token & Webhook](https://support.discord.com/hc/en-us/articles/228383668-Intro-to-Webhooks) - To send messages to a Discord channel.


## Installation

1. Clone this repository to your local machine:
    ```bash
    git clone https://github.com/HA2614/IdlePlay.git
    ```

2. Navigate into the project directory:
    ```bash
    cd IdlePlay
    ```

3. Install the required dependencies:
    ```bash
    npm install discord.js steam-user axios express ws dotenv
    ```

4. Create a `.env` file in the root directory of the project and add your Discord Bot Token and other sensitive details:
    ```bash
    TOKEN=your_discord_token

    ```

5. Create a `config.json` file in the root directory of the project and add the following text
    ```bash
        {
        "steamUsername": "username",
        "steamPassword": "password",
        "webhookURL": "your-webhook-link",
        "gameIds": [
            gameid
        ],
        "targetChannelId": "putyouridhere",
        "serverID": "putyouridhere"
        }
    ```

6. Run the application:
    ```bash
    node booster.js
    ```

7. Check to see if you get logged into steam if you see the following you are logged in.
    If not logged in please input your steam guard code or check your username/password.
    ```bash
    ✅ Successfully logged into Steam.
    ```

## Usage

1. Once the application is running, you need to enter your details in the settings page.
2. After saving your settings, press the "Start" button, and your game of choice will begin farming.
3. Login and Discord webhook messages will be displayed in the console.
4. If a Steam Guard code is required, the console will prompt you to enter it.
5. To stop the process, simply press the "Stop" button.