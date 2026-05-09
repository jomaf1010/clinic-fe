import { computed, onMounted, watch, type Ref } from 'vue'

interface FieldRef {
  value: unknown
}

interface FormDraftOptions {
  storage?: Storage
}

/**
 * Persists form field values to storage with debounced saving.
 *
 * @param key        - storage key for the draft; null disables persistence
 * @param fieldRefs  - Record of vee-validate field value refs (from useField)
 * @param extraRefs  - Optional extra refs (e.g. plain ref<string[]> for tags)
 */
export function useFormDraft(
  key: string | Ref<string | null>,
  fieldRefs: Record<string, FieldRef>,
  extraRefs?: Record<string, Ref<unknown>>,
  options: FormDraftOptions = {},
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  const storage = options.storage ?? localStorage
  const currentKey = computed(() => typeof key === 'string' ? key : key.value)

  function cloneValue(value: unknown): unknown {
    if (value === undefined || value === null) return value

    try {
      if (typeof structuredClone === 'function') return structuredClone(value)
    } catch {
      // Vue proxy values can fail structuredClone; fall through to JSON clone.
    }

    try {
      return JSON.parse(JSON.stringify(value)) as unknown
    } catch {
      return value
    }
  }

  function snapshotRefs(refs: Record<string, FieldRef>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(refs).map(([name, ref]) => [name, cloneValue(ref.value)]),
    )
  }

  const initialFieldValues = snapshotRefs(fieldRefs)
  const initialExtraValues = snapshotRefs(extraRefs ?? {})

  function resetToInitialValues() {
    for (const [name, value] of Object.entries(initialFieldValues)) {
      if (fieldRefs[name]) fieldRefs[name].value = cloneValue(value)
    }

    if (extraRefs) {
      for (const [name, value] of Object.entries(initialExtraValues)) {
        if (extraRefs[name]) extraRefs[name].value = cloneValue(value)
      }
    }
  }

  function saveDraft() {
    const draftKey = currentKey.value
    if (!draftKey) return

    const data: Record<string, unknown> = {}

    for (const [name, ref] of Object.entries(fieldRefs)) {
      data[name] = ref.value
    }

    if (extraRefs) {
      for (const [name, ref] of Object.entries(extraRefs)) {
        data[name] = ref.value
      }
    }

    storage.setItem(draftKey, JSON.stringify(data))
  }

  function loadDraft(resetIfMissing = false) {
    const draftKey = currentKey.value
    if (!draftKey) {
      if (resetIfMissing) resetToInitialValues()
      return
    }

    const raw = storage.getItem(draftKey)
    if (!raw) {
      if (resetIfMissing) resetToInitialValues()
      return
    }

    try {
      const data = JSON.parse(raw) as Record<string, unknown>

      for (const [name, ref] of Object.entries(fieldRefs)) {
        if (name in data && data[name] != null) {
          ref.value = data[name]
        }
      }

      if (extraRefs) {
        for (const [name, ref] of Object.entries(extraRefs)) {
          if (name in data && data[name] != null) {
            ref.value = data[name] as typeof ref.value
          }
        }
      }
    } catch {
      // Corrupted draft — ignore
      if (resetIfMissing) resetToInitialValues()
    }
  }

  function clearDraft() {
    const draftKey = currentKey.value
    if (!draftKey) return

    storage.removeItem(draftKey)
  }

  onMounted(() => {
    loadDraft()
  })

  const allRefs = () => {
    const values: unknown[] = Object.values(fieldRefs).map((r) => r.value)
    if (extraRefs) {
      values.push(...Object.values(extraRefs).map((r) => r.value))
    }
    return values
  }

  watch(allRefs, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(saveDraft, 500)
  })

  watch(currentKey, () => {
    if (debounceTimer) clearTimeout(debounceTimer)
    loadDraft(true)
  })

  return { clearDraft }
}
