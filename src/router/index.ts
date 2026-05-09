import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    requiresClinicContext?: boolean
    requiresGuest?: boolean
    requiredPermission?: string | string[]
    requiredFeature?: string
    usesCustomTopbar?: boolean
    devOnly?: boolean
  }
}
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
import HomeView from '@/views/HomeView.vue'
import { RouteNames } from './routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'
import { HttpError } from '@/lib/http'

export function canAccessRequiredPermission(
  requiredPermission: string | string[] | undefined,
  hasPermission: (permission: string) => boolean,
): boolean {
  if (!requiredPermission) return true
  if (Array.isArray(requiredPermission)) {
    return requiredPermission.some((permission) => hasPermission(permission))
  }
  return hasPermission(requiredPermission)
}

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: DashboardLayout,
      meta: { requiresAuth: true, requiresClinicContext: true },
      children: [
        {
          path: '',
          name: RouteNames.HOME,
          component: HomeView,
        },
        {
          path: 'patients',
          name: RouteNames.PATIENT_LIST,
          component: () => import('@/domains/patient/views/PatientListView.vue'),
          meta: { requiredPermission: 'patients.view' },
        },
        {
          path: 'patients/:id',
          name: RouteNames.PATIENT_DETAIL,
          component: () => import('@/domains/patient/views/PatientDetailView.vue'),
        },
        {
          path: 'patients/:patientId/encounters/new',
          name: RouteNames.ENCOUNTER_NEW,
          component: () => import('@/domains/encounter/views/EncounterFormRouter.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'patients/:patientId/encounters/:id',
          name: RouteNames.ENCOUNTER_DETAIL,
          component: () => import('@/domains/encounter/views/EncounterFormRouter.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'patients/:patientId/pregnancies/new',
          name: RouteNames.PREGNANCY_CREATE,
          component: () => import('@/domains/obgyn/views/PregnancyDetailView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'patients/:patientId/pregnancies/:pregnancyId',
          name: RouteNames.PREGNANCY_DETAIL,
          component: () => import('@/domains/obgyn/views/PregnancyDetailView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true, usesCustomTopbar: true },
        },
        {
          path: 'patients/:patientId/pregnancies/:pregnancyId/visits/new',
          name: RouteNames.PRENATAL_VISIT_CREATE,
          component: () => import('@/domains/obgyn/views/PrenatalVisitView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'patients/:patientId/pregnancies/:pregnancyId/visits/:visitId',
          name: RouteNames.PRENATAL_VISIT_DETAIL,
          component: () => import('@/domains/obgyn/views/PrenatalVisitView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'appointments',
          name: RouteNames.APPOINTMENT_LIST,
          component: () => import('@/domains/appointment/views/AppointmentListView.vue'),
          meta: { requiredFeature: 'appointments' },
        },
        {
          path: 'clinic',
          component: () => import('@/domains/clinic/views/ClinicLayout.vue'),
          children: [
            {
              path: '',
              name: RouteNames.CLINIC,
              redirect: { name: RouteNames.CLINIC_PROFILE },
            },
            {
              path: 'profile',
              name: RouteNames.CLINIC_PROFILE,
              component: () => import('@/domains/clinic/views/ClinicProfileView.vue'),
            },
            {
              path: 'settings',
              name: RouteNames.CLINIC_SETTINGS,
              component: () => import('@/domains/clinic/views/ClinicSettingsView.vue'),
              meta: { requiredPermission: 'clinic.manage' },
            },
            {
              path: 'medicines',
              name: RouteNames.CLINIC_MEDICINES,
              component: () => import('@/domains/medicine/views/MedicineListView.vue'),
              meta: { requiredPermission: 'medicines.manage' },
            },
            {
              path: 'consumables',
              name: RouteNames.CLINIC_CONSUMABLES,
              component: () => import('@/domains/consumable/views/ConsumableListView.vue'),
            },
            {
              path: 'lab-services',
              name: RouteNames.CLINIC_LAB_SERVICES,
              component: () => import('@/domains/labService/views/LabServiceListView.vue'),
            },
            {
              path: 'services',
              name: RouteNames.CLINIC_SERVICES,
              component: () => import('@/domains/service/views/ServiceListView.vue'),
            },
            {
              path: 'templates',
              name: RouteNames.CLINIC_TEMPLATES,
              component: () => import('@/domains/template/views/TemplateListView.vue'),
              meta: { requiredPermission: 'clinic.manage' },
            },
            {
              path: 'team',
              name: RouteNames.TEAM,
              component: () => import('@/domains/team/views/TeamManagementView.vue'),
              meta: { requiredPermission: 'team.manage' },
            },
            {
              path: 'roles',
              name: RouteNames.ROLES,
              component: () => import('@/domains/roles/views/RoleManagementView.vue'),
              meta: { requiredPermission: 'roles.manage' },
            },
            {
              path: 'logs',
              name: RouteNames.AUDIT_LOG_LIST,
              component: () => import('@/domains/audit-log/views/AuditLogListView.vue'),
              meta: { requiredPermission: 'audit-logs.view', requiredFeature: 'audit_logs' },
            },
          ],
        },
        {
          path: 'clinic/templates/:category/:variation',
          name: RouteNames.TEMPLATE_EDITOR,
          component: () => import('@/domains/template/views/TemplateEditorView.vue'),
          meta: { requiredPermission: 'clinic.manage' },
        },
        {
          path: 'schedule',
          name: RouteNames.SCHEDULE,
          component: () => import('@/domains/schedule/views/ScheduleView.vue'),
          meta: { requiredPermission: 'schedule.view', requiredFeature: 'schedule' },
        },
        {
          path: 'queue',
          name: RouteNames.QUEUE,
          component: () => import('@/domains/queue/views/QueueView.vue'),
        },
        {
          path: 'messages',
          name: RouteNames.MESSAGES,
          component: () => import('@/domains/message/views/MessagesView.vue'),
          meta: { requiredFeature: 'messages' },
        },
        {
          path: 'billing',
          name: RouteNames.BILLING,
          component: () => import('@/domains/billing/views/BillingView.vue'),
          meta: { requiredPermission: ['billing.view', 'billing.view-own'] },
        },
        {
          path: 'subscription',
          name: RouteNames.SUBSCRIPTION,
          component: () => import('@/domains/subscription/views/SubscriptionView.vue'),
          meta: { requiredPermission: 'clinic.manage' },
        },
        {
          path: 'account',
          name: RouteNames.ACCOUNT,
          component: () => import('@/domains/auth/views/AccountView.vue'),
        },
        {
          path: 'design-system',
          name: RouteNames.DESIGN_SYSTEM,
          component: () => import('@/views/ComponentsView.vue'),
          meta: { devOnly: true },
        },
        {
          path: 'logs/:id',
          name: RouteNames.AUDIT_LOG_DETAIL,
          component: () => import('@/domains/audit-log/views/AuditLogDetailView.vue'),
          meta: { requiredPermission: 'audit-logs.view', requiredFeature: 'audit_logs' },
        },
      ],
    },
    {
      path: '/login',
      name: RouteNames.LOGIN,
      component: () => import('@/domains/auth/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/signup',
      name: RouteNames.SIGNUP,
      component: () => import('@/domains/auth/views/SignupView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/verify-email-notice',
      name: RouteNames.VERIFY_EMAIL_NOTICE,
      component: () => import('@/domains/auth/views/VerifyEmailNoticeView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/verify-email',
      name: RouteNames.VERIFY_EMAIL,
      component: () => import('@/domains/auth/views/VerifyEmailView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/link-google',
      name: RouteNames.LINK_GOOGLE,
      component: () => import('@/domains/auth/views/LinkGoogleView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/forgot-password',
      name: RouteNames.FORGOT_PASSWORD,
      component: () => import('@/domains/auth/views/ForgotPasswordView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/reset-password',
      name: RouteNames.RESET_PASSWORD,
      component: () => import('@/domains/auth/views/ResetPasswordView.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/onboarding/create-clinic',
      name: RouteNames.ONBOARDING_CREATE_CLINIC,
      component: () => import('@/domains/clinic/views/CreateClinicView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/select-clinic',
      name: RouteNames.SELECT_CLINIC,
      component: () => import('@/domains/auth/views/SelectClinicView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/subscription/success',
      name: RouteNames.PAYMENT_SUCCESS,
      component: () => import('@/domains/subscription/views/PaymentSuccessView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/subscription/cancelled',
      name: RouteNames.PAYMENT_CANCELLED,
      component: () => import('@/domains/subscription/views/PaymentCancelledView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/queue-display/:token?',
      name: RouteNames.QUEUE_DISPLAY,
      component: () => import('@/domains/queue/views/QueueDisplayView.vue'),
      meta: { requiresAuth: false },
    },
  ],
})

router.onError((error) => {
  if (
    error instanceof Error &&
    (error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed'))
  ) {
    window.location.assign(window.location.href)
  }
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  if (to.meta.devOnly && !import.meta.env.DEV) {
    return { name: RouteNames.HOME }
  }

  // Page refresh: token exists but user not yet loaded
  if (authStore.isAuthenticated && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch (error) {
      // Only redirect on confirmed auth failure (401)
      // Network/server errors: keep credentials, user can retry when server is back
      if (error instanceof HttpError && error.status === 401) {
        return { name: RouteNames.LOGIN }
      }
    }
  }

  // Not authenticated → LOGIN
  if (to.meta.requiresAuth && !authStore.isAuthenticated) {
    const refreshed = await authStore.silentRefresh()
    if (!refreshed) {
      return { name: RouteNames.LOGIN }
    }
  }

  const isAuthPage =
    to.name === RouteNames.LOGIN ||
    to.name === RouteNames.SIGNUP ||
    to.name === RouteNames.VERIFY_EMAIL_NOTICE ||
    to.name === RouteNames.VERIFY_EMAIL

  // Authenticated on guest-only pages → redirect based on state
  if ((to.meta.requiresGuest || isAuthPage) && authStore.isAuthenticated) {
    if (authStore.needsOnboarding) {
      return { name: RouteNames.ONBOARDING_CREATE_CLINIC }
    }
    if (authStore.needsClinicSelection) {
      return { name: RouteNames.SELECT_CLINIC }
    }
    return { name: RouteNames.HOME }
  }

  // Needs onboarding → ONBOARDING_CREATE_CLINIC
  if (to.name !== RouteNames.ONBOARDING_CREATE_CLINIC && authStore.isAuthenticated && authStore.needsOnboarding) {
    return { name: RouteNames.ONBOARDING_CREATE_CLINIC }
  }

  // Needs clinic selection → SELECT_CLINIC
  if (to.meta.requiresClinicContext && authStore.isAuthenticated && authStore.needsClinicSelection) {
    return { name: RouteNames.SELECT_CLINIC }
  }

  // Already has context trying to visit select-clinic → HOME
  if (to.name === RouteNames.SELECT_CLINIC && authStore.isAuthenticated && authStore.hasClinicContext) {
    return { name: RouteNames.HOME }
  }

  // Already has context (or has memberships) trying to visit onboarding → HOME
  if (to.name === RouteNames.ONBOARDING_CREATE_CLINIC && authStore.isAuthenticated && !authStore.needsOnboarding) {
    return { name: RouteNames.HOME }
  }

  // Permission/feature guards — only apply when authenticated with clinic context
  if (authStore.isAuthenticated && authStore.hasClinicContext) {
    if (to.meta.requiredFeature && !authStore.hasFeature(to.meta.requiredFeature)) {
      return { name: RouteNames.HOME }
    }
    if (!canAccessRequiredPermission(to.meta.requiredPermission, authStore.hasPermission)) {
      return { name: RouteNames.HOME }
    }
  }
})

export default router
