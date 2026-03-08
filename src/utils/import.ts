import { pathToFileURL } from "node:url"

/**
 * Dynamically imports a module by its file path and returns its default export.
 */
export const importDefault = async <T>(id: string) => {
    const resolvedPath = pathToFileURL(id).href;
    const importedModule = await import(resolvedPath);
    return importedModule?.default as T | undefined;
}
