<script setup lang="ts">
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronRight, Crown } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'

import { useSidebar } from '@/components/ui/sidebar'

const route = useRoute()
const router = useRouter()
const { isMobile, setOpenMobile } = useSidebar()

function closeMobileSidebar() {
  if (isMobile.value) {
    setOpenMobile(false)
  }
}

function navigateTo(url: string) {
  closeMobileSidebar()
  if (route.path !== url) {
    router.push(url)
  }
}

function isActive(url: string): boolean {
  if (url === '/') return route.path === '/'
  return route.path.startsWith(url)
}
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarSeparator,
} from '@/components/ui/sidebar'

const props = defineProps<{
  items: {
    title: string
    url: string
    icon: Component
    isActive?: boolean
    comingSoon?: boolean
    locked?: boolean
    separator?: boolean
    badge?: (() => number) | number
    items?: {
      title: string
      url: string
    }[]
  }[]
}>()

const emit = defineEmits<{
  'locked-click': [title: string]
}>()
</script>

<template>
  <SidebarGroup>
    <SidebarMenu class="gap-1">
      <template v-for="item in items" :key="item.title">
        <SidebarSeparator v-if="item.separator" class="my-1" />
        <!-- Items with sub-items: collapsible -->
        <Collapsible
          v-if="item.items?.length"
          as-child
          :default-open="item.isActive || item.items.some(sub => isActive(sub.url))"
          class="group/collapsible"
        >
          <SidebarMenuItem>
            <CollapsibleTrigger as-child>
              <SidebarMenuButton :tooltip="item.title" :is-active="item.items.some(sub => isActive(sub.url))" class="h-10" @click="item.url !== '#' && router.push(item.url)">
                <component :is="item.icon" />
                <span>{{ item.title }}</span>
                <ChevronRight class="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub class="px-2">
                <SidebarMenuSubItem v-for="subItem in item.items" :key="subItem.title">
                  <SidebarMenuSubButton as="a" :href="subItem.url" :is-active="isActive(subItem.url)" @click.prevent="navigateTo(subItem.url)">
                    <span>{{ subItem.title }}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>

        <!-- Coming soon items: disabled appearance -->
        <SidebarMenuItem v-else-if="item.comingSoon">
          <SidebarMenuButton :tooltip="`${item.title} — Coming soon`" class="h-10 pointer-events-none opacity-50">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
            <Badge variant="outline" class="ml-auto text-[10px] px-1.5 py-0">Soon</Badge>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Locked (Pro) items -->
        <SidebarMenuItem v-else-if="item.locked">
          <SidebarMenuButton :tooltip="`${item.title} — Pro`" class="h-10 opacity-60 hover:opacity-80" @click="emit('locked-click', item.title)">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
            <Crown class="ml-auto size-3.5 text-amber-500" />
          </SidebarMenuButton>
        </SidebarMenuItem>

        <!-- Items without sub-items: direct link -->
        <SidebarMenuItem v-else>
          <SidebarMenuButton as="a" :href="item.url" :tooltip="item.title" :is-active="isActive(item.url)" class="h-10" @click.prevent="navigateTo(item.url)">
            <component :is="item.icon" />
            <span>{{ item.title }}</span>
            <Badge
              v-if="(typeof item.badge === 'function' ? item.badge() : item.badge ?? 0) > 0"
              class="ml-auto px-1.5 py-0 text-[10px]"
            >
              {{ typeof item.badge === 'function' ? item.badge() : item.badge }}
            </Badge>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </template>
    </SidebarMenu>
  </SidebarGroup>
</template>
