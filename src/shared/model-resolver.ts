import { log } from "./logger"
import { getRoutingLogger } from "../features/budget-orchestrator/routing-logger"
import { fuzzyMatchModel } from "./model-availability"
import type { FallbackEntry } from "./model-requirements"
import { readConnectedProvidersCache } from "./connected-providers-cache"
import { getWeightCalculator } from "../features/budget-orchestrator/provider-weight-calculator"

export type ModelResolutionInput = {
	userModel?: string
	inheritedModel?: string
	systemDefault?: string
}

export type ModelSource =
	| "override"
	| "provider-fallback"
	| "system-default"

export type ModelResolutionResult = {
	model: string
	source: ModelSource
	variant?: string
}

type AvailableMatch = {
	fullModel: string
	provider: string
	model: string
	variant?: string
}

export type ExtendedModelResolutionInput = {
	userModel?: string
	preferredModel?: string
	fallbackChain?: FallbackEntry[]
	availableModels: Set<string>
	systemDefaultModel?: string
}

function normalizeModel(model?: string): string | undefined {
	const trimmed = model?.trim()
	return trimmed || undefined
}

function collectAvailableMatches(
	chain: FallbackEntry[],
	availableModels: Set<string>,
): AvailableMatch[] {
	const availableMatches: AvailableMatch[] = []

	for (const entry of chain) {
		for (const provider of entry.providers) {
			const fullModel = `${provider}/${entry.model}`
			const match = fuzzyMatchModel(fullModel, availableModels, [provider])
			if (match) {
				availableMatches.push({
					fullModel: match,
					provider,
					model: entry.model,
					variant: entry.variant,
				})
			}
		}
	}

	return availableMatches
}

export function resolveModel(input: ModelResolutionInput): string | undefined {
	return (
		normalizeModel(input.userModel) ??
		normalizeModel(input.inheritedModel) ??
		input.systemDefault
	)
}

export function resolveModelWithFallback(
	input: ExtendedModelResolutionInput,
): ModelResolutionResult | undefined {
	const { userModel, preferredModel, fallbackChain, availableModels, systemDefaultModel } = input

	// Step 1: Override
	const normalizedUserModel = normalizeModel(userModel)
	if (normalizedUserModel) {
		log("Model resolved via override", { model: normalizedUserModel })
		return { model: normalizedUserModel, source: "override" }
	}

	// Step 1.5: Preference-based routing (tier/capability hint)
	const normalizedPreferredModel = normalizeModel(preferredModel)
	if (normalizedPreferredModel && availableModels.size > 0) {
		const preferredParts = normalizedPreferredModel.split("/")
		const preferredModelId = preferredParts.length > 1
			? preferredParts.slice(1).join("/")
			: preferredParts[0]
		const providerSet = new Set<string>()
		for (const model of availableModels) {
			const [provider] = model.split("/")
			if (provider) providerSet.add(provider)
		}
		const preferredMatches: AvailableMatch[] = []
		for (const provider of providerSet) {
			const match = fuzzyMatchModel(preferredModelId, availableModels, [provider])
			if (match) {
				const variant = fallbackChain?.find(
					entry => entry.model === preferredModelId && entry.providers.includes(provider),
				)?.variant
				preferredMatches.push({
					fullModel: match,
					provider,
					model: preferredModelId,
					variant,
				})
			}
		}

		if (preferredMatches.length > 1) {
			try {
				const calculator = getWeightCalculator()
				const candidates = calculator.buildCandidates(
					preferredMatches.map(match => match.fullModel),
					{},
					undefined,
				)
				const selected = calculator.selectBestProvider(candidates)
				if (selected) {
					getRoutingLogger().logDebug(
						"routing_decision",
						`[model-resolver] Selected ${selected.model} from fallback chain`,
						{
							timestamp: new Date().toISOString(),
							use_case: "fallback_chain",
							candidates: candidates.map(c => c.model),
							weights: Object.fromEntries(candidates.map(c => [c.model, c.weight])),
							selected: selected.model,
							reason: "fallback chain weighted selection",
						}
					)
					log("Model resolved via preference weighted selection", {
						preferredModel: normalizedPreferredModel,
						selectedModel: selected.model,
						totalCandidates: preferredMatches.length,
					})
					return { model: selected.model, source: "provider-fallback" }
				}
			} catch (error) {
				log("Preference weighted selection failed, falling through to fallback chain", { error: String(error) })
			}
		}
		if (preferredMatches.length === 1) {
			const selected = preferredMatches[0]
			return { model: selected.fullModel, source: "provider-fallback", variant: selected.variant }
		}
	}

	// Step 2: Provider fallback chain (with availability check + weighted selection)
	if (fallbackChain && fallbackChain.length > 0) {
		if (availableModels.size === 0) {
			// When model cache is empty, we cannot verify if a provider actually has the model.
			// Skip fallback chain entirely and fall through to system default.
			// This prevents selecting provider/model combinations that may not exist.
			log("No model cache available, skipping fallback chain to use system default")
		}

		const availableMatches = collectAvailableMatches(fallbackChain, availableModels)

		if (availableMatches.length > 0) {
			// If only one match, use it immediately
			if (availableMatches.length === 1) {
				const selected = availableMatches[0]
				log("Model resolved via fallback chain (single match)", {
					provider: selected.provider,
					model: selected.model,
					fullModel: selected.fullModel,
					variant: selected.variant,
				})
				return { model: selected.fullModel, source: "provider-fallback", variant: selected.variant }
			}

			// Multiple matches available - use weighted selection to pick best provider
			try {
				const calculator = getWeightCalculator()
				
				// Build candidates for weighted selection
				// Note: We don't have usage data here, so weights will be based on provider classification only
				// This still helps by prioritizing subscriptions over API budgets
				const candidates = calculator.buildCandidates(
					availableMatches.map(match => match.fullModel),
					{}, // No usage data available at this level
					undefined // No reset time data
				)

				const selected = calculator.selectBestProvider(candidates)
				if (selected) {
					const match = availableMatches.find(match => match.fullModel === selected.model)
					if (match) {
						log("Model resolved via weighted selection", {
							provider: match.provider,
							model: match.model,
							fullModel: match.fullModel,
							weight: selected.weight,
							totalCandidates: availableMatches.length,
						})
						return { model: match.fullModel, source: "provider-fallback", variant: match.variant }
					}
				}
			} catch (error) {
				log("Weighted selection failed, falling back to first available", { error: String(error) })
			}

			// Fallback: If weighted selection fails, use first match (preserves backward compatibility)
			const first = availableMatches[0]
			log("Model resolved via fallback chain (weighted selection failed, using first)", {
				provider: first.provider,
				model: first.model,
				fullModel: first.fullModel,
				variant: first.variant,
			})
			return { model: first.fullModel, source: "provider-fallback", variant: first.variant }
		}

		log("No available model found in fallback chain, falling through to system default")
	}

	// Step 3: System default (if provided)
	if (systemDefaultModel === undefined) {
		log("No model resolved - systemDefaultModel not configured")
		return undefined
	}

	log("Model resolved via system default", { model: systemDefaultModel })
	return { model: systemDefaultModel, source: "system-default" }
}
