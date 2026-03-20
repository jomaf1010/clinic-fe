<script setup lang="ts">
import {
  Calendar,
  CalendarCheck,
  Component,
  LayoutDashboard,
  ListOrdered,
  MessageSquare,
  Receipt,
  ScrollText,
  Settings2,
  ShieldCheck,
  Stethoscope,
  Users,
  UsersRound,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { RouteNames } from '@/router/routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useMessageStore } from '@/domains/message/stores/messageStore'
import NavMain from '@/components/layout/NavMain.vue'
import NavSecondary from '@/components/layout/NavSecondary.vue'
import NavUser from '@/components/layout/NavUser.vue'
import SwitchClinicDialog from '@/components/layout/SwitchClinicDialog.vue'

const router = useRouter()
const authStore = useAuthStore()
const messageStore = useMessageStore()
const switchDialogOpen = ref(false)

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
  },
  {
    title: 'Clinic',
    url: '/clinic',
    icon: Stethoscope,
    permission: ['medicines.view', 'consumables.view', 'lab-services.view'],
  },
  {
    title: 'Schedule',
    url: '/schedule',
    icon: Calendar,
    permission: 'schedule.view',
  },
  {
    title: 'Queue',
    url: '/queue',
    icon: ListOrdered,
    permission: 'queue.view',
  },
  {
    title: 'Billing',
    url: '/billing',
    icon: Receipt,
    permission: 'billing.view',
  },
  {
    title: 'Messages',
    url: '/messages',
    icon: MessageSquare,
    permission: 'messages.view',
    badge: () => messageStore.totalUnread,
  },
  {
    title: 'Team',
    url: '/team',
    icon: UsersRound,
    permission: 'team.view',
  },
  {
    title: 'Roles',
    url: '/roles',
    icon: ShieldCheck,
    permission: 'roles.manage',
  },
  {
    title: 'Logs',
    url: '/logs',
    icon: ScrollText,
    permission: 'audit-logs.view',
  },
  {
    title: 'Settings',
    url: '#',
    icon: Settings2,
    comingSoon: true,
  },
  {
    title: 'Components',
    url: '/components',
    icon: Component,
  },
]

const navMain = computed(() =>
  allNavItems.filter((item) => {
    if (!item.permission) return true
    if (Array.isArray(item.permission)) {
      return item.permission.some((p) => authStore.hasPermission(p))
    }
    return authStore.hasPermission(item.permission)
  }),
)

const navSecondary: { title: string; url: string; icon: typeof LifeBuoy }[] = []

const userData = computed(() => ({
  name: authStore.user?.name ?? authStore.user?.email ?? 'User',
  email: authStore.user?.email ?? '',
}))

const clinicName = computed(() => authStore.currentClinic?.clinic_name ?? 'Clinic App')

async function handleLogout() {
  await authStore.logout()
  router.push({ name: RouteNames.LOGIN })
}
</script>

<template>
  <Sidebar variant="inset" collapsible="icon">
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" as="a" href="/">
            <div class="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
              <Stethoscope class="size-4" />
            </div>
            <div class="grid flex-1 text-left text-sm leading-tight">
              <span class="truncate font-medium">{{ clinicName }}</span>
              <span class="truncate text-xs capitalize">{{ authStore.currentClinic?.role ?? 'Management' }}</span>
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      <NavMain :items="navMain" />
      <NavSecondary :items="navSecondary" />
    </SidebarContent>
    <SidebarFooter>
      <NavUser
        :user="userData"
        :show-switch-clinic="authStore.memberships.length > 1"
        @logout="handleLogout"
        @switch-clinic="switchDialogOpen = true"
      />
    </SidebarFooter>
  </Sidebar>
  <SwitchClinicDialog v-model:open="switchDialogOpen" />
</template>
