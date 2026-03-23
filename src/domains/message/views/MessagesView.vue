<script setup lang="ts">
import { onUnmounted } from 'vue'
import { useMessageStore } from '../stores/messageStore'
import FeatureGate from '@/components/shared/FeatureGate.vue'
import MessagePanel from '../components/MessagePanel.vue'

const messageStore = useMessageStore()

onUnmounted(() => {
  messageStore.setActiveConversation(null)
})
</script>

<template>
  <FeatureGate feature="messages" label="Messages">
    <div class="-mx-4 -mb-4 flex flex-col overflow-hidden" style="height: calc(100vh - var(--header-height))">
      <MessagePanel mode="full" />
    </div>
  </FeatureGate>
</template>
