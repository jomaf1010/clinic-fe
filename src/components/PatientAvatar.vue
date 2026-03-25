<script setup lang="ts">
import { computed } from 'vue'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import malePatientSvg from '@/assets/male-patient.svg'
import femalePatientSvg from '@/assets/female-patient.svg'

const props = withDefaults(defineProps<{
  avatarUrl?: string | null
  sex?: string | null
  name?: string | null
  class?: string
}>(), {
  avatarUrl: null,
  sex: null,
  name: null,
})

const fallbackSvg = computed(() =>
  props.sex === 'female' ? femalePatientSvg : malePatientSvg,
)

const bgClass = computed(() =>
  props.sex === 'female'
    ? 'bg-pink-50 dark:bg-pink-950/50'
    : 'bg-blue-50 dark:bg-blue-950/50',
)
</script>

<template>
  <Avatar :class="[$props.class, bgClass]">
    <AvatarImage v-if="avatarUrl" :src="avatarUrl" :alt="name ?? ''" class="object-cover" />
    <AvatarFallback :class="bgClass">
      <img :src="fallbackSvg" :alt="sex === 'female' ? 'Female patient' : 'Male patient'" class="size-full object-cover" />
    </AvatarFallback>
  </Avatar>
</template>
