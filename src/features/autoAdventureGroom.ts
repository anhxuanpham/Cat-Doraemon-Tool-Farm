import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Adventure Groom - sends `cat pet a groom`
 * Cooldown: 65s
 */
export default Schematic.registerFeature({
    name: "autoAdventureGroom",
    cooldown: () => 65_000,
    condition: async ({ agent }) => agent.config.autoAdventureGroom,
    run: async ({ agent }) => {
        logger.info("Grooming pet...");
        await agent.awaitResponse({
            trigger: () => agent.send("pet a groom"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
