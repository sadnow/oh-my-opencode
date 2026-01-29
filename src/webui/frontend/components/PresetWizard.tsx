import { useState } from 'react'
import { PRESETS, type PresetConfig } from '../../../cli/wizard/presets'

type WizardStep = 'providers' | 'budget' | 'preference' | 'recommendation' | 'complete'

interface WizardState {
  selectedProviders: string[]
  budgetLevel: 'low' | 'medium' | 'high' | 'unlimited'
  preference: 'quality' | 'speed' | 'balanced'
  recommendedPreset: PresetConfig | null
  selectedPreset: PresetConfig | null
}

interface PresetWizardProps {
  onComplete?: (preset: PresetConfig) => void
  onSkip?: () => void
}

export function PresetWizard({ onComplete, onSkip }: PresetWizardProps) {
  const [step, setStep] = useState<WizardStep>('providers')
  const [wizardState, setWizardState] = useState<WizardState>({
    selectedProviders: [],
    budgetLevel: 'medium',
    preference: 'balanced',
    recommendedPreset: null,
    selectedPreset: null
  })

  const providers = ['anthropic', 'openai', 'google', 'github-copilot', 'opencode']
  const budgetOptions = [
    { value: 'low' as const, label: 'Budget-Friendly', description: 'Minimize cost, good for personal projects' },
    { value: 'medium' as const, label: 'Balanced', description: 'Good mix of quality and cost' },
    { value: 'high' as const, label: 'Quality-Focused', description: 'Best models, higher cost' },
    { value: 'unlimited' as const, label: 'No Limits', description: 'Premium quality regardless of cost' }
  ]
  const preferenceOptions = [
    { value: 'quality' as const, label: 'Quality First', description: 'Best reasoning, slower responses' },
    { value: 'speed' as const, label: 'Speed First', description: 'Fast responses, good for iteration' },
    { value: 'balanced' as const, label: 'Balanced', description: 'Good mix of quality and speed' }
  ]

  const calculateRecommendation = () => {
    const { selectedProviders, budgetLevel, preference } = wizardState

    // Score each preset based on user preferences
    const scoredPresets = Object.values(PRESETS)
      .filter((p): p is PresetConfig => p !== null)
      .map(preset => {
        let score = 0

        // Provider match
        const providerMatch = preset.requiredProviders.filter(rp => selectedProviders.includes(rp)).length
        score += providerMatch * 10

        // Budget match
        const cost = preset.metadata?.estimatedCostPerHour ?? 0
        if (budgetLevel === 'low' && cost <= 1) score += 15
        else if (budgetLevel === 'medium' && cost > 1 && cost <= 3) score += 10
        else if (budgetLevel === 'high' && cost > 3 && cost <= 6) score += 8
        else if (budgetLevel === 'unlimited' && cost > 6) score += 5

        // Preference match
        if (preference === 'quality' && cost > 2) score += 10
        else if (preference === 'speed' && cost <= 1.5) score += 10
        else if (preference === 'balanced' && cost >= 1 && cost <= 3) score += 10

        return { preset, score }
      })

    // Sort by score and pick top recommendation
    scoredPresets.sort((a, b) => b.score - a.score)
    return scoredPresets[0]?.preset || PRESETS.default
  }

  const handleNext = () => {
    if (step === 'providers') {
      setStep('budget')
    } else if (step === 'budget') {
      setStep('preference')
    } else if (step === 'preference') {
      const recommendation = calculateRecommendation()
      setWizardState(prev => ({ ...prev, recommendedPreset: recommendation, selectedPreset: recommendation }))
      setStep('recommendation')
    } else if (step === 'recommendation') {
      if (wizardState.selectedPreset) {
        onComplete?.(wizardState.selectedPreset)
        setStep('complete')
      }
    }
  }

  const handleBack = () => {
    if (step === 'budget') setStep('providers')
    else if (step === 'preference') setStep('budget')
    else if (step === 'recommendation') setStep('preference')
  }

  const handleProviderToggle = (provider: string) => {
    setWizardState(prev => ({
      ...prev,
      selectedProviders: prev.selectedProviders.includes(provider)
        ? prev.selectedProviders.filter(p => p !== provider)
        : [...prev.selectedProviders, provider]
    }))
  }

  const handleSkip = () => {
    onSkip?.()
  }

  const handleOverride = (preset: PresetConfig) => {
    setWizardState(prev => ({ ...prev, selectedPreset: preset }))
  }

  const getStepNumber = () => {
    const steps: Record<WizardStep, number> = {
      providers: 1,
      budget: 2,
      preference: 3,
      recommendation: 4,
      complete: 4
    }
    return steps[step]
  }

  const getStepTitle = () => {
    const titles: Record<WizardStep, string> = {
      providers: 'Select Providers',
      budget: 'Set Budget',
      preference: 'Choose Priority',
      recommendation: 'Recommended Preset',
      complete: 'Setup Complete'
    }
    return titles[step]
  }

  const getRecommendationReasoning = () => {
    const { selectedProviders, budgetLevel, preference, recommendedPreset } = wizardState
    if (!recommendedPreset) return []

    const reasons: string[] = []

    if (selectedProviders.length > 0) {
      const matched = recommendedPreset.requiredProviders.filter(rp => selectedProviders.includes(rp))
      if (matched.length > 0) {
        reasons.push(`Matches your selected providers: ${matched.join(', ')}`)
      }
    }

    const cost = recommendedPreset.metadata?.estimatedCostPerHour ?? 0
    if (budgetLevel === 'low' && cost <= 1) {
      reasons.push(`Budget-friendly at ~$${cost.toFixed(2)}/hour`)
    } else if (budgetLevel === 'medium' && cost >= 1 && cost <= 3) {
      reasons.push(`Balanced cost at ~$${cost.toFixed(2)}/hour`)
    } else if (budgetLevel === 'high' && cost > 3) {
      reasons.push(`Quality-focused with premium models`)
    }

    if (preference === 'quality' && cost > 2) {
      reasons.push(`Prioritizes quality with premium reasoning models`)
    } else if (preference === 'speed' && cost <= 1.5) {
      reasons.push(`Optimized for fast iteration cycles`)
    } else if (preference === 'balanced') {
      reasons.push(`Balanced approach to quality and speed`)
    }

    return reasons
  }

  if (step === 'complete') {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.successIcon}>✓</div>
          <h2 style={styles.title}>Setup Complete</h2>
          <p style={styles.description}>
            Your preset has been configured. You can always change it later.
          </p>
          <button
            onClick={onSkip}
            style={styles.primaryButton}
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.stepIndicator}>
            <div style={styles.stepNumber}>{getStepNumber()}</div>
            <div style={styles.stepDivider}>/</div>
            <div style={styles.stepTotal}>4</div>
          </div>
          <h2 style={styles.title}>{getStepTitle()}</h2>
          <button
            onClick={handleSkip}
            style={styles.skipButton}
          >
            Skip wizard
          </button>
        </div>

        {/* Progress bar */}
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${(getStepNumber() / 4) * 100}%`
            }}
          />
        </div>

        {/* Step content */}
        <div style={styles.content}>
          {step === 'providers' && (
            <div style={styles.stepContent}>
              <p style={styles.description}>
                Select the providers you have API keys for. This helps us recommend the best preset.
              </p>
              <div style={styles.providerGrid}>
                {providers.map(provider => (
                  <label
                    key={provider}
                    style={{
                      ...styles.providerCard,
                      ...(wizardState.selectedProviders.includes(provider) ? styles.providerCardSelected : {})
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={wizardState.selectedProviders.includes(provider)}
                      onChange={() => handleProviderToggle(provider)}
                      style={styles.checkbox}
                    />
                    <span style={styles.providerName}>{provider}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'budget' && (
            <div style={styles.stepContent}>
              <p style={styles.description}>
                What's your budget for AI model usage?
              </p>
              <div style={styles.optionList}>
                {budgetOptions.map(option => (
                  <label
                    key={option.value}
                    style={{
                      ...styles.optionCard,
                      ...(wizardState.budgetLevel === option.value ? styles.optionCardSelected : {})
                    }}
                  >
                    <input
                      type="radio"
                      name="budget"
                      value={option.value}
                      checked={wizardState.budgetLevel === option.value}
                      onChange={() => setWizardState(prev => ({ ...prev, budgetLevel: option.value }))}
                      style={styles.radio}
                    />
                    <div>
                      <div style={styles.optionLabel}>{option.label}</div>
                      <div style={styles.optionDescription}>{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'preference' && (
            <div style={styles.stepContent}>
              <p style={styles.description}>
                What matters most to you?
              </p>
              <div style={styles.optionList}>
                {preferenceOptions.map(option => (
                  <label
                    key={option.value}
                    style={{
                      ...styles.optionCard,
                      ...(wizardState.preference === option.value ? styles.optionCardSelected : {})
                    }}
                  >
                    <input
                      type="radio"
                      name="preference"
                      value={option.value}
                      checked={wizardState.preference === option.value}
                      onChange={() => setWizardState(prev => ({ ...prev, preference: option.value }))}
                      style={styles.radio}
                    />
                    <div>
                      <div style={styles.optionLabel}>{option.label}</div>
                      <div style={styles.optionDescription}>{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {step === 'recommendation' && (
            <div style={styles.stepContent}>
              <p style={styles.description}>
                Based on your preferences, we recommend:
              </p>

              {wizardState.recommendedPreset && (
                <div style={styles.recommendationCard}>
                  <div style={styles.recommendationHeader}>
                    <h3 style={styles.recommendationTitle}>{wizardState.recommendedPreset.name}</h3>
                    <span style={styles.recommendationBadge}>Recommended</span>
                  </div>
                  <p style={styles.recommendationDescription}>
                    {wizardState.recommendedPreset.description}
                  </p>

                  <div style={styles.reasoningSection}>
                    <h4 style={styles.reasoningTitle}>Why this preset?</h4>
                    <ul style={styles.reasoningList}>
                      {getRecommendationReasoning().map((reason, i) => (
                        <li key={i} style={styles.reasoningItem}>{reason}</li>
                      ))}
                    </ul>
                  </div>

                  <div style={styles.costSection}>
                    <span style={styles.costLabel}>Estimated cost:</span>
                    <span style={styles.costValue}>
                      ~${(wizardState.recommendedPreset.metadata?.estimatedCostPerHour ?? 0).toFixed(2)}/hour
                    </span>
                  </div>
                </div>
              )}

              <div style={styles.overrideSection}>
                <h4 style={styles.overrideTitle}>Choose a different preset</h4>
                <div style={styles.presetList}>
                  {Object.values(PRESETS)
                    .filter((p): p is PresetConfig => p !== null)
                    .map(preset => (
                      <button
                        key={preset.name}
                        onClick={() => handleOverride(preset)}
                        style={{
                          ...styles.presetButton,
                          ...(wizardState.selectedPreset?.name === preset.name ? styles.presetButtonSelected : {})
                        }}
                      >
                        {preset.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          {step !== 'providers' && (
            <button
              onClick={handleBack}
              style={styles.secondaryButton}
            >
              ← Back
            </button>
          )}
          <button
            onClick={handleNext}
            style={styles.primaryButton}
            disabled={
              (step === 'providers' && wizardState.selectedProviders.length === 0) ||
              (step === 'recommendation' && !wizardState.selectedPreset)
            }
          >
            {step === 'recommendation' ? 'Complete Setup' : 'Next →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  },
  card: {
    background: '#2a2a2a',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '600px',
    width: '100%',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
    border: '1px solid #3a3a3a'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px'
  },
  stepIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#00f0ff'
  },
  stepNumber: {
    color: '#00f0ff'
  },
  stepDivider: {
    color: '#666'
  },
  stepTotal: {
    color: '#666'
  },
  title: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center'
  },
  skipButton: {
    background: 'transparent',
    border: '1px solid #666',
    color: '#999',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  progressBar: {
    height: '4px',
    background: '#3a3a3a',
    borderRadius: '2px',
    marginBottom: '32px',
    overflow: 'hidden'
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #00f0ff, #0080ff)',
    transition: 'width 0.3s ease'
  },
  content: {
    minHeight: '300px'
  },
  stepContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px'
  },
  description: {
    margin: 0,
    fontSize: '16px',
    color: '#999',
    lineHeight: '1.6'
  },
  providerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '12px'
  },
  providerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px',
    background: '#333',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  providerCardSelected: {
    borderColor: '#00f0ff',
    background: '#1a3a3a'
  },
  checkbox: {
    width: '20px',
    height: '20px',
    accentColor: '#00f0ff'
  },
  providerName: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#fff',
    textTransform: 'capitalize'
  },
  optionList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  optionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '20px',
    background: '#333',
    border: '2px solid transparent',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  optionCardSelected: {
    borderColor: '#00f0ff',
    background: '#1a3a3a'
  },
  radio: {
    width: '20px',
    height: '20px',
    accentColor: '#00f0ff'
  },
  optionLabel: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '4px'
  },
  optionDescription: {
    fontSize: '14px',
    color: '#999'
  },
  recommendationCard: {
    padding: '24px',
    background: '#1a3a3a',
    border: '2px solid #00f0ff',
    borderRadius: '12px',
    marginBottom: '24px'
  },
  recommendationHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  recommendationTitle: {
    margin: 0,
    fontSize: '24px',
    fontWeight: 'bold',
    color: '#fff'
  },
  recommendationBadge: {
    padding: '6px 12px',
    background: '#00f0ff',
    color: '#1a1a1a',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  recommendationDescription: {
    margin: '0 0 20px 0',
    fontSize: '16px',
    color: '#ccc',
    lineHeight: '1.6'
  },
  reasoningSection: {
    marginBottom: '20px'
  },
  reasoningTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#00f0ff',
    textTransform: 'uppercase'
  },
  reasoningList: {
    margin: 0,
    paddingLeft: '20px',
    color: '#999'
  },
  reasoningItem: {
    marginBottom: '8px',
    fontSize: '14px'
  },
  costSection: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '16px',
    borderTop: '1px solid #3a3a3a'
  },
  costLabel: {
    fontSize: '14px',
    color: '#999'
  },
  costValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#ff6b00'
  },
  overrideSection: {
    marginTop: '24px'
  },
  overrideTitle: {
    margin: '0 0 16px 0',
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#fff'
  },
  presetList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  presetButton: {
    padding: '10px 16px',
    background: '#333',
    border: '2px solid transparent',
    borderRadius: '8px',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s'
  },
  presetButtonSelected: {
    borderColor: '#ff6b00',
    background: '#3a2a1a'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    marginTop: '32px'
  },
  primaryButton: {
    flex: 1,
    padding: '16px 32px',
    background: 'linear-gradient(135deg, #00f0ff, #0080ff)',
    border: 'none',
    borderRadius: '12px',
    color: '#1a1a1a',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    opacity: 1
  },
  secondaryButton: {
    padding: '16px 32px',
    background: 'transparent',
    border: '2px solid #666',
    borderRadius: '12px',
    color: '#fff',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  successIcon: {
    width: '80px',
    height: '80px',
    margin: '0 auto 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '48px',
    fontWeight: 'bold',
    background: 'linear-gradient(135deg, #00f0ff, #0080ff)',
    borderRadius: '50%',
    color: '#1a1a1a'
  }
}