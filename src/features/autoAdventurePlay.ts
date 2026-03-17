import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Adventure Play - sends `cat pet a play`
 * Cooldown: 65s
 */
export default Schematic.registerFeature({
    name: "autoAdventurePlay",
    cooldown: () => 65_000,
    condition: async ({ agent }) => agent.config.autoAdventurePlay,
    run: async ({ agent }) => {
        logger.info("Playing with pet...");
        await agent.awaitResponse({
            trigger: () => agent.send("pet a play"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
