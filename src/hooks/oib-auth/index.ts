import type { AuthHook } from "@opencode-ai/plugin"

/**
 * OIB Auth Hook
 *
 * Registers the "oh-im-broke" virtual provider for authentication.
 * This provider doesn't require actual authentication - it's a virtual
 * provider that routes requests through the budget orchestrator.
 */
export function createOibAuthHook(): AuthHook {
  return {
    provider: "oh-im-broke",
    loader: async () => ({
      models: [{
        id: "oib-autoselect",
        name: "OIB Autoselect",
        provider: "oh-im-broke",
      }]
    }),
    methods: [
      {
        type: "api",
        label: "Oh Im Broke Budget Router",
        authorize: async () => ({
          type: "success",
          key: "virtual-no-auth",
          provider: "oh-im-broke",
        }),
      },
    ],
  }
}
