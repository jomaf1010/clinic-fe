import { onMounted, watch, type Ref } from 'vue'

interface FieldRef {
  value: unknown
}

/**
 * Persists form field values to localStorage with debounced saving.
 *
 * @param key        - localStorage key for the draft
 * @param fieldRefs  - Record of vee-validate field value refs (from useField)
 * @param extraRefs  - Optional extra refs (e.g. plain ref<string[]> for tags)
 */
export function useFormDraft(
  key: string,
  fieldRefs: Record<string, FieldRef>,
  extraRefs?: Record<string, Ref<unknown>>,
) {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function saveDraft() {
    const data: Record<string, unknown> = {}

    for (const [name, ref] of Object.entries(fieldRefs)) {
      data[name] = ref.value
    }

    if (extraRefs) {
      for (const [name, ref] of Object.entries(extraRefs)) {
        data[name] = ref.value
      }
    }

    localStorage.setItem(key, JSON.stringify(data))
  }

  function loadDraft() {
    const raw = localStorage.getItem(key)
    if (!raw) return

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
    }
  }

  function clearDraft() {
    localStorage.removeItem(key)
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

  return { clearDraft }
}
