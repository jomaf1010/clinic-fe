<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { LoaderCircle } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addressApi, type AddressOption } from '@/domains/patient/api/addressApi'
import type { PatientAddress } from '@/domains/patient/types/patient.types'

const props = withDefaults(defineProps<{
  modelValue: PatientAddress | null
  disabled?: boolean
  prefill?: { region_code: string; province_code: string; city_code: string } | null
}>(), {
  disabled: false,
  prefill: null,
})

const emit = defineEmits<{
  'update:modelValue': [value: PatientAddress | null]
}>()

const regions = ref<AddressOption[]>([])
const provinces = ref<AddressOption[]>([])
const cities = ref<AddressOption[]>([])
const barangays = ref<AddressOption[]>([])

const loadingRegions = ref(false)
const loadingProvinces = ref(false)
const loadingCities = ref(false)
const loadingBarangays = ref(false)

const selectedRegion = ref('')
const selectedProvince = ref('')
const selectedCity = ref('')
const selectedBarangay = ref('')
const street = ref('')

// Track if we're initializing from modelValue to avoid clearing cascades
let initializing = false

onMounted(async () => {
  loadingRegions.value = true
  try {
    const res = await addressApi.lookup('region')
    regions.value = res.data
  } finally {
    loadingRegions.value = false
  }

  // Initialize from modelValue if present
  if (props.modelValue) {
    initializing = true
    selectedRegion.value = props.modelValue.region_code
    street.value = props.modelValue.street ?? ''

    // Load provinces for the selected region
    if (props.modelValue.region_code) {
      loadingProvinces.value = true
      try {
        const res = await addressApi.lookup('province', props.modelValue.region_code)
        provinces.value = res.data
        selectedProvince.value = props.modelValue.province_code
      } finally {
        loadingProvinces.value = false
      }
    }

    // Load cities for the selected province
    if (props.modelValue.province_code) {
      loadingCities.value = true
      try {
        const res = await addressApi.lookup('city', props.modelValue.province_code)
        cities.value = res.data
        selectedCity.value = props.modelValue.city_code
      } finally {
        loadingCities.value = false
      }
    }

    // Load barangays for the selected city
    if (props.modelValue.city_code) {
      loadingBarangays.value = true
      try {
        const res = await addressApi.lookup('barangay', props.modelValue.city_code)
        barangays.value = res.data
        selectedBarangay.value = props.modelValue.barangay_code
      } finally {
        loadingBarangays.value = false
      }
    }

    initializing = false
  } else if (props.prefill) {
    // Prefill region/province/city from clinic address, leave barangay empty
    initializing = true
    selectedRegion.value = props.prefill.region_code

    if (props.prefill.region_code) {
      loadingProvinces.value = true
      try {
        const res = await addressApi.lookup('province', props.prefill.region_code)
        provinces.value = res.data
        selectedProvince.value = props.prefill.province_code
      } finally {
        loadingProvinces.value = false
      }
    }

    if (props.prefill.province_code) {
      loadingCities.value = true
      try {
        const res = await addressApi.lookup('city', props.prefill.province_code)
        cities.value = res.data
        selectedCity.value = props.prefill.city_code
      } finally {
        loadingCities.value = false
      }
    }

    if (props.prefill.city_code) {
      loadingBarangays.value = true
      try {
        const res = await addressApi.lookup('barangay', props.prefill.city_code)
        barangays.value = res.data
      } finally {
        loadingBarangays.value = false
      }
    }

    initializing = false
  }
})

function findName(options: AddressOption[], code: string): string {
  return options.find(o => o.code === code)?.name ?? ''
}

function emitValue() {
  if (!selectedRegion.value || !selectedProvince.value || !selectedCity.value || !selectedBarangay.value) {
    emit('update:modelValue', null)
    return
  }

  emit('update:modelValue', {
    region_code: selectedRegion.value,
    region_name: findName(regions.value, selectedRegion.value),
    province_code: selectedProvince.value,
    province_name: findName(provinces.value, selectedProvince.value),
    city_code: selectedCity.value,
    city_name: findName(cities.value, selectedCity.value),
    barangay_code: selectedBarangay.value,
    barangay_name: findName(barangays.value, selectedBarangay.value),
    street: street.value || null,
  })
}

async function onRegionChange(code: string) {
  selectedRegion.value = code
  if (!initializing) {
    selectedProvince.value = ''
    selectedCity.value = ''
    selectedBarangay.value = ''
    cities.value = []
    barangays.value = []
  }

  loadingProvinces.value = true
  try {
    const res = await addressApi.lookup('province', code)
    provinces.value = res.data
  } finally {
    loadingProvinces.value = false
  }

  if (!initializing) emitValue()
}

async function onProvinceChange(code: string) {
  selectedProvince.value = code
  if (!initializing) {
    selectedCity.value = ''
    selectedBarangay.value = ''
    barangays.value = []
  }

  loadingCities.value = true
  try {
    const res = await addressApi.lookup('city', code)
    cities.value = res.data
  } finally {
    loadingCities.value = false
  }

  if (!initializing) emitValue()
}

async function onCityChange(code: string) {
  selectedCity.value = code
  if (!initializing) {
    selectedBarangay.value = ''
  }

  loadingBarangays.value = true
  try {
    const res = await addressApi.lookup('barangay', code)
    barangays.value = res.data
  } finally {
    loadingBarangays.value = false
  }

  if (!initializing) emitValue()
}

function onBarangayChange(code: string) {
  selectedBarangay.value = code
  emitValue()
}

function onStreetChange() {
  emitValue()
}
</script>

<template>
  <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <!-- Region -->
    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Region</Label>
      <Select
        :model-value="selectedRegion"
        :disabled="disabled || loadingRegions"
        @update:model-value="onRegionChange"
      >
        <SelectTrigger class="w-full min-w-0">
          <LoaderCircle v-if="loadingRegions" class="size-3.5 animate-spin text-muted-foreground" />
          <SelectValue placeholder="Select region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="r in regions" :key="r.code" :value="r.code">
            {{ r.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Province -->
    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Province</Label>
      <Select
        :model-value="selectedProvince"
        :disabled="disabled || !selectedRegion || loadingProvinces"
        @update:model-value="onProvinceChange"
      >
        <SelectTrigger class="w-full min-w-0">
          <LoaderCircle v-if="loadingProvinces" class="size-3.5 animate-spin text-muted-foreground" />
          <SelectValue placeholder="Select province" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="p in provinces" :key="p.code" :value="p.code">
            {{ p.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- City / Municipality -->
    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">City / Municipality</Label>
      <Select
        :model-value="selectedCity"
        :disabled="disabled || !selectedProvince || loadingCities"
        @update:model-value="onCityChange"
      >
        <SelectTrigger class="w-full min-w-0">
          <LoaderCircle v-if="loadingCities" class="size-3.5 animate-spin text-muted-foreground" />
          <SelectValue placeholder="Select city" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="c in cities" :key="c.code" :value="c.code">
            {{ c.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Barangay -->
    <div class="flex flex-col gap-2">
      <Label class="text-xs text-muted-foreground">Barangay</Label>
      <Select
        :model-value="selectedBarangay"
        :disabled="disabled || !selectedCity || loadingBarangays"
        @update:model-value="onBarangayChange"
      >
        <SelectTrigger class="w-full min-w-0">
          <LoaderCircle v-if="loadingBarangays" class="size-3.5 animate-spin text-muted-foreground" />
          <SelectValue placeholder="Select barangay" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="b in barangays" :key="b.code" :value="b.code">
            {{ b.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <!-- Street -->
    <div class="flex flex-col gap-2 sm:col-span-2">
      <Label class="text-xs text-muted-foreground">Street / House No. / Subdivision</Label>
      <Input
        :model-value="street"
        type="text"
        placeholder="e.g. 123 Rizal St, Villa Verde Subd."
        :disabled="disabled"
        @update:model-value="(val: string | number) => { street = String(val); onStreetChange() }"
      />
    </div>
  </div>
</template>
