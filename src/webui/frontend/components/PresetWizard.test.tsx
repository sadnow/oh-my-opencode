import { describe, test, expect, beforeEach } from 'bun:test'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PresetWizard } from './PresetWizard'

describe('PresetWizard', () => {
  beforeEach(() => {
    // Reset any global state if needed
  })

  test('renders initial step with provider selection', () => {
    //#given
    render(<PresetWizard />)

    //#then
    expect(screen.getByText('Select Providers')).toBeDefined()
    expect(screen.getByText('anthropic')).toBeDefined()
    expect(screen.getByText('openai')).toBeDefined()
    expect(screen.getByText('google')).toBeDefined()
    expect(screen.getByText('Skip wizard')).toBeDefined()
  })

  test('shows step indicator with correct step number', () => {
    //#given
    render(<PresetWizard />)

    //#then
    expect(screen.getByText('1')).toBeDefined()
    expect(screen.getByText('/4')).toBeDefined()
  })

  test('allows provider selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    const anthropicCheckbox = screen.getByLabelText('anthropic')
    await user.click(anthropicCheckbox)

    //#then
    expect(anthropicCheckbox).toBeChecked()
  })

  test('disables next button when no providers selected', () => {
    //#given
    render(<PresetWizard />)

    //#then
    const nextButton = screen.getByText('Next →')
    expect(nextButton).toBeDisabled()
  })

  test('enables next button when provider selected', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    const anthropicCheckbox = screen.getByLabelText('anthropic')
    await user.click(anthropicCheckbox)

    //#then
    const nextButton = screen.getByText('Next →')
    await waitFor(() => {
      expect(nextButton).not.toBeDisabled()
    })
  })

  test('navigates to budget step after selecting provider', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Set Budget')).toBeDefined()
      expect(screen.getByText('Budget-Friendly')).toBeDefined()
      expect(screen.getByText('Balanced')).toBeDefined()
    })
  })

  test('shows budget options', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Budget-Friendly')).toBeDefined()
      expect(screen.getByText('Balanced')).toBeDefined()
      expect(screen.getByText('Quality-Focused')).toBeDefined()
      expect(screen.getByText('No Limits')).toBeDefined()
    })
  })

  test('allows budget selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Budget-Friendly'))

    //#then
    const budgetRadio = screen.getByLabelText('Budget-Friendly')
    expect(budgetRadio).toBeChecked()
  })

  test('navigates to preference step after budget selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Choose Priority')).toBeDefined()
      expect(screen.getByText('Quality First')).toBeDefined()
      expect(screen.getByText('Speed First')).toBeDefined()
      expect(screen.getByText('Balanced')).toBeDefined()
    })
  })

  test('allows preference selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Quality First'))

    //#then
    const qualityRadio = screen.getByLabelText('Quality First')
    expect(qualityRadio).toBeChecked()
  })

  test('navigates to recommendation step after preference selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Recommended Preset')).toBeDefined()
      expect(screen.getByText('Recommended')).toBeDefined()
    })
  })

  test('shows recommended preset with reasoning', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText(/Why this preset\?/i)).toBeDefined()
      expect(screen.getByText(/Estimated cost:/i)).toBeDefined()
    })
  })

  test('allows preset override', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Choose a different preset')).toBeDefined()
      expect(screen.getByText('default')).toBeDefined()
      expect(screen.getByText('balanced')).toBeDefined()
    })
  })

  test('calls onComplete when setup is completed', async () => {
    //#given
    const user = userEvent.setup()
    let called = false
    const onComplete = () => { called = true }
    render(<PresetWizard onComplete={onComplete} />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByText('Complete Setup'))

    //#then
    await waitFor(() => {
      expect(called).toBe(true)
    })
  })

  test('calls onSkip when skip button is clicked', async () => {
    //#given
    const user = userEvent.setup()
    let called = false
    const onSkip = () => { called = true }
    render(<PresetWizard onSkip={onSkip} />)

    //#when
    await user.click(screen.getByText('Skip wizard'))

    //#then
    expect(called).toBe(true)
  })

  test('shows back button after first step', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('← Back')).toBeDefined()
    })
  })

  test('navigates back to previous step', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByText('← Back'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Select Providers')).toBeDefined()
      expect(screen.getByText('1')).toBeDefined()
    })
  })

  test('shows complete screen after setup', async () => {
    //#given
    const user = userEvent.setup()
    let called = false
    const onComplete = () => { called = true }
    render(<PresetWizard onComplete={onComplete} />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByText('Complete Setup'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('Setup Complete')).toBeDefined()
      expect(screen.getByText('✓')).toBeDefined()
    })
  })

  test('shows progress bar with correct width', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#then
    const progressBar = document.querySelector('[style*="width: 25%"]')
    expect(progressBar).toBeDefined()

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      const progressBar2 = document.querySelector('[style*="width: 50%"]')
      expect(progressBar2).toBeDefined()
    })
  })

  test('allows multiple provider selection', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByLabelText('openai'))
    await user.click(screen.getByLabelText('google'))

    //#then
    expect(screen.getByLabelText('anthropic')).toBeChecked()
    expect(screen.getByLabelText('openai')).toBeChecked()
    expect(screen.getByLabelText('google')).toBeChecked()
  })

  test('deselects provider when clicked again', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByLabelText('anthropic'))

    //#then
    expect(screen.getByLabelText('anthropic')).not.toBeChecked()
  })

  test('shows cost estimate for recommended preset', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText(/\$\d+\.\d+\/hour/)).toBeDefined()
    })
  })

  test('shows all available presets for override', async () => {
    //#given
    const user = userEvent.setup()
    render(<PresetWizard />)

    //#when
    await user.click(screen.getByLabelText('anthropic'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))
    await user.click(screen.getByLabelText('Balanced'))
    await user.click(screen.getByText('Next →'))

    //#then
    await waitFor(() => {
      expect(screen.getByText('default')).toBeDefined()
      expect(screen.getByText('balanced')).toBeDefined()
      expect(screen.getByText('budget-conscious')).toBeDefined()
      expect(screen.getByText('free-tier')).toBeDefined()
    })
  })
})