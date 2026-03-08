
/**
 * Generates a random integer between `min` (inclusive) and `max` (exclusive).
 */
export const ranInt = (min: number, max: number): number => {
    if (min === max) {
        throw new Error("Min and max cannot be the same value.");
    }
    return Math.abs(Math.floor(Math.random() * (max - min) + min));
}
