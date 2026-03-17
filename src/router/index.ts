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
          path: 'medicines',
          name: RouteNames.MEDICINE_LIST,
          component: () => import('@/domains/medicine/views/MedicineListView.vue'),
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
          path: 'messages',
          name: RouteNames.MESSAGES,
          component: () => import('@/domains/message/views/MessagesView.vue'),
        },
        {
          path: 'logs',
          name: RouteNames.AUDIT_LOG_LIST,
          component: () => import('@/domains/audit-log/views/AuditLogListView.vue'),
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
