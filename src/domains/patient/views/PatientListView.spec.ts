import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mountWithDeps } from '@/__tests__/helpers/mountWithDeps'
import PatientListView from './PatientListView.vue'

const mocks = vi.hoisted(() => ({
  permissions: [] as string[],
  replace: vi.fn(),
  push: vi.fn(),
  list: vi.fn().mockResolvedValue({ data: [], meta: { pagination: { page: 1, per_page: 10, total: 0, last_page: 1 } } }),
  attentionSummary: vi.fn().mockResolvedValue({ data: { counts: { total: 0 }, items: [] } }),
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
  useRoute: () => ({ query: {} }),
}))

vi.mock('@/domains/auth/stores/authStore', () => ({
  useAuthStore: () => ({
    hasPermission: (permission: string) => mocks.permissions.includes(permission),
  }),
}))

vi.mock('../api/patientApi', () => ({
  patientApi: {
    list: mocks.list,
    attentionSummary: mocks.attentionSummary,
  },
}))

const STUBS = {
  Badge: { template: '<span><slot /></span>' },
  Button: {
    template: '<button type="button"><slot /></button>',
  },
  Input: { template: '<input />' },
  Skeleton: { template: '<div />' },
  Table: { template: '<table><slot /></table>' },
  TableBody: { template: '<tbody><slot /></tbody>' },
  TableCell: { template: '<td><slot /></td>' },
  TableHead: { template: '<th><slot /></th>' },
  TableHeader: { template: '<thead><slot /></thead>' },
  TableRow: { template: '<tr><slot /></tr>' },
  Pagination: { template: '<nav><slot /></nav>' },
  PaginationContent: { template: '<div><slot :items="[]" /></div>' },
  PaginationEllipsis: { template: '<span />' },
  PaginationItem: { template: '<button type="button"><slot /></button>' },
  PaginationNext: { template: '<button type="button">Next</button>' },
  PaginationPrevious: { template: '<button type="button">Previous</button>' },
  Popover: { template: '<div><slot /></div>' },
  PopoverContent: { template: '<div><slot /></div>' },
  PopoverTrigger: { template: '<div><slot /></div>' },
  Select: { template: '<div><slot /></div>' },
  SelectContent: { template: '<div><slot /></div>' },
  SelectItem: { template: '<div><slot /></div>' },
  SelectTrigger: { template: '<button type="button"><slot /></button>' },
  SelectValue: { template: '<span />' },
  CreatePatientDialog: { template: '<div data-test="create-patient-dialog" />' },
  PatientAvatar: { template: '<div />' },
  PatientCompletenessRing: { template: '<div><slot /></div>' },
  PatientStatusBadge: { template: '<span />' },
}

describe('PatientListView permission gates', () => {
  beforeEach(() => {
    mocks.permissions = []
    mocks.list.mockResolvedValue({ data: [], meta: { pagination: { page: 1, per_page: 10, total: 0, last_page: 1 } } })
    mocks.attentionSummary.mockResolvedValue({ data: { counts: { total: 0 }, items: [] } })
  })

  it('hides patient creation controls without patients.create permission', () => {
    mocks.permissions = ['patients.view']

    const wrapper = mountWithDeps(PatientListView, { global: { stubs: STUBS } })

    expect(wrapper.text()).not.toContain('Add Patient')
    expect(wrapper.text()).not.toContain('Add your first patient')
    expect(wrapper.find('[data-test="create-patient-dialog"]').exists()).toBe(false)
  })

  it('shows patient creation controls with patients.create permission', () => {
    mocks.permissions = ['patients.view', 'patients.create']

    const wrapper = mountWithDeps(PatientListView, { global: { stubs: STUBS } })

    expect(wrapper.text()).toContain('Add Patient')
    expect(wrapper.text()).toContain('Add your first patient')
    expect(wrapper.find('[data-test="create-patient-dialog"]').exists()).toBe(true)
  })
})
