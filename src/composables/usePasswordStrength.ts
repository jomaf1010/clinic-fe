import { computed, type Ref } from 'vue'

export type PasswordStrengthLevel = 'weak' | 'fair' | 'strong'

export interface PasswordStrength {
  level: PasswordStrengthLevel
  label: string
  feedback: string
}

/**
 * Common passwords + Filipino-specific patterns.
 * This list is advisory/UX-only — it drives the strength indicator.
 * The backend is the authoritative gate; a password can pass this list
 * and still be rejected server-side.
 */
const BLOCKLIST = new Set([
  // Universal commons
  'password', 'password1', 'password123', '123456789', '1234567890',
  'qwerty123', 'qwertyuiop', 'iloveyou', 'sunshine', 'princess',
  'welcome1', 'monkey123', 'dragon123', 'master123', 'superman',
  'batman123', 'letmein1', 'passw0rd', 'p@ssword', 'p@ssw0rd',
  'admin1234', 'admin123!', 'trustno1', 'abc123456', 'football',
  'baseball', 'soccer123', 'hockey123', 'shadow123', 'michael1',
  'jessica1', 'charlie1', 'donald123', 'andrew123', 'thomas12',
  'ranger123', 'daniel12', 'harley123', 'hunter123', 'joshua12',
  'robert123', 'george123', 'jordan123', 'jennifer1', 'buster123',
  'pepper123', 'cookie123', 'butter123', 'cheese123', 'banana12',
  // Filipino first names
  'mariajose', 'juandelacruz', 'josemaria', 'mariaclara',
  'babaybading', 'pinoyako', 'pilipino1', 'pilipinas',
  // Filipino surnames
  'delacruz1', 'delos reyes', 'delossantos', 'reyes1234',
  'santos123', 'garcia123', 'cruz12345', 'ramos1234', 'flores123',
  'gomez1234', 'mendoza12', 'castro123', 'torres123', 'ramirez12',
  'aquino123', 'marcos123', 'duterte12', 'arroyo123', 'estrada12',
  // App-specific patterns
  'mediflow1', 'mediflow!', 'clinic123', 'clinic1234', 'doctor123',
  'nurse1234', 'patient12', 'hospital1', 'health123', 'medical12',
  'filipinodoc', 'doctorph1', 'nurseph12',
])

function isBlocklisted(password: string): boolean {
  return BLOCKLIST.has(password.toLowerCase())
}

function scorePassword(password: string): number {
  if (password.length < 10) return 0

  let score = 0

  // Length scoring
  if (password.length >= 14) score += 2
  else if (password.length >= 12) score += 1

  // Character variety
  if (/[a-z]/.test(password)) score += 1
  if (/[A-Z]/.test(password)) score += 1
  if (/[0-9]/.test(password)) score += 1
  if (/[^a-zA-Z0-9]/.test(password)) score += 2

  return score
}

export function usePasswordStrength(password: Ref<string>) {
  const strength = computed((): PasswordStrength => {
    const val = password.value ?? ''

    if (!val) {
      return { level: 'weak', label: 'Weak', feedback: '' }
    }

    if (val.length < 10) {
      return { level: 'weak', label: 'Weak', feedback: 'Too short — use at least 10 characters' }
    }

    if (isBlocklisted(val)) {
      return { level: 'weak', label: 'Weak', feedback: 'Too common — choose a less predictable password' }
    }

    const score = scorePassword(val)

    if (score >= 5) {
      return { level: 'strong', label: 'Strong', feedback: '' }
    }

    if (score >= 2) {
      return { level: 'fair', label: 'Fair', feedback: 'Decent — mix in symbols or uppercase to strengthen' }
    }

    return { level: 'weak', label: 'Weak', feedback: 'Weak — try adding variety (uppercase, numbers, symbols)' }
  })

  return { strength }
}
