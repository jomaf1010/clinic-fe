<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pill, FlaskConical, TestTubes, FileText, Building2, Settings, UsersRound, ShieldCheck, ScrollText, Crown, Stethoscope } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { RouteNames } from '@/router/routeNames'
import UpgradePrompt from '@/components/shared/UpgradePrompt.vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const canManageClinic = computed(() => authStore.hasPermission('clinic.manage'))
const canViewMedicines = computed(() => authStore.hasPermission('medicines.view'))
const canViewConsumables = computed(() => authStore.hasPermission('consumables.view'))
const canViewLabServices = computed(() => authStore.hasPermission('lab-services.view'))
const canViewTeam = computed(() => authStore.hasPermission('team.view'))
const canManageRoles = computed(() => authStore.hasPermission('roles.manage'))
const canViewLogs = computed(() => authStore.hasPermission('audit-logs.view'))

const hasConsumablesFeature = computed(() => authStore.hasFeature('consumables'))
const hasLabFeature = computed(() => authStore.hasFeature('lab_services'))
const hasRolesFeature = computed(() => authStore.hasFeature('custom_roles'))
const hasLogsFeature = computed(() => authStore.hasFeature('audit_logs'))

const upgradeOpen = ref(false)
const upgradeLabel = ref('')

function openUpgrade(label: string) {
  upgradeLabel.value = label
  upgradeOpen.value = true
}

const tabRouteMap: Record<string, string> = {
  profile: RouteNames.CLINIC_PROFILE,
  settings: RouteNames.CLINIC_SETTINGS,
  team: RouteNames.TEAM,
  roles: RouteNames.ROLES,
  logs: RouteNames.AUDIT_LOG_LIST,
  medicines: RouteNames.CLINIC_MEDICINES,
  consumables: RouteNames.CLINIC_CONSUMABLES,
  'lab-services': RouteNames.CLINIC_LAB_SERVICES,
  services: RouteNames.CLINIC_SERVICES,
  templates: RouteNames.CLINIC_TEMPLATES,
}

const routeTabMap = Object.fromEntries(
  Object.entries(tabRouteMap).map(([tab, routeName]) => [routeName, tab]),
)

const activeTab = computed({
  get: () => routeTabMap[route.name as string] ?? 'profile',
  set: (val: string) => {
    const routeName = tabRouteMap[val]
    if (routeName) router.push({ name: routeName })
  },
})
</script>

<template>
  <div class="clinic-shell flex flex-1 flex-col gap-5 pt-6 md:pt-8">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <div class="flex min-w-0 items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-normal">Clinic</h1>
          <Badge variant="secondary" class="max-w-[14rem] rounded-full px-2.5 text-sm">
            <span class="truncate">{{ authStore.currentClinic?.clinic_name ?? 'Workspace' }}</span>
          </Badge>
        </div>
      </div>
    </div>

    <Tabs v-model="activeTab" size="lg" class="w-full">
      <div class="clinic-tabs-wrap flex flex-col items-start gap-2 lg:flex-row lg:items-center">
        <div class="clinic-tabs-scroller w-full overflow-x-auto sm:w-auto sm:overflow-visible">
          <TabsList class="clinic-tabs-list rounded-full">
            <TabsTrigger value="profile" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <Building2 class="size-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger v-if="canManageClinic" value="settings" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <Settings class="size-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger v-if="canViewTeam" value="team" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <UsersRound class="size-3.5" />
              Team
            </TabsTrigger>
            <TooltipProvider v-if="canManageRoles" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasRolesFeature" value="roles" class="clinic-tabs-trigger gap-1.5 rounded-full">
                    <ShieldCheck class="size-3.5" />
                    Roles
                  </TabsTrigger>
                  <button v-else type="button" class="clinic-locked-tab inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Custom Roles')">
                    <ShieldCheck class="size-3.5" />
                    Roles
                    <Crown class="size-3 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="!hasRolesFeature" side="bottom">Pro feature</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider v-if="canViewLogs" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasLogsFeature" value="logs" class="clinic-tabs-trigger gap-1.5 rounded-full">
                    <ScrollText class="size-3.5" />
                    Logs
                  </TabsTrigger>
                  <button v-else type="button" class="clinic-locked-tab inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Audit Logs')">
                    <ScrollText class="size-3.5" />
                    Logs
                    <Crown class="size-3 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="!hasLogsFeature" side="bottom">Pro feature</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </TabsList>
        </div>

        <div class="clinic-tabs-scroller w-full overflow-x-auto sm:w-auto sm:overflow-visible">
          <TabsList class="clinic-tabs-list rounded-full">
            <TabsTrigger v-if="canViewMedicines" value="medicines" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <Pill class="size-3.5" />
              Medicines
            </TabsTrigger>
            <TooltipProvider v-if="canViewConsumables" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasConsumablesFeature" value="consumables" class="clinic-tabs-trigger gap-1.5 rounded-full">
                    <FlaskConical class="size-3.5" />
                    Consumables
                  </TabsTrigger>
                  <button v-else type="button" class="clinic-locked-tab inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Consumables')">
                    <FlaskConical class="size-3.5" />
                    Consumables
                    <Crown class="size-3 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="!hasConsumablesFeature" side="bottom">Pro feature</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider v-if="canViewLabServices" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasLabFeature" value="lab-services" class="clinic-tabs-trigger gap-1.5 rounded-full">
                    <TestTubes class="size-3.5" />
                    Lab Services
                  </TabsTrigger>
                  <button v-else type="button" class="clinic-locked-tab inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Lab Services')">
                    <TestTubes class="size-3.5" />
                    Lab Services
                    <Crown class="size-3 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="!hasLabFeature" side="bottom">Pro feature</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TabsTrigger v-if="canViewLabServices" value="services" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <Stethoscope class="size-3.5" />
              Services
            </TabsTrigger>
            <TabsTrigger value="templates" class="clinic-tabs-trigger gap-1.5 rounded-full">
              <FileText class="size-3.5" />
              Templates
            </TabsTrigger>
          </TabsList>
        </div>
      </div>
    </Tabs>

    <router-view />

    <UpgradePrompt v-model:open="upgradeOpen" :feature="upgradeLabel" />
  </div>
</template>

<style scoped>
.clinic-tabs-wrap {
  max-width: 100%;
}

.clinic-tabs-scroller {
  margin: -1rem -0.25rem;
  padding: 1rem 0.25rem;
  scrollbar-width: none;
}

.clinic-tabs-scroller::-webkit-scrollbar {
  display: none;
  height: 0;
}

.clinic-tabs-list {
  border: 0;
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.5),
    0 14px 32px rgb(15 23 42 / 0.08);
}

:deep(.clinic-tabs-trigger[data-state='active']) {
  color: white;
  background: linear-gradient(135deg, rgb(37 99 235), rgb(20 184 166));
  box-shadow:
    0 14px 30px rgb(37 99 235 / 0.18),
    0 12px 26px rgb(20 184 166 / 0.14),
    inset 0 1px 0 rgb(255 255 255 / 0.24);
}

.clinic-locked-tab {
  height: calc(100% - 1px);
}

:global(.clinic-shell [data-slot='card']) {
  background:
    radial-gradient(circle at 16% 12%, rgb(37 99 235 / 0.11), transparent 34%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.1), transparent 32%),
    radial-gradient(circle at 56% 110%, rgb(139 92 246 / 0.08), transparent 42%),
    var(--surface-panel-strong);
}

:global(.clinic-shell [data-slot='card']:nth-of-type(2n)) {
  background:
    radial-gradient(circle at 82% 14%, rgb(37 99 235 / 0.1), transparent 32%),
    radial-gradient(circle at 18% 0%, rgb(20 184 166 / 0.11), transparent 36%),
    radial-gradient(circle at 48% 112%, rgb(245 158 11 / 0.07), transparent 42%),
    var(--surface-panel-strong);
}

:global(.clinic-shell [data-slot='card']:nth-of-type(3n)) {
  background:
    radial-gradient(circle at 14% 82%, rgb(20 184 166 / 0.1), transparent 36%),
    radial-gradient(circle at 92% 18%, rgb(139 92 246 / 0.1), transparent 34%),
    radial-gradient(circle at 46% -10%, rgb(37 99 235 / 0.09), transparent 38%),
    var(--surface-panel-strong);
}

:global(.dark .clinic-tabs-list) {
  box-shadow:
    inset 0 1px 0 rgb(255 255 255 / 0.05),
    0 16px 34px rgb(0 0 0 / 0.22);
}

:global(.dark .clinic-shell [data-slot='card']) {
  background:
    radial-gradient(circle at 16% 12%, rgb(37 99 235 / 0.16), transparent 34%),
    radial-gradient(circle at 88% 8%, rgb(20 184 166 / 0.13), transparent 32%),
    radial-gradient(circle at 56% 110%, rgb(139 92 246 / 0.12), transparent 42%),
    var(--surface-panel-strong);
}

:global(.dark .clinic-shell [data-slot='card']:nth-of-type(2n)) {
  background:
    radial-gradient(circle at 82% 14%, rgb(37 99 235 / 0.14), transparent 32%),
    radial-gradient(circle at 18% 0%, rgb(20 184 166 / 0.14), transparent 36%),
    radial-gradient(circle at 48% 112%, rgb(245 158 11 / 0.1), transparent 42%),
    var(--surface-panel-strong);
}

:global(.dark .clinic-shell [data-slot='card']:nth-of-type(3n)) {
  background:
    radial-gradient(circle at 14% 82%, rgb(20 184 166 / 0.13), transparent 36%),
    radial-gradient(circle at 92% 18%, rgb(139 92 246 / 0.14), transparent 34%),
    radial-gradient(circle at 46% -10%, rgb(37 99 235 / 0.12), transparent 38%),
    var(--surface-panel-strong);
}
</style>
