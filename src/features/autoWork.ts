import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";

/**
 * Auto Work - sends `cat w`
 * Cooldown: 50s
 */
export default Schematic.registerFeature({
    name: "autoWork",
    cooldown: () => 50_000,
    condition: async ({ agent }) => agent.config.autoWork,
    run: async ({ agent }) => {
        logger.info("Working...");
        await agent.awaitResponse({
            trigger: () => agent.send("w"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
