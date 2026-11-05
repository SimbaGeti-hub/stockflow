import { useTheme } from './useTheme'
import type { ThemePreference } from './ThemeContext'

const options: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
]

export function ThemeToggle() {
  const { preference, setPreference } = useTheme()

  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-lg border border-border p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={preference === option.value}
          onClick={() => setPreference(option.value)}
          className={[
            'rounded-md px-2.5 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
            preference === option.value ? 'bg-primary text-primary-contrast' : 'text-muted hover:text-text',
          ].join(' ')}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
