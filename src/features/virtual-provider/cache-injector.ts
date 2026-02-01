import { ProviderModelsCache } from "../../shared/connected-providers-cache";

/**
 * Injects the "oh-im-broke" virtual provider into the provider models cache.
 * 
 * @param cache The existing provider models cache
 * @returns A new cache object with the virtual provider injected
 */
export function injectVirtualProvider(cache: ProviderModelsCache): ProviderModelsCache {
  const VIRTUAL_PROVIDER_ID = "oh-im-broke";
  const VIRTUAL_MODEL_ID = "oib-autoselect";

  // Create a new models object to avoid mutating the original
  const newModels = {
    ...cache.models,
    [VIRTUAL_PROVIDER_ID]: [VIRTUAL_MODEL_ID],
  };

  // Create a new connected array, adding the virtual provider if it's not already there
  const newConnected = cache.connected.includes(VIRTUAL_PROVIDER_ID)
    ? [...cache.connected]
    : [...cache.connected, VIRTUAL_PROVIDER_ID];

  return {
    ...cache,
    models: newModels,
    connected: newConnected,
    updatedAt: new Date().toISOString(),
  };
}
