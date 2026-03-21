<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Pill, FlaskConical, TestTubes, FileText, Building2, Settings } from 'lucide-vue-next'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { RouteNames } from '@/router/routeNames'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

const canViewMedicines = computed(() => authStore.hasPermission('medicines.view'))
const canViewConsumables = computed(() => authStore.hasPermission('consumables.view'))
const canViewLabServices = computed(() => authStore.hasPermission('lab-services.view'))

const tabRouteMap: Record<string, string> = {
  profile: RouteNames.CLINIC_PROFILE,
  settings: RouteNames.CLINIC_SETTINGS,
  medicines: RouteNames.CLINIC_MEDICINES,
  consumables: RouteNames.CLINIC_CONSUMABLES,
  'lab-services': RouteNames.CLINIC_LAB_SERVICES,
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
      <div class="flex items-center gap-2">
        <TabsList>
          <TabsTrigger value="profile" class="gap-1.5">
            <Building2 class="size-3.5" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="settings" class="gap-1.5">
            <Settings class="size-3.5" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsList>
          <TabsTrigger v-if="canViewMedicines" value="medicines" class="gap-1.5">
            <Pill class="size-3.5" />
            Medicines
          </TabsTrigger>
          <TabsTrigger v-if="canViewConsumables" value="consumables" class="gap-1.5">
            <FlaskConical class="size-3.5" />
            Consumables
          </TabsTrigger>
          <TabsTrigger v-if="canViewLabServices" value="lab-services" class="gap-1.5">
            <TestTubes class="size-3.5" />
            Lab Services
          </TabsTrigger>
          <TabsTrigger value="templates" class="gap-1.5">
            <FileText class="size-3.5" />
            Templates
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>

    <router-view />
  </div>
</template>
