import { Collection } from "discord.js-selfbot-v13";

/**
 * Manages cooldowns for features, tracks expiration timestamps.
 */
export class CooldownManager {
    private cooldowns = new Collection<string, number>();

    private getKey(type: "feature", name: string): string {
        return `${type}:${name}`;
    }

    /**
     * Returns remaining cooldown time in ms, or 0 if not on cooldown.
     */
    public onCooldown(type: "feature", name: string): number {
        const key = this.getKey(type, name);
        const expirationTime = this.cooldowns.get(key);
        if (!expirationTime) {
            return 0;
        }
        return Math.max(expirationTime - Date.now(), 0);
    }

    /**
     * Sets a cooldown for a feature.
     * @param time The cooldown duration in milliseconds.
     */
    public set(type: "feature", name: string, time: number): void {
        const key = this.getKey(type, name);
        const expirationTime = Date.now() + time;
        this.cooldowns.set(key, expirationTime);
    }
}
