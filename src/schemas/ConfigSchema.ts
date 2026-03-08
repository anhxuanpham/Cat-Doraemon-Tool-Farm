import { z } from "zod/v4";

export const ConfigSchema = z.object({
    username: z.string().optional(),
    token: z.string().refine(value => value.split(".").length === 3, {
        error: "Token must have three parts separated by dots"
    }),
    guildID: z.string(),
    channelID: z.array(z.string()).min(1, {
        error: "At least one channel ID is required"
    }),
    // Feature toggles
    autoClaim: z.boolean().default(true),
    autoFight: z.boolean().default(true),
    autoFightS: z.boolean().default(true),
    autoFightT: z.boolean().default(true),
    autoFightBoss: z.boolean().default(true),
    autoWorldBoss: z.boolean().default(true),

    interCommandDelay: z.string().default("2000-6000"),
    captchaAPIKey: z.string().optional(),
});

export type Configuration = z.infer<typeof ConfigSchema>;
