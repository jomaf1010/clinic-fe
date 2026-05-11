<script setup lang="ts">
import type { Component } from 'vue'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

defineProps<{
  items: {
    title: string
    url: string
    icon: Component
  }[]
}>()
</script>

<template>
  <SidebarGroup class="mt-auto">
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in items" :key="item.title">
          <SidebarMenuButton as="a" :href="item.url" size="sm">
            <component :is="item.icon" />
            <span class="group-data-[collapsible=icon]:hidden">{{ item.title }}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
