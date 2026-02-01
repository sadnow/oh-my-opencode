import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs"
import { join } from "path"
import { log } from "./logger"
import { getOmoOpenCodeCacheDir } from "./data-path"

const CONNECTED_PROVIDERS_CACHE_FILE = "connected-providers.json"
const PROVIDER_MODELS_CACHE_FILE = "provider-models.json"

interface ConnectedProvidersCache {
	connected: string[]
	updatedAt: string
}

export interface ProviderModelsCache {
	models: Record<string, string[]>
	connected: string[]
	updatedAt: string
}

function getCacheFilePath(filename: string): string {
	return join(getOmoOpenCodeCacheDir(), filename)
}

function ensureCacheDir(): void {
	const cacheDir = getOmoOpenCodeCacheDir()
	if (!existsSync(cacheDir)) {
		mkdirSync(cacheDir, { recursive: true })
	}
}

/**
 * Read the connected providers cache.
 * Returns the list of connected provider IDs, or null if cache doesn't exist.
 */
export function readConnectedProvidersCache(): string[] | null {
	const cacheFile = getCacheFilePath(CONNECTED_PROVIDERS_CACHE_FILE)

	if (!existsSync(cacheFile)) {
		log("[connected-providers-cache] Cache file not found", { cacheFile })
		return null
	}

	try {
		const content = readFileSync(cacheFile, "utf-8")
		const data = JSON.parse(content) as ConnectedProvidersCache
		log("[connected-providers-cache] Read cache", { count: data.connected.length, updatedAt: data.updatedAt })
		return data.connected
	} catch (err) {
		log("[connected-providers-cache] Error reading cache", { error: String(err) })
		return null
	}
}

/**
 * Check if connected providers cache exists.
 */
export function hasConnectedProvidersCache(): boolean {
	const cacheFile = getCacheFilePath(CONNECTED_PROVIDERS_CACHE_FILE)
	return existsSync(cacheFile)
}

/**
 * Write the connected providers cache.
 */
function writeConnectedProvidersCache(connected: string[]): void {
	ensureCacheDir()
	const cacheFile = getCacheFilePath(CONNECTED_PROVIDERS_CACHE_FILE)

	const data: ConnectedProvidersCache = {
		connected,
		updatedAt: new Date().toISOString(),
	}

	try {
		writeFileSync(cacheFile, JSON.stringify(data, null, 2))
		log("[connected-providers-cache] Cache written", { count: connected.length })
	} catch (err) {
		log("[connected-providers-cache] Error writing cache", { error: String(err) })
	}
}

/**
 * Read the provider-models cache.
 * Returns the cache data, or null if cache doesn't exist.
 */
export function readProviderModelsCache(): ProviderModelsCache | null {
	const cacheFile = getCacheFilePath(PROVIDER_MODELS_CACHE_FILE)

	if (!existsSync(cacheFile)) {
		log("[connected-providers-cache] Provider-models cache file not found", { cacheFile })
		return null
	}

	try {
		const content = readFileSync(cacheFile, "utf-8")
		const data = JSON.parse(content) as ProviderModelsCache
		log("[connected-providers-cache] Read provider-models cache", { 
			providerCount: Object.keys(data.models).length, 
			updatedAt: data.updatedAt 
		})
		return data
	} catch (err) {
		log("[connected-providers-cache] Error reading provider-models cache", { error: String(err) })
		return null
	}
}

/**
 * Check if provider-models cache exists.
 */
export function hasProviderModelsCache(): boolean {
	const cacheFile = getCacheFilePath(PROVIDER_MODELS_CACHE_FILE)
	return existsSync(cacheFile)
}

/**
 * Write the provider-models cache.
 */
export function writeProviderModelsCache(data: { models: Record<string, string[]>; connected: string[] }): void {
	ensureCacheDir()
	const cacheFile = getCacheFilePath(PROVIDER_MODELS_CACHE_FILE)

	const cacheData: ProviderModelsCache = {
		...data,
		updatedAt: new Date().toISOString(),
	}

	try {
		writeFileSync(cacheFile, JSON.stringify(cacheData, null, 2))
		log("[connected-providers-cache] Provider-models cache written", { 
			providerCount: Object.keys(data.models).length 
		})
	} catch (err) {
		log("[connected-providers-cache] Error writing provider-models cache", { error: String(err) })
	}
}

// Timeout duration for API calls (in milliseconds)
const API_TIMEOUT_MS = 5000

/**
 * Helper to add timeout to a promise.
 * Prevents indefinite blocking if API calls don't respond.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, operation: string): Promise<T> {
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => {
			reject(new Error(`${operation} timed out after ${ms}ms`))
		}, ms)
		promise
			.then((result) => {
				clearTimeout(timer)
				resolve(result)
			})
			.catch((err) => {
				clearTimeout(timer)
				reject(err)
			})
	})
}

/**
 * Update the connected providers cache by fetching from the client.
 * Also updates the provider-models cache with model lists per provider.
 */
export async function updateConnectedProvidersCache(client: {
	provider?: {
		list?: () => Promise<{ data?: { connected?: string[] } }>
	}
	model?: {
		list?: () => Promise<{ data?: Array<{ id: string; provider: string }> }>
	}
}): Promise<void> {
	if (!client?.provider?.list) {
		log("[connected-providers-cache] client.provider.list not available")
		return
	}

	try {
		const result = await withTimeout(client.provider.list(), API_TIMEOUT_MS, "client.provider.list()")
		const connected = result.data?.connected ?? []
		log("[connected-providers-cache] Fetched connected providers", { count: connected.length, providers: connected })

		writeConnectedProvidersCache(connected)

		// Also update provider-models cache if model.list is available
		if (client.model?.list) {
			try {
				const modelsResult = await withTimeout(client.model.list(), API_TIMEOUT_MS, "client.model.list()")
				const models = modelsResult.data ?? []

				const modelsByProvider: Record<string, string[]> = {}
				for (const model of models) {
					if (!modelsByProvider[model.provider]) {
						modelsByProvider[model.provider] = []
					}
					modelsByProvider[model.provider].push(model.id)
				}

				writeProviderModelsCache({
					models: modelsByProvider,
					connected,
				})

				log("[connected-providers-cache] Provider-models cache updated", {
					providerCount: Object.keys(modelsByProvider).length,
					totalModels: models.length,
				})
			} catch (modelErr) {
				log("[connected-providers-cache] Error fetching models", { error: String(modelErr) })
			}
		}
	} catch (err) {
		log("[connected-providers-cache] Error updating cache", { error: String(err) })
	}
}
