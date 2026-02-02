import { log } from "./logger"
import { getRoutingLogger } from "../features/budget-orchestrator/routing-logger"
import { fuzzyMatchModel } from "./model-availability"
import type { FallbackEntry } from "./model-requirements"
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
	disabledProviders?: string[]
	/** Usage percentages by provider for weighted selection (canonical provider IDs) */
	usagePercentByProvider?: Record<string, number>
	/** Days until reset by provider for reset bonus (canonical provider IDs) */
	daysUntilResetByProvider?: Record<string, number>
	/** Spending velocity by provider in %/day (canonical provider IDs) */
	velocityByProvider?: Record<string, number>
}

function normalizeModel(model?: string): string | undefined {
	const trimmed = model?.trim()
	return trimmed || undefined
}

function normalizeModelForMatch(name: string): string {
	return name
		.toLowerCase()
		.replace(/claude-(opus|sonnet|haiku)-4-5/g, "claude-$1-4.5")
		.replace(/claude-(opus|sonnet|haiku)-4\.5/g, "claude-$1-4.5")
}

function stripProviderPrefix(model: string): string {
	const parts = model.split("/")
	return parts.length > 1 ? parts.slice(1).join("/") : parts[0]
}

function sanitizePreferredModel(model?: string): string | undefined {
	const normalized = normalizeModel(model)
	if (!normalized) return undefined
	const withoutFragment = normalized.split("#")[0]
	const withoutQuery = withoutFragment.split("?")[0]
	return withoutQuery.trim() || undefined
}

function normalizePreferredModel(model?: string): string | undefined {
	const sanitized = sanitizePreferredModel(model)
	if (!sanitized) return undefined
	return stripProviderPrefix(sanitized).trim() || undefined
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
	const disabledProviders = new Set(
		(input.disabledProviders ?? []).map(provider => provider.trim()).filter(Boolean),
	)

	// Step 1: Override
	const normalizedUserModel = normalizeModel(userModel)
	if (normalizedUserModel) {
		const overrideProvider = normalizedUserModel.split("/")[0]
		if (overrideProvider && disabledProviders.has(overrideProvider)) {
			log("Override model provider disabled; ignoring override", {
				model: normalizedUserModel,
				provider: overrideProvider,
			})
		} else {
			log("Model resolved via override", { model: normalizedUserModel })
			return { model: normalizedUserModel, source: "override" }
		}
	}

	// Step 1.5: Preference-based routing (tier/capability hint)
	const normalizedPreferredModel = sanitizePreferredModel(preferredModel)
	const preferredModelId = normalizePreferredModel(preferredModel)
	const preferredMatchKey = preferredModelId ? normalizeModelForMatch(preferredModelId) : undefined
	if (normalizedPreferredModel && preferredModelId && availableModels.size > 0) {
		const preferredMatches: AvailableMatch[] = []
		if (fallbackChain && fallbackChain.length > 0) {
			for (const entry of fallbackChain) {
				if (normalizeModelForMatch(entry.model) !== preferredMatchKey) {
					continue
				}
				for (const provider of entry.providers) {
					if (disabledProviders.has(provider)) {
						continue
					}
					const match = fuzzyMatchModel(preferredModelId, availableModels, [provider])
					if (match) {
						preferredMatches.push({
							fullModel: match,
							provider,
							model: entry.model,
							variant: entry.variant,
						})
					}
				}
				if (preferredMatches.length > 0) {
					break
				}
			}
		} else if (preferredMatchKey) {
			for (const fullModel of availableModels) {
				const provider = fullModel.split("/")[0]
				if (disabledProviders.has(provider)) {
					continue
				}
				const modelId = stripProviderPrefix(fullModel)
				if (!modelId) {
					continue
				}
				if (!normalizeModelForMatch(modelId).includes(preferredMatchKey)) {
					continue
				}
				preferredMatches.push({
					fullModel,
					provider,
					model: modelId,
				})
			}
		}

		if (preferredMatches.length > 1) {
			try {
				const calculator = getWeightCalculator()
			const candidates = calculator.buildCandidates(
				preferredMatches.map(match => match.fullModel),
				input.usagePercentByProvider ?? {},
				input.daysUntilResetByProvider,
				input.velocityByProvider,
			)
				const selected = calculator.selectBestProvider(candidates)
				if (selected) {
					const selectedMatch = preferredMatches.find(match => match.fullModel === selected.model)
					if (selectedMatch) {
						getRoutingLogger().logDebug(
							"routing_decision",
							`[model-resolver] Selected ${selected.model} from fallback chain`,
							{
								timestamp: new Date().toISOString(),
								use_case: fallbackChain ? "fallback_chain" : "preferred_model",
								candidates: candidates.map(c => c.model),
								weights: Object.fromEntries(candidates.map(c => [c.model, c.weight])),
								selected: selected.model,
								reason: fallbackChain ? "fallback chain weighted selection" : "preferred model weighted selection",
							}
						)
						log("Model resolved via preference weighted selection", {
							preferredModel: normalizedPreferredModel,
							selectedModel: selected.model,
							totalCandidates: preferredMatches.length,
						})
						return { model: selected.model, source: "provider-fallback", variant: selectedMatch.variant }
					}
				}
			} catch (error) {
				log("Preference weighted selection failed, falling through to fallback chain", { error: String(error) })
			}
		}
		if (preferredMatches.length === 1) {
			const selected = preferredMatches[0]
			getRoutingLogger().logDebug(
				"routing_decision",
				`[model-resolver] Selected ${selected.fullModel} from preference match`,
				{
					timestamp: new Date().toISOString(),
					use_case: fallbackChain ? "fallback_chain" : "preferred_model",
					candidates: [selected.fullModel],
					weights: { [selected.fullModel]: 1 },
					selected: selected.fullModel,
					reason: fallbackChain ? "fallback chain single match" : "preferred model single match",
				}
			)
			return { model: selected.fullModel, source: "provider-fallback", variant: selected.variant }
		}
	}

	// Step 2: Provider fallback chain (with availability check)
	if (fallbackChain && fallbackChain.length > 0) {
		if (availableModels.size === 0) {
			// When model cache is empty, we cannot verify if a provider actually has the model.
			// Skip fallback chain entirely and fall through to system default.
			// This prevents selecting provider/model combinations that may not exist.
			log("No model cache available, skipping fallback chain to use system default")
		} else {
			for (const entry of fallbackChain) {
				for (const provider of entry.providers) {
					if (disabledProviders.has(provider)) {
						continue
					}
					const match = fuzzyMatchModel(entry.model, availableModels, [provider])
				if (match) {
					getRoutingLogger().logDebug(
						"routing_decision",
						`[model-resolver] Selected ${match} from fallback chain`,
						{
							timestamp: new Date().toISOString(),
							use_case: "fallback_chain",
							candidates: [match],
							weights: { [match]: 1 },
							selected: match,
							reason: "fallback chain single match",
						}
					)
					log("Model resolved via fallback chain (single match)", {
						provider,
						model: entry.model,
						fullModel: match,
						variant: entry.variant,
						})
						return { model: match, source: "provider-fallback", variant: entry.variant }
					}
				}
			}

			log("No available model found in fallback chain, falling through to system default")
		}
	}

	// Step 3: System default (if provided)
	if (systemDefaultModel === undefined) {
		log("No model resolved - systemDefaultModel not configured")
		return undefined
	}

	const systemProvider = systemDefaultModel.split("/")[0]
	if (systemProvider && disabledProviders.has(systemProvider)) {
		log("System default provider disabled; no model resolved", {
			model: systemDefaultModel,
			provider: systemProvider,
		})
		return undefined
	}

	log("Model resolved via system default", { model: systemDefaultModel })
	return { model: systemDefaultModel, source: "system-default" }
}
