<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Pill, FlaskConical, TestTubes } from 'lucide-vue-next'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import MedicineListView from '@/domains/medicine/views/MedicineListView.vue'
import ConsumableListView from '@/domains/consumable/views/ConsumableListView.vue'
import LabServiceListView from '@/domains/labService/views/LabServiceListView.vue'

const authStore = useAuthStore()

const canViewMedicines = computed(() => authStore.hasPermission('medicines.view'))
const canViewConsumables = computed(() => authStore.hasPermission('consumables.view'))
const canViewLabServices = computed(() => authStore.hasPermission('lab-services.view'))

const defaultTab = computed(() => {
  if (canViewMedicines.value) return 'medicines'
  if (canViewConsumables.value) return 'consumables'
  if (canViewLabServices.value) return 'lab-services'
  return 'medicines'
})

const activeTab = ref(defaultTab.value)
watch(defaultTab, (val) => { activeTab.value = val }, { immediate: true })
</script>

<template>
  <div class="flex flex-1 flex-col gap-4 pt-4">
    <Tabs v-model="activeTab" size="lg" class="w-full">
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
      </TabsList>

      <TabsContent v-if="canViewMedicines" value="medicines" class="mt-0">
        <MedicineListView />
      </TabsContent>

      <TabsContent v-if="canViewConsumables" value="consumables" class="mt-0">
        <ConsumableListView />
      </TabsContent>

      <TabsContent v-if="canViewLabServices" value="lab-services" class="mt-0">
        <LabServiceListView />
      </TabsContent>
    </Tabs>
  </div>
</template>
