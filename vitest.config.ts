import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

// Standalone Vitest config — intentionally NOT extending vite.config.ts so
// the PWA plugin (which spawns a service-worker build pipeline and pulls
// in workbox) doesn't run on every test invocation. We only need Vue +
// path aliases here.
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  define: {
    // Match the production `define` in vite.config.ts so any source code
    // that references this token type-checks under the test runner.
    __COMMIT_HASH__: JSON.stringify('test'),
  },
  test: {
    environment: 'happy-dom',
    globals: false,
    include: ['src/**/*.{test,spec}.ts'],
    // Loaded for every test file — installs fresh Pinia, stubs
    // `navigator.onLine`, restores mocks afterEach. See setup.ts.
    setupFiles: ['src/__tests__/setup.ts'],
    // Speed: a single thread keeps module-mocked tests deterministic
    // (vi.doMock + dynamic imports don't always survive cross-thread
    // pool serialization in Vitest 3 yet).
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Phase 1 coverage baseline: measure the logic and user-facing units
      // currently covered by Vitest. Broaden this list phase-by-phase as new
      // workflow tests land, instead of counting the entire app at once.
      include: [
        'src/components/layout/{GracePeriodBanner,TrialBanner}.vue',
        'src/components/shared/{FeatureGate,UpgradePrompt}.vue',
        'src/domains/appointment/api/appointmentApi.ts',
        'src/domains/appointment/components/{AppointmentCard,AppointmentStatusBadge}.vue',
        'src/domains/appointment/stores/**/*.ts',
        'src/domains/auth/api/authApi.ts',
        'src/domains/auth/components/{CredentialsForm,PasswordForm}.vue',
        'src/domains/auth/stores/**/*.ts',
        'src/domains/billing/api/billingApi.ts',
        'src/domains/audit-log/api/auditLogApi.ts',
        'src/domains/clinic/api/clinicApi.ts',
        'src/domains/consultation/api/{consultationApi,documentApi,labOrderApi,prescriptionApi}.ts',
        'src/domains/consultation/composables/useFeeDiscount.ts',
        'src/domains/consumable/api/consumableApi.ts',
        'src/domains/dashboard/api/dashboardApi.ts',
        'src/domains/encounter/api/encounterApi.ts',
        'src/domains/labService/api/labServiceApi.ts',
        'src/domains/medicine/api/medicineApi.ts',
        'src/domains/message/api/messageApi.ts',
        'src/domains/notification/api/notificationApi.ts',
        'src/domains/patient/components/EditPatientDialog.vue',
        'src/domains/patient/composables/usePatientSync.ts',
        'src/domains/patient/utils/profileCompleteness.ts',
        'src/domains/queue/api/{centrifugoApi,queueApi}.ts',
        'src/domains/queue/components/{QueueCard,QueueStatusBadge}.vue',
        'src/domains/queue/stores/**/*.ts',
        'src/domains/roles/api/roleApi.ts',
        'src/domains/schedule/api/scheduleApi.ts',
        'src/domains/schedule/components/{BreakEditor,DayScheduleRow}.vue',
        'src/domains/schedule/stores/**/*.ts',
        'src/domains/service/api/serviceApi.ts',
        'src/domains/subscription/components/{PricingCard,SubscriptionStatus}.vue',
        'src/domains/subscription/stores/**/*.ts',
        'src/domains/team/api/teamApi.ts',
        'src/domains/template/api/templateApi.ts',
        'src/lib/validationRules.ts',
      ],
      // Don't fail builds on tier-0 / infra files that exist mostly to
      // bootstrap testing or are environment-specific.
      exclude: [
        'src/__tests__/**',
        'src/main.ts',
        'src/router/**',
        'src/types/**',
        '**/*.d.ts',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      // Thresholds apply only to files that have at least one test.
      // Tightening these as the suite stabilises is the way; starting
      // permissive avoids blocking the first PR on coverage gaps.
      thresholds: {
        lines: 70,
        branches: 70,
        // Vue template handlers are counted as generated functions; raise this
        // phase-by-phase as more component interaction tests land.
        functions: 90,
        statements: 70,
      },
    },
  },
})
