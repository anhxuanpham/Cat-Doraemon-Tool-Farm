import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Fight D - sends `cat f d`
 * Cooldown: 45s
 */
export default Schematic.registerFeature({
    name: "autoFightD",
    cooldown: () => 45_000,
    condition: async ({ agent }) => agent.config.autoFightD,
    run: async ({ agent }) => {
        logger.info("Fighting (D)...");
        await agent.awaitResponse({
            trigger: () => agent.send("f d"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
