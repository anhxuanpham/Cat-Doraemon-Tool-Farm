import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Daily - sends `cat daily`
 * Cooldown: 24 hours
 */
export default Schematic.registerFeature({
    name: "autoDaily",
    cooldown: () => 24 * 60 * 60 * 1000,
    condition: async ({ agent }) => agent.config.autoDaily,
    run: async ({ agent }) => {
        logger.info("Claiming daily reward...");
        await agent.awaitResponse({
            trigger: () => agent.send("daily"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
