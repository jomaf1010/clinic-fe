<script setup lang="ts">
import { computed, onMounted } from 'vue'
import {
  Crown,
  Check,
  Sparkles,
  CalendarCheck,
  Clock,
  AlertTriangle,
  MessageSquare,
  Calendar,
  CalendarDays,
  FlaskConical,
  FileText,
  Shield,
  Tv,
  Users,
  FileCheck,
  Stethoscope,
  ListOrdered,
  Receipt,
  Pill,
  ClipboardList,
} from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { useSubscriptionStore } from '../stores/subscriptionStore'
import BillingHistory from '../components/BillingHistory.vue'
import CancelSubscriptionDialog from '../components/CancelSubscriptionDialog.vue'

const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()

const status = computed(() => subscriptionStore.status)
const isOwner = computed(() => authStore.currentRole === 'owner')

const billingEndFormatted = computed(() => {
  const endsAt = status.value?.billing_period_ends_at
  if (!endsAt) return null
  return new Date(endsAt).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
})

const allFeatures = [
  { key: 'patients', label: 'Patient Management', icon: Users, free: true },
  { key: 'consultations', label: 'Consultations', icon: Stethoscope, free: true },
  { key: 'queue', label: 'Queue Management', icon: ListOrdered, free: true },
  { key: 'billing', label: 'Billing & Invoicing', icon: Receipt, free: true },
  { key: 'medicines', label: 'Medicines', icon: Pill, free: true },
  { key: 'prescriptions', label: 'Prescriptions', icon: ClipboardList, free: true },
  { key: 'messages', label: 'Messages & Chat', icon: MessageSquare, free: false },
  { key: 'appointments', label: 'Appointments', icon: Calendar, free: false },
  { key: 'schedule', label: 'Schedule Management', icon: CalendarDays, free: false },
  { key: 'lab_orders', label: 'Lab Orders', icon: FlaskConical, free: false },
  { key: 'lab_services', label: 'Lab Services', icon: FlaskConical, free: false },
  { key: 'consumables', label: 'Consumables Tracking', icon: Pill, free: false },
  { key: 'audit_logs', label: 'Audit Logs', icon: FileText, free: false },
  { key: 'custom_roles', label: 'Custom Roles', icon: Shield, free: false },
  { key: 'queue_display', label: 'Queue Display (TV)', icon: Tv, free: false },
  { key: 'future', label: 'Future Features', icon: Sparkles, free: false },
]

onMounted(() => {
  subscriptionStore.fetchStatus()
  subscriptionStore.fetchHistory()
})
</script>

<template>
  <div class="flex flex-1 flex-col pt-4">
    <div class="w-full px-4 pb-8 sm:px-6">
      <!-- Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold tracking-tight">Subscription</h1>
        <p class="mt-1 text-sm text-muted-foreground">Manage your clinic's plan and billing</p>
      </div>

      <!-- 2-col layout -->
      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Left column (3/5) -->
        <div class="flex flex-col gap-6 lg:col-span-2">
          <!-- Pro Status Card (premium feel, same theme as dashboard banner) -->
          <div v-if="status" class="relative overflow-hidden rounded-xl border border-amber-200/60 bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50/80 dark:border-amber-800/40 dark:from-amber-950/40 dark:via-yellow-950/30 dark:to-amber-950/40">
            <div class="relative z-10 p-6">
              <div class="flex items-start gap-4">
                <img src="/images/pro-badge.svg" alt="Pro" class="size-12 shrink-0 drop-shadow-md" />
                <div class="flex-1">
                  <div class="flex items-center gap-2.5">
                    <h2 class="text-lg font-bold text-amber-900 dark:text-amber-100">
                      {{ authStore.currentClinic?.clinic_name }}
                    </h2>
                    <span class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                      <Sparkles class="size-3" />
                      Pro
                    </span>
                  </div>

                  <!-- Billing info -->
                  <div class="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                    <div v-if="status.is_trial && status.trial_days_left !== null" class="flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
                      <Clock class="size-3.5" />
                      <span>Trial &middot; <strong>{{ status.trial_days_left }} day{{ status.trial_days_left === 1 ? '' : 's' }}</strong> remaining</span>
                    </div>

                    <div v-if="billingEndFormatted && !status.is_trial" class="flex items-center gap-1.5 text-amber-700/80 dark:text-amber-400/70">
                      <CalendarCheck class="size-3.5" />
                      <span v-if="status.cancel_at_period_end">Access until <strong>{{ billingEndFormatted }}</strong></span>
                      <span v-else>Renews <strong>{{ billingEndFormatted }}</strong></span>
                    </div>

                    <div v-if="billingEndFormatted && !status.is_trial && !status.cancel_at_period_end" class="flex items-center gap-1.5 text-amber-700/80 dark:text-amber-400/70">
                      <Receipt class="size-3.5" />
                      <span>PHP {{ status.next_billing_amount.toLocaleString() }}/mo</span>
                    </div>
                  </div>

                  <div v-if="status.is_in_grace_period" class="mt-3 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
                    <AlertTriangle class="size-3.5" />
                    <span class="font-medium">Billing overdue — renew to keep Pro features</span>
                  </div>

                  <div v-if="status.cancel_at_period_end" class="mt-3">
                    <Badge variant="outline" class="border-amber-300 bg-amber-100/50 text-amber-700 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                      Cancellation scheduled
                    </Badge>
                  </div>

                  <!-- Actions (owner only) -->
                  <div v-if="isOwner && status.plan === 'pro' && !status.is_trial && billingEndFormatted" class="mt-4 flex gap-2">
                    <template v-if="status.cancel_at_period_end">
                      <Button
                        size="sm"
                        class="bg-amber-600 text-white hover:bg-amber-700"
                        :disabled="subscriptionStore.cancelLoading"
                        @click="subscriptionStore.reactivateSubscription()"
                      >
                        Reactivate Subscription
                      </Button>
                    </template>
                    <template v-else>
                      <CancelSubscriptionDialog />
                    </template>
                  </div>

                  <!-- Trial upgrade (owner only) -->
                  <div v-if="isOwner && status.is_trial" class="mt-4">
                    <Button
                      size="sm"
                      class="gap-1.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-sm hover:from-amber-600 hover:to-yellow-600"
                      :disabled="subscriptionStore.checkoutLoading"
                      @click="subscriptionStore.initiateCheckout()"
                    >
                      <Crown class="size-3.5" />
                      Subscribe — PHP 1,299/mo
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <div class="pointer-events-none absolute inset-0 bg-gradient-to-br from-transparent via-white/10 to-amber-100/30 dark:via-white/5 dark:to-amber-900/20" />
          </div>

          <!-- Billing History -->
          <BillingHistory
            v-if="subscriptionStore.payments.length > 0"
            :payments="subscriptionStore.payments"
            :current-page="subscriptionStore.currentPage"
            :total-pages="subscriptionStore.totalPages"
            @page-change="subscriptionStore.fetchHistory($event)"
          />
        </div>

        <!-- Right column (2/5) — Features -->
        <div class="lg:col-span-3">
          <div class="rounded-xl border bg-card p-6">
            <h3 class="text-sm font-semibold">Your Plan Includes</h3>
            <p class="mt-1 text-xs text-muted-foreground">All features available on your current plan</p>

            <div class="mt-5 grid grid-cols-1 gap-y-1 sm:grid-cols-2 sm:gap-x-4">
              <div
                v-for="feat in allFeatures"
                :key="feat.key"
                class="flex items-center gap-2.5 rounded-lg px-2 py-2 transition-colors"
                :class="(feat.key === 'future' ? authStore.isPro : authStore.hasFeature(feat.key))
                  ? ''
                  : 'opacity-40'"
              >
                <div
                  class="flex size-7 shrink-0 items-center justify-center rounded-md"
                  :class="(feat.key === 'future' ? authStore.isPro : authStore.hasFeature(feat.key))
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-muted'"
                >
                  <Check
                    v-if="feat.key === 'future' ? authStore.isPro : authStore.hasFeature(feat.key)"
                    class="size-3.5 text-green-600 dark:text-green-400"
                  />
                  <component
                    :is="feat.icon"
                    v-else
                    class="size-3.5 text-muted-foreground"
                  />
                </div>
                <span class="flex-1 text-sm" :class="(feat.key === 'future' ? authStore.isPro : authStore.hasFeature(feat.key)) ? 'font-medium' : 'text-muted-foreground'">
                  {{ feat.label }}
                </span>
                <Badge
                  v-if="!feat.free"
                  variant="outline"
                  class="shrink-0 text-[10px]"
                  :class="(feat.key === 'future' ? authStore.isPro : authStore.hasFeature(feat.key))
                    ? 'border-amber-300 bg-amber-50 text-amber-600 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                    : 'border-muted'"
                >
                  Pro
                </Badge>
              </div>
            </div>

            <!-- Limits -->
            <div class="mt-5 border-t pt-5">
              <h4 class="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Limits</h4>
              <div class="space-y-3">
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <FileCheck class="size-4 text-muted-foreground" />
                    <span>PDF Generation</span>
                  </div>
                  <span class="font-medium tabular-nums">
                    {{ authStore.getLimit('pdf_generation_daily').max === null ? 'Unlimited' : `${authStore.getLimit('pdf_generation_daily').max}/day` }}
                  </span>
                </div>
                <div class="flex items-center justify-between text-sm">
                  <div class="flex items-center gap-2">
                    <Users class="size-4 text-muted-foreground" />
                    <span>Team Members</span>
                  </div>
                  <span class="font-medium tabular-nums">
                    {{ authStore.getLimit('team_members').max === null ? 'Unlimited' : `${authStore.getLimit('team_members').used}/${authStore.getLimit('team_members').max}` }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
