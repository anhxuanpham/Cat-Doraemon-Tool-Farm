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

    // Night mode: rest after X active hours of farming
    private nextNightSleepAfterMs = 0;
    private nightModeActiveMs = 0;
    private nightModeLastStartedAt = 0;

    public farmLoopRunning = false;
    public farmLoopPaused = false;

    constructor(client: ExtendedClient<true>, config: Configuration) {
        this.client = client;
        this.config = config;
    }

    private parseRange = (
        value: string | undefined,
        defaultMin: number,
        defaultMax: number
    ): [number, number] => {
        const parts = value?.split("-") ?? [];
        if (parts.length !== 2) {
            return [defaultMin, defaultMax];
        }

        const min = Number.parseInt(parts[0], 10);
        const max = Number.parseInt(parts[1], 10);

        if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
            return [defaultMin, defaultMax];
        }

        return [min, max];
    }

    private pickRangeValue = (
        value: string | undefined,
        defaultMin: number,
        defaultMax: number
    ): number => {
        const [min, max] = this.parseRange(value, defaultMin, defaultMax);
        return min === max ? min : ranInt(min, max + 1);
    }

    private formatDuration = (durationMs: number): string => {
        const totalMinutes = Math.max(1, Math.round(durationMs / 60_000));
        if (totalMinutes < 60) {
            return `${totalMinutes} minute${totalMinutes === 1 ? "" : "s"}`;
        }

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        if (minutes === 0) {
            return `${hours} hour${hours === 1 ? "" : "s"}`;
        }

        return `${hours}h ${minutes}m`;
    }

    private pauseNightModeTimer = () => {
        if (!this.config.nightMode || this.nightModeLastStartedAt === 0) {
            return;
        }

        this.nightModeActiveMs += Date.now() - this.nightModeLastStartedAt;
        this.nightModeLastStartedAt = 0;
    }

    private resumeNightModeTimer = () => {
        if (!this.config.nightMode || this.nextNightSleepAfterMs === 0 || this.nightModeLastStartedAt !== 0) {
            return;
        }

        this.nightModeLastStartedAt = Date.now();
    }

    private getNightModeElapsedMs = () => {
        if (!this.config.nightMode) {
            return 0;
        }

        return this.nightModeActiveMs + (
            this.nightModeLastStartedAt === 0
                ? 0
                : Date.now() - this.nightModeLastStartedAt
        );
    }

    private scheduleNextNightRest = () => {
        const activeHours = this.pickRangeValue(this.config.nightModeTime, 10, 14);
        this.nextNightSleepAfterMs = activeHours * 60 * 60 * 1000;
        this.nightModeActiveMs = 0;
        this.nightModeLastStartedAt = Date.now();
        return activeHours;
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
            this.pauseNightModeTimer();
            logger.debug("Farm loop is paused, skipping.");
            return;
        }

        this.farmLoopRunning = true;
        this.resumeNightModeTimer();

        try {
            if (this.captchaDetected) {
                this.pauseNightModeTimer();
                logger.warn("⚠️ Farm loop skipped because captcha is detected!");
                this.farmLoopRunning = false;
                return;
            }

            // --- Night Mode Check ---
            if (this.config.nightMode && this.nextNightSleepAfterMs > 0 && this.getNightModeElapsedMs() >= this.nextNightSleepAfterMs) {
                const elapsedMs = this.getNightModeElapsedMs();
                const sleepMinutes = this.pickRangeValue(this.config.nightModeSleepTime, 30, 90);
                const sleepMs = sleepMinutes * 60 * 1000;

                this.pauseNightModeTimer();
                logger.info(
                    `🌙 [NIGHT MODE] Bot is resting for ${this.formatDuration(sleepMs)} ` +
                    `after ${this.formatDuration(elapsedMs)} of active farming.`
                );
                await this.client.sleep(sleepMs);

                const activeHours = this.scheduleNextNightRest();
                logger.info(`☀️ [NIGHT MODE] Rest finished. Next rest after ${activeHours} active hours.`);
            }

            const featureKeys = Array.from(this.features.keys());
            if (featureKeys.length === 0) {
                this.pauseNightModeTimer();
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
                    const sleepTimeMs = this.pickRangeValue(this.config.interCommandDelay, 2000, 6000);
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
                this.pauseNightModeTimer();
                logger.alert("🌐 Network failure, auto-recovering in 30s...");
                setTimeout(() => {
                    logger.info("🌐 Attempting to resume farming...");
                    this.farmLoopRunning = false;
                    this.resumeNightModeTimer();
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

        // Start counting active farming time only after the feature is explicitly enabled.
        if (config.nightMode) {
            const activeHours = agent.scheduleNextNightRest();
            logger.info(`🌙 Night Mode Enabled: Bot will rest after ${activeHours} active hours of farming.`);
        }

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
                    agent.pauseNightModeTimer();
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
                    agent.resumeNightModeTimer();
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
