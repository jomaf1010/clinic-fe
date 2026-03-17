<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowLeftRight,
  BadgeCheck,
  Bell,
  ChevronsUpDown,
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
  }
  showSwitchClinic?: boolean
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
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <Avatar class="h-8 w-8 rounded-lg">
              <AvatarFallback class="rounded-lg">
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
              <Avatar class="h-8 w-8 rounded-lg">
                <AvatarFallback class="rounded-lg">
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
            <DropdownMenuItem>
              <Bell class="mr-2 size-4" />
              Notifications
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
