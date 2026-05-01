<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeftRight,
  BadgeCheck,
  ChevronsUpDown,
  Crown,
  LogOut,
  Moon,
  Sun,
} from 'lucide-vue-next'
import { useRouter } from 'vue-router'
import { RouteNames } from '@/router/routeNames'
import { useTheme } from '@/composables/useTheme'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'

const props = defineProps<{
  user: {
    name: string
    email: string
    avatarUrl?: string | null
  }
  showSwitchClinic?: boolean
  isOwner?: boolean
}>()

const emit = defineEmits<{
  logout: []
  switchClinic: []
}>()

const router = useRouter()
const { isMobile } = useSidebar()
const { isDark, toggleTheme } = useTheme()

const initials = computed(() => {
  if (props.user.name) {
    return props.user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  return props.user.email.slice(0, 2).toUpperCase()
})
</script>

<template>
  <SidebarMenu>
    <SidebarMenuItem>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <SidebarMenuButton
            size="lg"
            class="rounded-2xl data-[state=open]:border-white/55 data-[state=open]:bg-white/62 data-[state=open]:text-sidebar-accent-foreground data-[state=open]:shadow-[0_14px_32px_rgba(37,99,235,0.12)]"
          >
            <Avatar class="h-9 w-9 rounded-full shadow-[0_10px_24px_rgba(15,23,42,0.1)] group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8">
              <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" class="rounded-full object-cover" />
              <AvatarFallback class="rounded-full">
                {{ initials }}
              </AvatarFallback>
            </Avatar>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ user.name }}</span>
              <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
            </div>
            <ChevronsUpDown class="ml-auto size-4" />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="w-[--reka-popper-anchor-width] min-w-56 rounded-lg"
          :side="isMobile ? 'bottom' : 'right'"
          align="end"
          :side-offset="4"
        >
          <DropdownMenuLabel class="p-0 font-normal">
            <div class="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
              <Avatar class="h-8 w-8 rounded-full">
                <AvatarImage v-if="user.avatarUrl" :src="user.avatarUrl" :alt="user.name" class="rounded-full object-cover" />
                <AvatarFallback class="rounded-full">
                  {{ initials }}
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight">
                <span class="truncate font-medium">{{ user.name }}</span>
                <span class="truncate text-xs text-muted-foreground">{{ user.email }}</span>
              </div>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem @click="router.push({ name: RouteNames.ACCOUNT })">
              <BadgeCheck class="mr-2 size-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem v-if="isOwner" @click="router.push({ name: RouteNames.SUBSCRIPTION })">
              <Crown class="mr-2 size-4" />
              Subscription
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem @click="toggleTheme">
            <Sun v-if="isDark" class="mr-2 size-4" />
            <Moon v-else class="mr-2 size-4" />
            {{ isDark ? 'Light mode' : 'Dark mode' }}
          </DropdownMenuItem>
          <DropdownMenuItem v-if="showSwitchClinic" @click="emit('switchClinic')">
            <ArrowLeftRight class="mr-2 size-4" />
            Switch Clinic
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('logout')">
            <LogOut class="mr-2 size-4" />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  </SidebarMenu>
</template>
