import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { ranInt } from "@/utils/math.js";

/**
 * Auto Claim Character — sends `cat c c`
 * Cooldown: 27s base + random jitter
 */
export default Schematic.registerFeature({
    name: "autoClaim",
    cooldown: () => ranInt(27_000, 33_000),
    condition: async ({ agent }) => agent.config.autoClaim,
    run: async ({ agent }) => {
        logger.info("🎴 Claiming character...");
        await agent.awaitResponse({
            trigger: () => agent.send("c c"),
            filter: (m) => m.author.id === agent.catBotID && m.embeds.length > 0,
            expectResponse: true,
        });
    },
});
