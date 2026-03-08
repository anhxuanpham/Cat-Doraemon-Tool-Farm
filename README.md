# 🐱 Cat Doraemon Tool Farm

A fully automated, multi-account farming bot designed specifically for the **Cat Doraemon** Discord game. Written in TypeScript and powered by `discord.js-selfbot-v13`, this tool allows you to safely farm experience, items, and currency 24/7 with advanced anti-detection mechanisms, automatic Captcha solving, and headless Docker deployment support.

**Author:** William

---

## ✨ Features

* **Multi-Account Support**: Run as many accounts as you want simultaneously in a single Node.js instance (or Docker container). Farm loops are perfectly parallelized and independent.
* **Fully Automated Loop**: Automatically triggers `cat c c`, `cat f`, `cat f s`, `cat f t`, `cat f b ce`, and `cat wb f f`.
* **Advanced Anti-Detection**:
  * Human-like typing simulation (`500-1200ms` delay before sending commands).
  * Feature execution order is physically shuffled every loop iteration.
  * Configurable `inter-command` delay (e.g. `2000-6000ms`), randomized per action.
  * ±20% randomized jitter applied to all hardcoded cooldowns.
  * Auto-sleep rest breaks (`30s-120s`) triggered randomly after every `5-15` commands.
* **2Captcha Integration**: Automatically detects captchas, downloads the image, sends it to the 2Captcha API for verification, and submits the answer—resuming the farm loop seamlessly.
* **Smart Error Handling**: Recovers gracefully from Discord API 500 Network drops and missed responses.
* **Interactive CLI Setup**: Easy-to-use setup wizard upon running for the very first time. No need to touch JSON configuration files manually.

---

## 🛠️ Installation & Local Usage

**Prerequisites:** Node.js (v18 or higher recommended).

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/cat-doraemon-tool-farm.git
   cd cat-doraemon-tool-farm
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the application:**
   ```bash
   npm start
   ```

On your first run, the interactive CLI will guide you through setting up an account:
- Enter your Discord User Token.
- Enter the Server (Guild) ID and the Channel ID(s) where the bot should spam.
- Toggle features on/off.
- Input your **2Captcha API Key** (Optional but highly recommended).
- Set your preferred Inter-Command Delays.

Configurations are saved locally to `data/data.json`.
To run multiple accounts, restart the tool, select `Add new account`, and repeat the process. Finally, select `all` when prompted to start all your farm accounts simultaneously.

---

## 🐳 Docker Deployment (24/7 Server)

This bot is fully Dockerized for easy background deployment on VPS or home servers.

**⚠️ Prerequisite:** You MUST run `npm start` locally at least once to generate your configurations in the `data/` folder before pushing to your server.

1. **Transfer Files:** Upload the entire project directory (including your generated `data/` directory) to your server.
2. **Launch with Docker Compose:**
   ```bash
   docker-compose up -d --build
   ```

This will automatically pick up the `data.json` state and boot up all accounts instantly in the background without requiring interactive CLI selections, thanks to the mapped volume and `AUTO_START=all` environment variable.

### Checking Logs
To view the live output of your farming accounts from the server:
```bash
docker-compose logs -f
```

### Stopping the Bot
```bash
docker-compose down
```

---

## ⚠️ Disclaimer

Self-botting violates Discord's Terms of Service. This tool is provided for educational purposes only. The advanced anti-detection measures significantly reduce the risk of bans, but do not eliminate them. 

**Tips to avoid bans:**
- Do not run more than 3-5 accounts on a single residential internet connection / IP.
- Assign each account to a dedicated channel (`#cày-1`, `#cày-2`) to avoid global rate limiting.
- Provide a valid 2Captcha key to ensure the bot isn't trapped looping against an active image verification block.

---
*Created by William*
