import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto World Boss Fight — sends `catwb f h` (which is `cat wb f h`)
 * Uses the same "cat" prefix, just the command is "wb f h"
 * Cooldown: 10 minutes base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoWorldBoss",
    cooldown: () => ranInt(600_000, 660_000),
    condition: async ({ agent }) => agent.config.autoWorldBoss,
    run: async ({ agent }) => {
        logger.info("🌍 Fighting World Boss...");
        // Send the command "cat wb f f" directly to the active channel.
        await agent.awaitResponse({
            trigger: async () => {
                await agent.client.sleep(2000);
                await agent.activeChannel.send("cat wb f h");
            },
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
