<script setup lang="ts">
import {
  Calendar,
  CalendarCheck,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  Palette,
  Receipt,
  Stethoscope,
  Users,
} from 'lucide-vue-next'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarTrigger,
  useSidebar,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useMessageStore } from '@/domains/message/stores/messageStore'
import { http } from '@/lib/http'
import NavMain from '@/components/layout/NavMain.vue'
import NavSecondary from '@/components/layout/NavSecondary.vue'
import NavUser from '@/components/layout/NavUser.vue'
import SwitchClinicDialog from '@/components/layout/SwitchClinicDialog.vue'
import UpgradePrompt from '@/components/shared/UpgradePrompt.vue'

const router = useRouter()
const authStore = useAuthStore()
const messageStore = useMessageStore()
const { isMobile, setOpenMobile } = useSidebar()
const switchDialogOpen = ref(false)
const upgradeDialogOpen = ref(false)
const upgradeFeatureLabel = ref('')

function openSwitchDialog() {
  if (isMobile.value) setOpenMobile(false)
  switchDialogOpen.value = true
}

function handleLockedClick(title: string) {
  if (isMobile.value) setOpenMobile(false)
  upgradeFeatureLabel.value = title
  upgradeDialogOpen.value = true
}

const allNavItems = [
  {
    title: 'Dashboard',
    url: '/',
    icon: LayoutDashboard,
    isActive: true,
    permission: 'dashboard.view',
  },
  {
    title: 'Patients',
    url: '/patients',
    icon: Users,
    permission: 'patients.view',
  },
  {
    title: 'Appointments',
    url: '/appointments',
    icon: CalendarCheck,
    permission: 'appointments.view',
    feature: 'appointments',
    separator: true,
  },
  {
    title: 'Schedule',
    url: '/schedule',
    icon: Calendar,
    permission: 'schedule.view',
    feature: 'schedule',
  },
  {
    title: 'Queue',
    url: '/queue',
    icon: ListOrdered,
    permission: 'queue.view',
  },
  {
    title: 'Clinic',
    url: '/clinic',
    icon: Stethoscope,
    permission: ['medicines.view', 'consumables.view', 'lab-services.view', 'team.view', 'roles.manage', 'audit-logs.view'],
    separator: true,
  },
  {
    title: 'Billing',
    url: '/billing',
    icon: Receipt,
    permission: ['billing.view', 'billing.view-own'],
  },
  {
    title: 'Messages',
    url: '/messages',
    icon: MessageSquare,
    permission: 'messages.view',
    feature: 'messages',
    badge: () => messageStore.totalUnread,
    separator: true,
  },
  {
    title: 'Design System',
    url: '/design-system',
    icon: Palette,
    permission: 'dashboard.view',
    devOnly: true,
  },
]

const navMain = computed(() =>
  allNavItems
    .filter((item) => {
      if (item.devOnly && !import.meta.env.DEV) return false
      if (!item.permission) return true
      if (Array.isArray(item.permission)) {
        return item.permission.some((p) => authStore.hasPermission(p))
      }
      return authStore.hasPermission(item.permission)
    })
    .map((item) => ({
      ...item,
      locked: item.feature ? !authStore.hasFeature(item.feature) : false,
    })),
)

const navSecondary: { title: string; url: string; icon: typeof Stethoscope }[] = []

const userData = computed(() => ({
  name: authStore.user?.name ?? authStore.user?.email ?? 'User',
  email: authStore.user?.email ?? '',
  avatarUrl: authStore.user?.avatar_url ?? null,
}))

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic App')

async function handleLogout() {
  await authStore.logout()
  router.push({ name: RouteNames.LOGIN })
}

declare const __COMMIT_HASH__: string
const feVersion = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev'
const apiVersion = ref('...')

onMounted(async () => {
  try {
    const res = await http.get<{ commit: string }>('/version')
    apiVersion.value = res.commit
  } catch {
    apiVersion.value = '?'
  }
})
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <div class="flex items-start gap-2 group-data-[collapsible=icon]:flex-col group-data-[collapsible=icon]:items-center">
        <SidebarMenu class="min-w-0 flex-1 group-data-[collapsible=icon]:flex-none">
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" as="a" href="/" class="rounded-2xl">
              <Avatar class="size-10 rounded-2xl shadow-[0_12px_28px_rgba(0,41,84,0.18)] group-data-[collapsible=icon]:size-8">
                <AvatarImage v-if="authStore.currentClinic?.logo_url" :src="authStore.currentClinic.logo_url" alt="Clinic logo" class="rounded-2xl object-cover" />
                <AvatarFallback class="rounded-2xl bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  <Stethoscope class="size-4" />
                </AvatarFallback>
              </Avatar>
              <div class="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                <span class="truncate font-medium">{{ clinicName }}</span>
                <span class="truncate text-xs capitalize">{{ authStore.currentClinic?.role ?? 'Management' }}</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarTrigger class="surface-muted mt-1 size-9 shrink-0 rounded-2xl border shadow-[0_10px_24px_rgba(15,23,42,0.06)] group-data-[collapsible=icon]:mt-0 group-data-[collapsible=icon]:size-8" />
      </div>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" @locked-click="handleLockedClick" />
      <NavSecondary :items="navSecondary" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser
        :user="userData"
        :show-switch-clinic="authStore.memberships.length > 1"
        :is-owner="authStore.currentRole === 'owner'"
        @logout="handleLogout"
        @switch-clinic="openSwitchDialog"
      />
      <p class="px-2 text-[10px] tabular-nums text-muted-foreground/45 group-data-[collapsible=icon]:hidden">
        {{ feVersion }}|{{ apiVersion }}
      </p>
    </SidebarFooter>
  </Sidebar>
  <SwitchClinicDialog v-model:open="switchDialogOpen" />
  <UpgradePrompt v-model:open="upgradeDialogOpen" :feature="upgradeFeatureLabel" />
</template>
