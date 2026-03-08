import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto Fight Boss — sends `cat f b ce`
 * Cooldown: 10 minutes base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoFightBoss",
    cooldown: () => ranInt(600_000, 660_000),
    condition: async ({ agent }) => agent.config.autoFightBoss,
    run: async ({ agent }) => {
        logger.info("👹 Fighting Boss...");
        await agent.awaitResponse({
            trigger: () => agent.send("f b e"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
