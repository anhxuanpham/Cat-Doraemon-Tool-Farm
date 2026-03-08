import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto Fight T — sends `cat f t`
 * Cooldown: 30s base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoFightT",
    cooldown: () => ranInt(30_000, 38_000),
    condition: async ({ agent }) => agent.config.autoFightT,
    run: async ({ agent }) => {
        logger.info("⚔️ Fighting (T)...");
        await agent.awaitResponse({
            trigger: () => agent.send("f tm"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
