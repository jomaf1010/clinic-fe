<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pill, FlaskConical, TestTubes, FileText, Building2, Settings, UsersRound, ShieldCheck, ScrollText, Crown, Stethoscope } from 'lucide-vue-next'
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
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <Tabs v-model="activeTab" size="lg" class="w-full">
      <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center">
        <div class="w-full overflow-x-auto sm:w-auto">
          <TabsList>
            <TabsTrigger value="profile" class="gap-1.5">
              <Building2 class="size-3.5" />
              Profile
            </TabsTrigger>
            <TabsTrigger v-if="canManageClinic" value="settings" class="gap-1.5">
              <Settings class="size-3.5" />
              Settings
            </TabsTrigger>
            <TabsTrigger v-if="canViewTeam" value="team" class="gap-1.5">
              <UsersRound class="size-3.5" />
              Team
            </TabsTrigger>
            <TooltipProvider v-if="canManageRoles" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasRolesFeature" value="roles" class="gap-1.5">
                    <ShieldCheck class="size-3.5" />
                    Roles
                  </TabsTrigger>
                  <button v-else type="button" class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Custom Roles')">
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
                  <TabsTrigger v-if="hasLogsFeature" value="logs" class="gap-1.5">
                    <ScrollText class="size-3.5" />
                    Logs
                  </TabsTrigger>
                  <button v-else type="button" class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Audit Logs')">
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

        <div class="w-full overflow-x-auto sm:w-auto">
          <TabsList>
            <TabsTrigger v-if="canViewMedicines" value="medicines" class="gap-1.5">
              <Pill class="size-3.5" />
              Medicines
            </TabsTrigger>
            <TooltipProvider v-if="canViewConsumables" :delay-duration="200">
              <Tooltip>
                <TooltipTrigger as-child>
                  <TabsTrigger v-if="hasConsumablesFeature" value="consumables" class="gap-1.5">
                    <FlaskConical class="size-3.5" />
                    Consumables
                  </TabsTrigger>
                  <button v-else type="button" class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Consumables')">
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
                  <TabsTrigger v-if="hasLabFeature" value="lab-services" class="gap-1.5">
                    <TestTubes class="size-3.5" />
                    Lab Services
                  </TabsTrigger>
                  <button v-else type="button" class="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-2.5 py-1 text-sm font-medium opacity-50 cursor-not-allowed" @click="openUpgrade('Lab Services')">
                    <TestTubes class="size-3.5" />
                    Lab Services
                    <Crown class="size-3 text-amber-500" />
                  </button>
                </TooltipTrigger>
                <TooltipContent v-if="!hasLabFeature" side="bottom">Pro feature</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TabsTrigger v-if="canViewLabServices" value="services" class="gap-1.5">
              <Stethoscope class="size-3.5" />
              Services
            </TabsTrigger>
            <TabsTrigger value="templates" class="gap-1.5">
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
