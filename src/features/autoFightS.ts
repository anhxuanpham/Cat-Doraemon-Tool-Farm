import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto Fight S — sends `cat f s`
 * Cooldown: 10s base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoFightS",
    cooldown: () => ranInt(10_000, 15_000),
    condition: async ({ agent }) => agent.config.autoFightS,
    run: async ({ agent }) => {
        logger.info("⚔️ Fighting (S)...");
        await agent.awaitResponse({
            trigger: () => agent.send("f s"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
