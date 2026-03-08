import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto Fight — sends `cat f`
 * Cooldown: 15s base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoFight",
    cooldown: () => ranInt(15_000, 20_000),
    condition: async ({ agent }) => agent.config.autoFight,
    run: async ({ agent }) => {
        logger.info("⚔️ Fighting...");
        await agent.awaitResponse({
            trigger: () => agent.send("f"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
