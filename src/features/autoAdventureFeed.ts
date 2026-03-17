import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Adventure Feed - sends `cat pet a feed`
 * Cooldown: 65s
 */
export default Schematic.registerFeature({
    name: "autoAdventureFeed",
    cooldown: () => 65_000,
    condition: async ({ agent }) => agent.config.autoAdventureFeed,
    run: async ({ agent }) => {
        logger.info("Feeding pet...");
        await agent.awaitResponse({
            trigger: () => agent.send("pet a feed"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
