import { ref } from 'vue'
import { messageApi } from '../api/messageApi'

export function useTypingIndicator(conversationId: () => string | null) {
  let lastSent = 0
  const throttleMs = 2000
  const isSending = ref(false)

  function onInput(): void {
    const id = conversationId()
    if (!id) return

    const now = Date.now()
    if (now - lastSent < throttleMs) return

    lastSent = now
    isSending.value = true

    messageApi.sendTyping(id).catch(() => {}).finally(() => {
      isSending.value = false
    })
  }

  return { onInput }
}
