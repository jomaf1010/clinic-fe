<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { SendHorizontal, Smile, LoaderCircle, User } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { patientApi } from '@/domains/patient/api/patientApi'
import type { PatientSearchResult } from '@/domains/patient/types/patient.types'

const emit = defineEmits<{
  send: [body: string]
  typing: []
}>()

const editorRef = ref<HTMLDivElement | null>(null)
const emojiOpen = ref(false)
const isEditorEmpty = ref(true)

// --- @patient mention ---
const mentionQuery = ref<string | null>(null)
const mentionResults = ref<PatientSearchResult[]>([])
const mentionLoading = ref(false)
const mentionActiveIndex = ref(0)
let mentionDebounce: ReturnType<typeof setTimeout> | null = null
let mentionRange: Range | null = null
let mentionTextNode: Text | null = null
let mentionStartOffset = -1

const showMention = computed(() => mentionQuery.value !== null)

watch(mentionQuery, (q) => {
  if (mentionDebounce) clearTimeout(mentionDebounce)
  mentionActiveIndex.value = 0

  if (q === null || q.length < 1) {
    mentionResults.value = []
    return
  }

  mentionDebounce = setTimeout(async () => {
    mentionLoading.value = true
    try {
      const response = await patientApi.search(q)
      mentionResults.value = response.data.slice(0, 6)
    } catch {
      mentionResults.value = []
    } finally {
      mentionLoading.value = false
    }
  }, 250)
})

function detectMention() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return

  const range = sel.getRangeAt(0)
  const node = range.startContainer

  if (node.nodeType !== Node.TEXT_NODE) {
    closeMention()
    return
  }

  const text = node.textContent ?? ''
  const cursor = range.startOffset
  const beforeCursor = text.substring(0, cursor)

  const match = beforeCursor.match(/(?:^|[\s])@(\S*)$/)

  if (match) {
    mentionTextNode = node as Text
    mentionStartOffset = beforeCursor.lastIndexOf('@')
    mentionQuery.value = match[1]
    mentionRange = range.cloneRange()
  } else {
    closeMention()
  }
}

function selectPatient(patient: PatientSearchResult) {
  if (!mentionTextNode || !editorRef.value) return

  const text = mentionTextNode.textContent ?? ''
  const sel = window.getSelection()
  if (!sel) return

  const cursorPos = mentionRange ? mentionRange.startOffset : sel.getRangeAt(0).startOffset

  // Split text: before @, after cursor
  const before = text.substring(0, mentionStartOffset)
  const after = text.substring(cursorPos)

  // Create the chip element
  const chip = document.createElement('span')
  chip.className = 'mention-chip'
  chip.contentEditable = 'false'
  chip.dataset.patientId = patient.id
  chip.dataset.patientName = patient.full_name
  chip.textContent = patient.full_name

  // Replace text node content
  mentionTextNode.textContent = before

  // Insert chip after the text node
  const parent = mentionTextNode.parentNode!
  const afterNode = document.createTextNode('\u00A0' + after)

  if (mentionTextNode.nextSibling) {
    parent.insertBefore(afterNode, mentionTextNode.nextSibling)
    parent.insertBefore(chip, afterNode)
  } else {
    parent.appendChild(chip)
    parent.appendChild(afterNode)
  }

  // Place cursor after the space
  const newRange = document.createRange()
  newRange.setStart(afterNode, 1)
  newRange.collapse(true)
  sel.removeAllRanges()
  sel.addRange(newRange)

  closeMention()
  isEditorEmpty.value = isEmpty()
}

function closeMention() {
  mentionQuery.value = null
  mentionResults.value = []
  mentionTextNode = null
  mentionStartOffset = -1
  mentionRange = null
}

function getBodyForSend(): string {
  if (!editorRef.value) return ''

  let result = ''
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent ?? ''
    } else if (node instanceof HTMLElement && node.classList.contains('mention-chip')) {
      const id = node.dataset.patientId ?? ''
      const name = node.dataset.patientName ?? ''
      result += `[@patient:${id}:${name}]`
    } else if (node instanceof HTMLBRElement) {
      result += '\n'
    } else {
      node.childNodes.forEach(walk)
    }
  }
  editorRef.value.childNodes.forEach(walk)

  // Clean up non-breaking spaces used for cursor positioning
  return result.replace(/\u00A0/g, ' ')
}

function isEmpty(): boolean {
  const text = editorRef.value?.textContent?.trim() ?? ''
  return text.length === 0 && !editorRef.value?.querySelector('.mention-chip')
}

// --- Emoji ---
const emojiGroups = [
  {
    label: 'Smileys',
    emojis: ['😀', '😂', '🤣', '😊', '😍', '🥰', '😘', '😜', '🤔', '😅', '😢', '😭', '😱', '🤗', '🤩', '😎', '🥳', '😴', '🤮', '🤧'],
  },
  {
    label: 'Gestures',
    emojis: ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '👋', '🙏'],
  },
  {
    label: 'Hearts',
    emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '💔', '❤️‍🔥', '💯', '💕'],
  },
  {
    label: 'Objects',
    emojis: ['🎉', '🔥', '⭐', '💡', '📌', '✅', '❌', '⚠️', '💊', '🩺'],
  },
]

function insertEmoji(emoji: string) {
  const el = editorRef.value
  if (!el) return

  el.focus()
  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(document.createTextNode(emoji))
    range.collapse(false)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    el.appendChild(document.createTextNode(emoji))
  }
  emojiOpen.value = false
  isEditorEmpty.value = isEmpty()
}

function onInput() {
  detectMention()
  isEditorEmpty.value = isEmpty()
  emit('typing')
}

function handleSend() {
  const text = getBodyForSend().trim()
  if (!text) return

  closeMention()
  emit('send', text)

  if (editorRef.value) {
    editorRef.value.textContent = ''
  }
  isEditorEmpty.value = true
}

function onKeydown(e: KeyboardEvent) {
  // Handle mention navigation
  if (showMention.value && mentionResults.value.length > 0) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionActiveIndex.value = (mentionActiveIndex.value + 1) % mentionResults.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionActiveIndex.value = mentionActiveIndex.value <= 0 ? mentionResults.value.length - 1 : mentionActiveIndex.value - 1
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      const selected = mentionResults.value[mentionActiveIndex.value]
      if (selected) selectPatient(selected)
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      closeMention()
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const text = e.clipboardData?.getData('text/plain') ?? ''
  document.execCommand('insertText', false, text)
}
</script>

<template>
  <div class="relative border-t bg-background p-3">
    <!-- @mention dropdown -->
    <div
      v-if="showMention"
      class="absolute bottom-full left-0 right-0 z-10 mx-3 mb-1 rounded-lg border bg-popover shadow-lg"
    >
      <div class="px-3 py-2 border-b">
        <p class="text-xs font-medium text-muted-foreground">
          {{ !mentionQuery ? 'Type a patient name...' : `Searching for "${mentionQuery}"` }}
        </p>
      </div>

      <div v-if="mentionLoading" class="flex items-center justify-center py-4">
        <LoaderCircle class="size-4 animate-spin text-muted-foreground" />
      </div>

      <div v-else-if="mentionResults.length > 0" class="max-h-48 overflow-y-auto py-1">
        <button
          v-for="(patient, index) in mentionResults"
          :key="patient.id"
          type="button"
          class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent"
          :class="index === mentionActiveIndex ? 'bg-accent' : ''"
          @mousedown.prevent="selectPatient(patient)"
        >
          <div class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {{ patient.full_name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() }}
          </div>
          <div class="min-w-0">
            <p class="truncate font-medium">{{ patient.full_name }}</p>
            <p class="truncate text-xs text-muted-foreground">{{ patient.address }}</p>
          </div>
        </button>
      </div>

      <div v-else-if="mentionQuery && mentionQuery.length >= 1 && !mentionLoading" class="px-3 py-4 text-center">
        <User class="mx-auto size-6 text-muted-foreground/40" />
        <p class="mt-1 text-xs text-muted-foreground">No patients found</p>
      </div>
    </div>

    <div class="flex items-end gap-1.5">
      <Popover v-model:open="emojiOpen">
        <PopoverTrigger as-child>
          <Button variant="ghost" size="icon" class="size-9 shrink-0 text-muted-foreground hover:text-foreground">
            <Smile class="size-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" class="w-72 p-2">
          <div class="flex flex-col gap-2">
            <div v-for="group in emojiGroups" :key="group.label">
              <p class="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{{ group.label }}</p>
              <div class="flex flex-wrap">
                <button
                  v-for="emoji in group.emojis"
                  :key="emoji"
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-lg hover:bg-accent transition-colors"
                  @click="insertEmoji(emoji)"
                >
                  {{ emoji }}
                </button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <div
        ref="editorRef"
        contenteditable="true"
        role="textbox"
        aria-label="Type a message"
        data-placeholder="Type a message... (@ to link patient)"
        class="message-editor flex-1 resize-none rounded-lg border bg-muted/50 px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        @input="onInput"
        @keydown="onKeydown"
        @paste="onPaste"
      />
      <Button
        size="icon"
        class="shrink-0"
        :disabled="isEditorEmpty"
        @click="handleSend"
      >
        <SendHorizontal class="size-4" />
      </Button>
    </div>
  </div>
</template>

<style scoped>
.message-editor {
  min-height: 36px;
  max-height: 120px;
  overflow-y: auto;
  word-break: break-word;
  white-space: pre-wrap;
}

.message-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--muted-foreground, #a1a1aa);
  pointer-events: none;
}

.message-editor :deep(.mention-chip) {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  margin: 0 1px;
  border-radius: 4px;
  background: hsl(var(--primary) / 0.15);
  color: hsl(var(--primary));
  font-weight: 500;
  font-size: 0.8125rem;
  vertical-align: baseline;
  cursor: default;
  user-select: all;
}
</style>
