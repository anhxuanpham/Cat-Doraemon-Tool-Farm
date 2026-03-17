import * as readline from "node:readline";

import { ConfigSchema, Configuration } from "@/schemas/ConfigSchema.js";
import { BaseAgent } from "@/structure/BaseAgent.js";
import { ConfigManager } from "@/structure/core/ConfigManager.js";
import { ExtendedClient } from "@/structure/core/ExtendedClient.js";
import { logger } from "@/utils/logger.js";

process.title = "Cat Doraemon Tool Farm v1.0.0";
console.clear();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const question = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            resolve(answer.trim());
        });
    });
};

const configManager = new ConfigManager();
const activeClients: ExtendedClient[] = [];

const startAccount = async (config: Configuration, index: number) => {
    try {
        const client = new ExtendedClient();
        activeClients.push(client);

        logger.info(`[Account ${index}] Logging in as ${config.username || "Unknown"}...`);
        await client.checkAccount(config.token);

        BaseAgent.initialize(client, config).catch((err) => {
            logger.error(`[Account ${index}] Agent error:`);
            logger.error(err as Error);
        });
    } catch (error) {
        logger.error(`[Account ${index}] Failed to start:`);
        logger.error(error as Error);
    }
};

const main = async () => {
    console.log(`
+-------------------------------------------+
|     Cat Doraemon Tool Farm v1.0.0         |
|  Auto-farm bot for Cat Doraemon Discord   |
+-------------------------------------------+
`);

    const allKeys = configManager.getAllKeys();
    let configsToRun: Configuration[] = [];

    if (allKeys.length > 0) {
        console.log("Saved accounts:");
        allKeys.forEach((key, i) => {
            const cfg = configManager.get(key);
            console.log(`  ${i + 1}. ${cfg?.username || key}`);
        });
        console.log(`  ${allKeys.length + 1}. Add new account`);
        console.log();

        const choice = process.env.AUTO_START || "all";
        console.log(`Auto-starting accounts: ${choice}`);

        if (choice.toLowerCase() === "all" || choice === "*") {
            configsToRun = allKeys.map((key) => configManager.get(key)!);
        } else {
            const choices = choice.split(",").map((value) => Number.parseInt(value.trim(), 10));
            for (const choiceNum of choices) {
                if (choiceNum > 0 && choiceNum <= allKeys.length) {
                    configsToRun.push(configManager.get(allKeys[choiceNum - 1])!);
                } else if (choiceNum === allKeys.length + 1) {
                    configsToRun.push(await promptNewAccount());
                }
            }
        }
    } else {
        if (process.env.AUTO_START) {
            logger.error("AUTO_START is set, but no accounts are saved in the data directory.");
            logger.error("Run the bot interactively once to create an account first.");
            process.exit(1);
        }

        logger.info("No saved accounts found. Creating a new one.");
        configsToRun.push(await promptNewAccount());
    }

    rl.close();

    if (configsToRun.length === 0) {
        logger.warn("No valid accounts selected. Exiting...");
        process.exit(0);
    }

    logger.info(`Starting ${configsToRun.length} account(s)...`);

    for (let i = 0; i < configsToRun.length; i++) {
        startAccount(configsToRun[i], i + 1);
        await new Promise((resolve) => setTimeout(resolve, 2000));
    }
};

const promptNewAccount = async (): Promise<Configuration> => {
    console.log("\n--- New Account Setup ---\n");

    const token = await question("Discord Token: ");
    const guildID = await question("Guild (Server) ID: ");
    const channelIDsRaw = await question("Channel ID(s) (comma-separated): ");
    const channelID = channelIDsRaw.split(",").map((id) => id.trim()).filter(Boolean);

    console.log("\n--- Feature Toggles (y/n, default: y) ---\n");
    const autoClaim = (await question("Auto Claim (cat c c)? [y]: ")).toLowerCase() !== "n";
    const autoWork = (await question("Auto Work (cat w)? [y]: ")).toLowerCase() !== "n";
    const autoDaily = (await question("Auto Daily (cat daily)? [y]: ")).toLowerCase() !== "n";
    const autoAdventurePlay = (await question("Auto Adventure Play (cat pet a play)? [y]: ")).toLowerCase() !== "n";
    const autoAdventureGroom = (await question("Auto Adventure Groom (cat pet a groom)? [y]: ")).toLowerCase() !== "n";
    const autoAdventureFeed = (await question("Auto Adventure Feed (cat pet a feed)? [y]: ")).toLowerCase() !== "n";
    const autoFight = (await question("Auto Fight (cat f)? [y]: ")).toLowerCase() !== "n";
    const autoFightD = (await question("Auto Fight D (cat f d)? [y]: ")).toLowerCase() !== "n";
    const autoFightS = (await question("Auto Fight S (cat f s)? [y]: ")).toLowerCase() !== "n";
    const autoFightT = (await question("Auto Fight T (cat f t)? [y]: ")).toLowerCase() !== "n";
    const autoFightBoss = (await question("Auto Fight Boss (cat f b ce)? [y]: ")).toLowerCase() !== "n";
    const autoWorldBoss = (await question("Auto World Boss (cat wb f f)? [y]: ")).toLowerCase() !== "n";

    console.log("\n--- Anti-Detection Settings ---");
    const interCommandDelayInput = await question("Inter-Command Delay (min-max ms, default: 2000-6000): ");
    const interCommandDelay = interCommandDelayInput.trim() || "2000-6000";

    const nightMode = (await question("Night Mode (rest after active farming time)? [n]: ")).toLowerCase() === "y";
    let nightModeTime = "10-14";
    let nightModeSleepTime = "30-90";
    if (nightMode) {
        const nightModeTimeInput = await question("   Active hours before resting (min-max hours, default: 10-14): ");
        nightModeTime = nightModeTimeInput.trim() || "10-14";

        const nightModeSleepTimeInput = await question("   Rest duration (min-max minutes, default: 30-90): ");
        nightModeSleepTime = nightModeSleepTimeInput.trim() || "30-90";
    }

    console.log("\n--- Captcha Solver (2Captcha) ---");
    const captchaAPIKey = await question("2Captcha API Key (Leave empty to skip): ");

    const rawConfig = {
        token,
        guildID,
        channelID,
        autoClaim,
        autoWork,
        autoDaily,
        autoAdventurePlay,
        autoAdventureGroom,
        autoAdventureFeed,
        autoFight,
        autoFightD,
        autoFightS,
        autoFightT,
        autoFightBoss,
        autoWorldBoss,
        interCommandDelay,
        nightMode,
        nightModeTime,
        nightModeSleepTime,
        captchaAPIKey: captchaAPIKey || undefined,
    };

    const result = ConfigSchema.safeParse(rawConfig);
    if (!result.success) {
        logger.error("Invalid configuration:");
        console.error(result.error.issues);
        process.exit(1);
    }

    const config = result.data;
    const accountKey = `account_${Date.now()}`;

    configManager.set(accountKey, config);
    logger.info(`Account saved as: ${accountKey}`);

    return config;
};

let isShuttingDown = false;
const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;
    logger.info(`\nReceived ${signal}, shutting down ${activeClients.length} clients...`);

    for (const client of activeClients) {
        try {
            client.destroy();
        } catch {
            // Ignore shutdown errors.
        }
    }

    logger.info("Goodbye!");
    process.exit(0);
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

main();
