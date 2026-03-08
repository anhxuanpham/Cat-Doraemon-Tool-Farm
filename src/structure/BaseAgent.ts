import { Collection, GuildTextBasedChannel, Message } from "discord.js-selfbot-v13";

import path from "node:path";

import { ranInt } from "@/utils/math.js";
import { logger } from "@/utils/logger.js";
import {
    AwaitResponseOptions,
    FeatureProps,
    SendMessageOptions
} from "@/typings/index.js";

import { Configuration } from "@/schemas/ConfigSchema.js";
import featuresHandler from "@/handlers/featuresHandler.js";
import { shuffleArray } from "@/utils/array.js";

import { ExtendedClient } from "./core/ExtendedClient.js";
import { CooldownManager } from "./core/CooldownManager.js";
import { fileURLToPath } from "node:url";
import { CaptchaService } from "@/services/CaptchaService.js";


export class BaseAgent {
    public readonly rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

    public readonly client: ExtendedClient<true>;
    public config: Configuration;

    public cooldownManager = new CooldownManager();
    public features = new Collection<string, FeatureProps>();

    // Cat Doraemon bot ID
    public catBotID = "1329758595981774908";
    // Global prefix - always "cat"
    public prefix: string = "cat";

    // Alert channel ID
    public notifyChannelID = "1480091485499297885";

    public activeChannel!: GuildTextBasedChannel;

    public totalCommands = 0;

    private invalidResponseCount = 0;
    private invalidResponseThreshold = 5;

    public captchaDetected = false;

    // Auto-sleep: rest after every N commands
    private commandsExecuted = 0;
    private autoSleepThreshold = ranInt(5, 16); // Sleep after 5-15 commands

    public farmLoopRunning = false;
    public farmLoopPaused = false;

    constructor(client: ExtendedClient<true>, config: Configuration) {
        this.client = client;
        this.config = config;
    }

    public setActiveChannel = (id?: string): GuildTextBasedChannel | undefined => {
        const channelIDs = this.config.channelID;

        if (!channelIDs || channelIDs.length === 0) {
            throw new Error("No channel IDs provided in the configuration.");
        }

        const channelID = id || channelIDs[ranInt(0, channelIDs.length)];
        try {
            const channel = this.client.channels.cache.get(channelID);
            if (channel && channel.isText()) {
                this.activeChannel = channel as GuildTextBasedChannel;
                logger.info(`📺 Active channel set to #${this.activeChannel.name}`);
                return this.activeChannel;
            } else {
                logger.warn(`⚠️ Invalid channel: ${channelID}`);
                this.config.channelID = this.config.channelID.filter(id => id !== channelID);
            }
        } catch (error) {
            logger.error(`Failed to fetch channel with ID ${channelID}:`);
            logger.error(error as Error);
        }
        return;
    }

    /**
     * Send a command to the active channel.
     * Default prefix is the global "cat" prefix, but can be overridden.
     */
    public send = async (content: string, options: Partial<SendMessageOptions> = {}) => {
        if (!this.activeChannel) {
            logger.warn("⚠️ No active channel set!");
            return;
        }

        const sendOptions: SendMessageOptions = {
            channel: options.channel || this.activeChannel,
            prefix: options.prefix !== undefined ? options.prefix : this.prefix,
            typing: options.typing,
            skipLogging: options.skipLogging,
        };

        this.client.sendMessage(content, sendOptions);
        if (sendOptions.prefix) {
            this.totalCommands++;
        }
    }

    /**
     * Check if the Cat bot is online on the guild.
     */
    private isBotOnline = async () => {
        try {
            const catBot = await this.activeChannel.guild.members.fetch(this.catBotID);
            return !!catBot && catBot.presence?.status !== "offline";
        } catch (error) {
            logger.warn("⚠️ Failed to check Cat bot status");
            return false;
        }
    }

    /**
     * Send a trigger message and await a response matching the filter.
     */
    public awaitResponse = (options: AwaitResponseOptions): Promise<Message | undefined> => {
        return new Promise((resolve, reject) => {
            const {
                channel = this.activeChannel,
                filter,
                time = 30_000,
                max = 1,
                trigger,
                expectResponse = false,
            } = options;

            if (!channel) {
                const error = new Error("awaitResponse requires a channel, but none was provided or set as active.");
                logger.error(error.message);
                return reject(error);
            }

            const collector = channel.createMessageCollector({
                filter,
                time,
                max,
            });

            collector.once("collect", (message: Message) => {
                resolve(message);
            });

            collector.once("end", (collected) => {
                if (collected.size === 0) {
                    if (expectResponse) {
                        this.invalidResponseCount++;
                        logger.debug(`No response received (${this.invalidResponseCount}/${this.invalidResponseThreshold})`);
                    }
                    if (this.invalidResponseCount >= this.invalidResponseThreshold) {
                        this.invalidResponseCount = 0;
                        return reject(new Error("Invalid response count exceeded threshold."));
                    }
                    resolve(undefined);
                } else {
                    this.invalidResponseCount = 0;
                }
            });

            if (trigger) {
                trigger();
            }
        })
    }

    /**
     * Main farming loop — shuffles features each iteration, respects cooldowns,
     * adds random delays between each feature and between iterations.
     */
    public farmLoop = async () => {
        if (this.farmLoopRunning) {
            logger.debug("Double farm loop detected, skipping.");
            return;
        }

        if (this.farmLoopPaused) {
            logger.debug("Farm loop is paused, skipping.");
            return;
        }

        this.farmLoopRunning = true;

        try {
            if (this.captchaDetected) {
                logger.warn("⚠️ Farm loop skipped because captcha is detected!");
                this.farmLoopRunning = false;
                return;
            }

            const featureKeys = Array.from(this.features.keys());
            if (featureKeys.length === 0) {
                logger.warn("⚠️ No features available to run!");
                return;
            }

            // Shuffle feature execution order for anti-detection
            for (const featureKey of shuffleArray(featureKeys)) {
                const feature = this.features.get(featureKey);
                if (!feature) continue;

                try {
                    const shouldRun = await feature.condition({ agent: this })
                        && this.cooldownManager.onCooldown("feature", feature.name) === 0;
                    if (!shouldRun) continue;

                    logger.info(`🎮 Running feature: ${feature.name}`);
                    const res = await feature.run({ agent: this });

                    // Set cooldown with the feature's defined cooldown (includes jitter)
                    this.cooldownManager.set(
                        "feature", feature.name,
                        typeof res === "number" && !isNaN(res) ? res : feature.cooldown() || 30_000
                    );

                    this.commandsExecuted++;

                    // Auto-sleep: take a long break after N commands
                    if (this.commandsExecuted >= this.autoSleepThreshold) {
                        const sleepTime = ranInt(30_000, 120_001); // 30s - 2min rest
                        logger.info(`😴 Resting for ${Math.round(sleepTime / 1000)}s after ${this.commandsExecuted} commands...`);
                        await this.client.sleep(sleepTime);
                        this.commandsExecuted = 0;
                        this.autoSleepThreshold = ranInt(5, 16); // Random new threshold
                        logger.info(`⏰ Woke up! Next rest after ${this.autoSleepThreshold} commands`);
                    }

                    // Random delay between features based on config
                    let minDelay = 2000, maxDelay = 6000;
                    if (this.config.interCommandDelay) {
                        const parts = this.config.interCommandDelay.split("-");
                        if (parts.length === 2) {
                            minDelay = parseInt(parts[0], 10) || 2000;
                            maxDelay = parseInt(parts[1], 10) || 6000;
                        }
                    }
                    const sleepTimeMs = ranInt(minDelay, maxDelay + 1);
                    logger.info(`⏳ Waiting ${Math.round(sleepTimeMs / 1000)}s before next command...`);
                    await this.client.sleep(sleepTimeMs);
                } catch (error) {
                    const errorMessage = error instanceof Error ? error.message : String(error);

                    if (errorMessage.includes("Invalid response count exceeded threshold")) {
                        logger.warn("⚠️ Too many missed responses, switching channel...");
                        this.setActiveChannel();
                        continue;
                    }

                    if (errorMessage.includes("aborted") || errorMessage.includes("AbortError")) {
                        logger.warn(`Operation aborted in feature ${feature.name}, continuing...`);
                        continue;
                    }

                    logger.error(`Error running feature ${feature.name}:`);
                    logger.error(error as Error);
                }
            }

            // Schedule next iteration with random delay (3-10s)
            if (!this.farmLoopPaused) {
                const delay = ranInt(3000, 10_000);
                setTimeout(() => {
                    this.farmLoop();
                }, delay);
            }

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            // Network failure auto-recovery
            if (errorMessage.includes("fetch failed") ||
                errorMessage.includes("ECONNRESET") ||
                errorMessage.includes("ETIMEDOUT")) {
                logger.alert("🌐 Network failure, auto-recovering in 30s...");
                setTimeout(() => {
                    logger.info("🌐 Attempting to resume farming...");
                    this.farmLoopRunning = false;
                    this.farmLoop();
                }, 30000);
                return;
            }

            logger.error("Error in farm loop:");
            logger.error(error as Error);
        } finally {
            this.farmLoopRunning = false;
        }
    }

    private registerFeatures = async () => {
        await featuresHandler.run({ agent: this });
        logger.info(`✅ ${this.features.size} features registered`);
    }

    public static initialize = async (client: ExtendedClient<true>, config: Configuration) => {
        logger.info("🚀 Initializing Cat Doraemon Tool Farm...");

        if (!client.isReady()) {
            throw new Error("Client is not ready. Ensure the client is logged in before initializing.");
        }

        const agent = new BaseAgent(client, config);
        agent.setActiveChannel();

        await agent.registerFeatures();

        // Register Captcha Detection Listener
        client.on("messageCreate", async (message) => {
            // Check if the message is from Cat Bot
            if (message.author.id !== agent.catBotID) return;

            // Simple checks - adapt based on exactly what Cat bot says
            const content = message.content.toLowerCase();
            const isCaptcha = content.includes("captcha") || 
                              content.includes("verify") || 
                              content.includes("are you a human");

            // Also check embeds
            const hasCaptchaEmbed = message.embeds.some(e => 
                (e.title && e.title.toLowerCase().includes("captcha")) ||
                (e.description && e.description.toLowerCase().includes("captcha"))
            );

            if (isCaptcha || hasCaptchaEmbed) {
                if (!agent.captchaDetected) {
                    agent.captchaDetected = true;
                    agent.farmLoopPaused = true;
                    logger.alert("🚨 CAPTCHA DETECTED! STOPPING ALL COMMANDS!");
                    
                    try {
                        const notifyChannel = await client.channels.fetch(agent.notifyChannelID);
                        if (notifyChannel && notifyChannel.isText()) {
                            await notifyChannel.send(`🚨 <@${client.user.id}> **CAPTCHA DETECTED!** 🚨\nBot has stopped farming. Please verify manually in <#${message.channel.id}>!`);
                            logger.info("Sent captcha alert to notification channel.");
                        }
                    } catch (err) {
                        logger.error("Failed to send captcha alert to notification channel.");
                    }

                    // Attempt auto-solve if API key is provided
                    if (agent.config.captchaAPIKey) {
                        await CaptchaService.handleCaptcha(agent, message);
                    }
                }
            }

            // Check for correct Captcha Verification Success (Adapt translation/wording)
            const isVerified = content.includes("bạn đã xác thực thành công") || 
                               content.includes("quẩy đi nèo");
            
            if (isVerified && agent.captchaDetected) {
                logger.info("✅ XÁC THỰC THÀNH CÔNG! ĐANG TIẾP TỤC FARMING SAU 5 GIÂY...");
                try {
                    const notifyChannel = await client.channels.fetch(agent.notifyChannelID);
                    if (notifyChannel && notifyChannel.isText()) {
                        await notifyChannel.send(`✅ **CAPTCHA ĐÃ XONG!** Đang tiếp tục vòng lặp farm...`);
                    }
                } catch (err) {}

                // Reset solving state just in case
                CaptchaService.isSolving = false;

                setTimeout(() => {
                    agent.captchaDetected = false;
                    agent.farmLoopPaused = false;
                    if (!agent.farmLoopRunning) {
                        agent.farmLoop();
                    }
                }, 5000);
            }
        });

        logger.info(`🐱 Logged in as ${client.user.username}`);
        logger.info("🎯 Starting farm loop...");

        agent.farmLoop();
    }
}
