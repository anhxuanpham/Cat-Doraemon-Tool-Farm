import { logger } from "@/utils/logger.js";
import { BaseAgent } from "@/structure/BaseAgent.js";
import { Message } from "discord.js-selfbot-v13";
import { Solver } from "2captcha";

export class CaptchaService {
    public static isSolving = false;

    public static async handleCaptcha(agent: BaseAgent, initialMessage: Message) {
        if (!agent.config.captchaAPIKey) {
            logger.warn("⚠️ No 2Captcha API Key provided. Cannot auto-solve captcha.");
            return;
        }

        if (this.isSolving) return;
        this.isSolving = true;

        let currentMessage = initialMessage;
        let attempts = 0;
        let isVerified = false;
        
        const startTime = Date.now();
        let lastAlertTime = startTime;

        // Loop for up to 15 attempts (approx 10 minutes max depending on API speed)
        while (agent.captchaDetected && attempts < 15) {
            attempts++;
            logger.info(`🤖 Bắt đầu giải captcha (Lần ${attempts})...`);

            // 2-minute alert check
            if (Date.now() - lastAlertTime >= 120_000) {
                const minutesPassed = Math.floor((Date.now() - startTime) / 60000);
                try {
                    const notifyChannel = await agent.client.channels.fetch(agent.notifyChannelID);
                    if (notifyChannel && notifyChannel.isText()) {
                        await notifyChannel.send(`⚠️ <@${agent.client.user.id}> **CẢNH BÁO:** Bot đã kẹt ở màn hình Captcha được ${minutesPassed} phút! Vui lòng kiểm tra màn hình game ở <#${initialMessage.channel.id}>!`);
                    }
                } catch(e) {}
                lastAlertTime = Date.now();
            }

            const answer = await this.solveImage(agent, currentMessage);

            if (answer) {
                logger.info(`✅ Tải ảnh và giải thành công! Đáp án: "${answer}"`);
                
                // Small realistic delay before answering
                await agent.client.sleep(2000); 
                
                logger.info(`📤 Đang gửi đáp án...`);
                await currentMessage.channel.send(answer);

                logger.info("⏳ Đang chờ kết quả xác thực từ bot Cat...");
                
                // Wait up to 15 seconds for a response from the Cat bot
                const response = await agent.awaitResponse({
                    channel: currentMessage.channel,
                    filter: m => m.author.id === agent.catBotID,
                    time: 15_000,
                    expectResponse: false
                });

                if (response) {
                    const content = response.content.toLowerCase();
                    // success message match
                    if (content.includes("bạn đã xác thực thành công")) {
                        isVerified = true;
                        break;
                    } 
                    // New captcha prompt received (wrong answer)
                    else if (content.includes("không phải robot") || content.includes("nhập captcha") || content.includes("thử lại")) {
                        logger.warn(`⚠️ Captcha sai! Bot Cat đã gửi yêu cầu mới.`);
                        currentMessage = response; // Update to the new message/image
                        
                        try {
                            const notifyChannel = await agent.client.channels.fetch(agent.notifyChannelID);
                            if (notifyChannel && notifyChannel.isText()) {
                                await notifyChannel.send(`⚠️ <@${agent.client.user.id}> Captcha sai! Đang thử giải lại hình mới (Lần ${attempts + 1})...`);
                            }
                        } catch(e) {}

                        await agent.client.sleep(3000); // Sleep a bit before retrying
                    } 
                    else {
                        logger.warn(`⚠️ Cat bot phản hồi không rõ ràng: "${response.content}". Thử lại cùng ảnh...`);
                        await agent.client.sleep(3000);
                    }
                } else {
                    logger.warn("⚠️ Không nhận được phản hồi từ bot Cat sau khi gửi đáp án. Có thể lag, thử lại...");
                    await agent.client.sleep(3000);
                }
            } else {
                logger.warn("❌ Không lấy được đáp án từ 2Captcha. Thử lại sau 5s...");
                await agent.client.sleep(5000);
            }
        }

        this.isSolving = false;

        if (isVerified) {
            // Note: BaseAgent's messageCreate listener also natively handles unpausing when it sees this message if we let it.
            // But we can double ensure it unpauses here.
            logger.info("✅ CAPTCHA VERIFIED! Tự động tiếp tục vòng lặp farm...");
            try {
                const notifyChannel = await agent.client.channels.fetch(agent.notifyChannelID);
                if (notifyChannel && notifyChannel.isText()) {
                    await notifyChannel.send(`✅ **CAPTCHA ĐÃ ĐƯỢC GIẢI THÀNH CÔNG!** Đang tiếp tục auto farm...`);
                }
            } catch (err) {}

            setTimeout(() => {
                agent.captchaDetected = false;
                agent.farmLoopPaused = false;
                if (!agent.farmLoopRunning) {
                    agent.farmLoop();
                }
            }, 5000);
        } else if (agent.captchaDetected) {
            logger.error("❌ AUTO-SOLVE THẤT BẠI SAU 15 LẦN THỬ!");
            try {
                const notifyChannel = await agent.client.channels.fetch(agent.notifyChannelID);
                if (notifyChannel && notifyChannel.isText()) {
                    await notifyChannel.send(`❌ <@${agent.client.user.id}> **GIẢI CAPTCHA TỰ ĐỘNG THẤT BẠI (Hết số lần thử)!** Vui lòng vào kênh <#${initialMessage.channel.id}> tự giải tay trước khi hết 10 phút!`);
                }
            } catch (err) {}
        }
    }

    private static async solveImage(agent: BaseAgent, message: Message): Promise<string | null> {
        let imageUrl = "";
        
        if (message.attachments.size > 0) {
            imageUrl = message.attachments.first()?.url ?? "";
        } else if (message.embeds.length > 0) {
            imageUrl = message.embeds[0].image?.url ?? message.embeds[0].thumbnail?.url ?? "";
        }

        if (!imageUrl) {
            logger.error("❌ Không tìm thấy ảnh trong tin nhắn captcha.");
            return null;
        }

        try {
            const solver = new Solver(agent.config.captchaAPIKey!);
            
            const response = await fetch(imageUrl);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Image = buffer.toString("base64");

            // User image usually says "6 kí tự trong captcha"
            // We set min_len: 6, max_len: 6 for Cat Doraemon captcha
            const res = await solver.imageCaptcha(base64Image, {
                numeric: 4, // 1 for numeric, 2 for letters, 4 for both
                min_len: 6,
                max_len: 6
            });

            return res.data;
        } catch (error) {
            logger.error("❌ Lỗi khi gửi ảnh lên 2Captcha:");
            logger.error(error as Error);
            return null;
        }
    }
}
