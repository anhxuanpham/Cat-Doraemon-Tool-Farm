import path from "node:path";
import fs from "node:fs";

import { Schematic } from "@/structure/Schematic.js";
import { logger } from "@/utils/logger.js";
import { importDefault } from "@/utils/import.js";
import { FeatureProps } from "@/typings/index.js";

export default Schematic.registerHandler({
    run: async ({ agent }) => {
        const featuresFolder = path.join(agent.rootDir, "features");
        const statDir = fs.statSync(featuresFolder);
        if (!statDir.isDirectory()) {
            logger.warn(`Features folder not found, creating...`);
            fs.mkdirSync(featuresFolder, { recursive: true });
        }

        for (const file of fs.readdirSync(featuresFolder)) {
            if (!file.endsWith(".js") && !file.endsWith(".ts")) {
                continue;
            }

            const filePath = path.join(featuresFolder, file);
            try {
                const feature = await importDefault<FeatureProps>(filePath);
                if (
                    !feature
                    || typeof feature !== "object"
                    || !feature.name
                    || !feature.condition
                    || !feature.run
                ) {
                    logger.warn(`Invalid feature in ${filePath}, skipping...`);
                    continue;
                }

                agent.features.set(feature.name, feature);
                logger.debug(`  📦 Loaded feature: ${feature.name}`);
            } catch (error) {
                logger.error(`Error loading feature from ${filePath}:`);
                logger.error(error as Error);
            }
        }
    },
});
