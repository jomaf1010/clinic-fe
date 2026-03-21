<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import PrescriptionTemplateEditor from './PrescriptionTemplateEditor.vue'
import MedCertTemplateEditor from './MedCertTemplateEditor.vue'

const route = useRoute()
const category = computed(() => route.params.category as string)
</script>

<template>
  <PrescriptionTemplateEditor v-if="category === 'prescription'" />
  <MedCertTemplateEditor v-else-if="category === 'medical-certificate'" />
  <div v-else class="flex items-center justify-center py-12 text-muted-foreground">
    Template editor for "{{ category }}" is not yet available.
  </div>
</template>
