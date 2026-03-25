import { createRouter, createWebHistory } from 'vue-router'
import DashboardLayout from '@/components/layout/DashboardLayout.vue'
import HomeView from '@/views/HomeView.vue'
import { RouteNames } from './routeNames'
import { useAuthStore } from '@/domains/auth/stores/authStore'

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
        },
        {
          path: 'patients/:id',
          name: RouteNames.PATIENT_DETAIL,
          component: () => import('@/domains/patient/views/PatientDetailView.vue'),
        },
        {
          path: 'patients/:patientId/consultations/new',
          name: RouteNames.CONSULTATION_NEW,
          component: () => import('@/domains/consultation/views/ConsultationFormView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'patients/:patientId/consultations/:id',
          name: RouteNames.CONSULTATION_DETAIL,
          component: () => import('@/domains/consultation/views/ConsultationFormView.vue'),
          meta: { requiresAuth: true, requiresClinicContext: true },
        },
        {
          path: 'appointments',
          name: RouteNames.APPOINTMENT_LIST,
          component: () => import('@/domains/appointment/views/AppointmentListView.vue'),
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
            },
            {
              path: 'medicines',
              name: RouteNames.CLINIC_MEDICINES,
              component: () => import('@/domains/medicine/views/MedicineListView.vue'),
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
              path: 'templates',
              name: RouteNames.CLINIC_TEMPLATES,
              component: () => import('@/domains/template/views/TemplateListView.vue'),
            },
            {
              path: 'team',
              name: RouteNames.TEAM,
              component: () => import('@/domains/team/views/TeamManagementView.vue'),
            },
            {
              path: 'roles',
              name: RouteNames.ROLES,
              component: () => import('@/domains/roles/views/RoleManagementView.vue'),
            },
            {
              path: 'logs',
              name: RouteNames.AUDIT_LOG_LIST,
              component: () => import('@/domains/audit-log/views/AuditLogListView.vue'),
            },
          ],
        },
        {
          path: 'clinic/templates/:category/:variation',
          name: RouteNames.TEMPLATE_EDITOR,
          component: () => import('@/domains/template/views/TemplateEditorView.vue'),
        },
        {
          path: 'schedule',
          name: RouteNames.SCHEDULE,
          component: () => import('@/domains/schedule/views/ScheduleView.vue'),
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
        },
        {
          path: 'billing',
          name: RouteNames.BILLING,
          component: () => import('@/domains/billing/views/BillingView.vue'),
        },
        {
          path: 'subscription',
          name: RouteNames.SUBSCRIPTION,
          component: () => import('@/domains/subscription/views/SubscriptionView.vue'),
        },
        {
          path: 'account',
          name: RouteNames.ACCOUNT,
          component: () => import('@/domains/auth/views/AccountView.vue'),
        },
        {
          path: 'components',
          name: RouteNames.COMPONENTS,
          component: () => import('@/views/ComponentsView.vue'),
        },
        {
          path: 'logs/:id',
          name: RouteNames.AUDIT_LOG_DETAIL,
          component: () => import('@/domains/audit-log/views/AuditLogDetailView.vue'),
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
      path: '/queue-display/:token',
      name: RouteNames.QUEUE_DISPLAY,
      component: () => import('@/domains/queue/views/QueueDisplayView.vue'),
      meta: { requiresAuth: false },
    },
  ],
})

router.beforeEach(async (to) => {
  const authStore = useAuthStore()

  // Page refresh: token exists but user not yet loaded
  if (authStore.isAuthenticated && !authStore.user) {
    try {
      await authStore.fetchUser()
    } catch {
      const refreshed = await authStore.silentRefresh()
      if (!refreshed) {
        authStore.logout()
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

  // Authenticated on auth pages → redirect based on state
  if ((to.name === RouteNames.LOGIN || to.name === RouteNames.SIGNUP || to.name === RouteNames.VERIFY_EMAIL_NOTICE || to.name === RouteNames.VERIFY_EMAIL) && authStore.isAuthenticated) {
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
})

export default router
