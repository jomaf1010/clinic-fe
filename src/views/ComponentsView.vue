<script setup lang="ts">
import { ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Slider } from '@/components/ui/slider'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@/components/ui/avatar'
import PatientStatusBadge from '@/domains/patient/components/PatientStatusBadge.vue'
import {
  Heart,
  Mail,
  Settings,
  Trash2,
  Plus,
  Search,
  CheckCircle2,
  Info,
  LoaderCircle,
  ChevronDown,
  Bell,
  AlertTriangle,
  User,
  LogOut,
  Copy,
  MoreHorizontal,
  PanelRight,
  Activity,
  CalendarCheck,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from 'lucide-vue-next'

const dialogOpen = ref(false)
const checkboxVal = ref(false)
const selectVal = ref('')
const sliderVal = ref([50])
const inputVal = ref('')
const textareaVal = ref('')
const glassDialogOpen = ref(false)
const glassSheetOpen = ref(false)
const { isDark } = useTheme()
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-10 pb-10">
    <div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge variant="outline">/design-system</Badge>
        <Badge variant="secondary">Glassmorphism lab</Badge>
      </div>
      <h1 class="mt-3 text-2xl font-bold">Design System</h1>
      <p class="text-muted-foreground">Glassmorphism concepts plus the existing shadcn component inventory.</p>
    </div>

    <!-- Glassmorphism Lab -->
    <section class="glass-lab overflow-hidden rounded-2xl p-6" :class="{ 'glass-lab-dark': isDark }">
      <div class="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 class="text-lg font-semibold">Glass Surface Study</h2>
          <p class="text-sm text-muted-foreground">Tune the recipe here before promoting anything globally.</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="glass-chip">blur 18px</span>
          <span class="glass-chip">white 68%</span>
          <span class="glass-chip">soft border</span>
        </div>
      </div>

      <div class="grid gap-5 lg:grid-cols-[240px_1fr]">
        <aside class="glass-panel p-4">
          <div class="mb-6 flex items-center gap-3">
            <div class="glass-icon">
              <Stethoscope class="size-5" />
            </div>
            <div>
              <p class="font-semibold">JJLF Clinic</p>
              <p class="text-sm text-muted-foreground">Owner workspace</p>
            </div>
          </div>
          <div class="space-y-3">
            <div class="glass-nav-active">
              <Activity class="size-4" />
              Dashboard
            </div>
            <div class="glass-nav-item">
              <UsersRound class="size-4" />
              Patients
            </div>
            <div class="glass-nav-item">
              <CalendarCheck class="size-4" />
              Appointments
            </div>
            <div class="glass-nav-item">
              <ShieldCheck class="size-4" />
              Compliance
            </div>
          </div>
        </aside>

        <div class="space-y-5">
          <div class="glass-panel p-5">
            <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 class="text-xl font-semibold">Clinic command center</h3>
                <p class="text-sm text-muted-foreground">Readable, airy, and less fragile than neumorphism.</p>
              </div>
              <Button size="sm">
                <Plus class="size-4" />
                New patient
              </Button>
            </div>
          </div>

          <div class="grid gap-5 md:grid-cols-3">
            <div class="glass-card">
              <div class="glass-icon text-blue-600">
                <UsersRound class="size-5" />
              </div>
              <p class="mt-5 text-sm text-muted-foreground">Total patients</p>
              <p class="mt-1 text-3xl font-semibold">1,248</p>
            </div>
            <div class="glass-card">
              <div class="glass-icon text-emerald-600">
                <Stethoscope class="size-5" />
              </div>
              <p class="mt-5 text-sm text-muted-foreground">Today's visits</p>
              <p class="mt-1 text-3xl font-semibold">24</p>
            </div>
            <div class="glass-card">
              <div class="glass-icon text-amber-600">
                <Bell class="size-5" />
              </div>
              <p class="mt-5 text-sm text-muted-foreground">Pending tasks</p>
              <p class="mt-1 text-3xl font-semibold">7</p>
            </div>
          </div>

          <div class="grid gap-5 md:grid-cols-[1fr_320px]">
            <div class="glass-panel p-5">
              <div class="mb-5 flex items-center justify-between">
                <div>
                  <h3 class="font-semibold">Revenue trend</h3>
                  <p class="text-sm text-muted-foreground">Last 30 days</p>
                </div>
                <Badge variant="outline">Preview</Badge>
              </div>
              <div class="glass-chart">
                <div v-for="height in [32, 48, 42, 64, 58, 74, 68, 86, 72, 92]" :key="height" :style="{ height: `${height}%` }" />
              </div>
            </div>

            <div class="glass-panel p-5">
              <h3 class="font-semibold">Form glass</h3>
              <p class="mb-4 text-sm text-muted-foreground">Inputs stay solid for readability.</p>
              <div class="space-y-3">
                <div class="space-y-2">
                  <Label for="glass-patient">Patient</Label>
                  <Input id="glass-patient" placeholder="Search patient..." />
                </div>
                <div class="space-y-2">
                  <Label for="glass-note">Visit note</Label>
                  <Textarea id="glass-note" rows="3" placeholder="Short note..." />
                </div>
                <Button class="w-full">Save draft</Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-5 lg:grid-cols-2">
        <div class="glass-panel p-5">
          <div class="mb-4">
            <h3 class="font-semibold">Background Treatments</h3>
            <p class="text-sm text-muted-foreground">Glass needs color behind it, but not wallpaper chaos.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="glass-swatch glass-bg-clinic">
              <span>Clinic calm</span>
            </div>
            <div class="glass-swatch glass-bg-blue">
              <span>Cool blue</span>
            </div>
            <div class="glass-swatch glass-bg-aurora">
              <span>Aurora</span>
            </div>
          </div>
        </div>

        <div class="glass-panel p-5">
          <div class="mb-4">
            <h3 class="font-semibold">Surface Opacity</h3>
            <p class="text-sm text-muted-foreground">The middle option is usually the safest for medical UI.</p>
          </div>
          <div class="grid gap-3 sm:grid-cols-3">
            <div class="glass-opacity-card glass-opacity-light">
              <span>Light</span>
              <strong>52%</strong>
            </div>
            <div class="glass-opacity-card glass-opacity-balanced">
              <span>Balanced</span>
              <strong>68%</strong>
            </div>
            <div class="glass-opacity-card glass-opacity-solid">
              <span>Solid</span>
              <strong>82%</strong>
            </div>
          </div>
        </div>

        <div class="glass-panel p-5">
          <div class="mb-4">
            <h3 class="font-semibold">Border and Shadow</h3>
            <p class="text-sm text-muted-foreground">Enough edge to read, not enough to look boxed.</p>
          </div>
          <div class="space-y-3">
            <div class="glass-recipe-row glass-border-soft">
              <span>Soft border</span>
              <code>1px / 45%</code>
            </div>
            <div class="glass-recipe-row glass-shadow-soft">
              <span>Soft shadow</span>
              <code>18px 45px / 8%</code>
            </div>
            <div class="glass-recipe-row glass-shadow-deep">
              <span>Deep shadow</span>
              <code>24px 70px / 12%</code>
            </div>
          </div>
        </div>

        <div class="glass-panel p-5">
          <div class="mb-4">
            <h3 class="font-semibold">Sidebar Active Variants</h3>
            <p class="text-sm text-muted-foreground">Pick the active item language before touching global nav.</p>
          </div>
          <div class="space-y-3">
            <div class="glass-nav-active">
              <Activity class="size-4" />
              Glass active
            </div>
            <div class="glass-nav-active glass-nav-solid">
              <Activity class="size-4" />
              Solid active
            </div>
            <div class="glass-nav-active glass-nav-minimal">
              <Activity class="size-4" />
              Minimal active
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div class="mb-4">
          <h3 class="font-semibold">Glass Component Set</h3>
          <p class="text-sm text-muted-foreground">A working pass for common app pieces before this escapes into global CSS.</p>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <div class="glass-panel p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 class="font-semibold">Buttons</h4>
                <p class="text-sm text-muted-foreground">Primary actions stay saturated; secondary actions stay quiet.</p>
              </div>
              <span class="glass-chip">actions</span>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="glass-button glass-button-primary">
                <Plus class="size-4" />
                New patient
              </button>
              <button type="button" class="glass-button glass-button-secondary">
                <Search class="size-4" />
                Search
              </button>
              <button type="button" class="glass-button glass-button-quiet">
                <Bell class="size-4" />
                Remind
              </button>
              <button type="button" class="glass-button glass-button-success">Approve</button>
              <button type="button" class="glass-button glass-button-warning">Pending</button>
              <button type="button" class="glass-button glass-button-danger">Cancel</button>
            </div>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <div>
                <h4 class="font-semibold">Avatars and Badges</h4>
                <p class="text-sm text-muted-foreground">Small identity pieces need contrast more than blur.</p>
              </div>
              <span class="glass-chip">people</span>
            </div>
            <div class="space-y-4">
              <div class="flex flex-wrap items-center gap-3">
                <Avatar class="glass-avatar">
                  <AvatarFallback>JF</AvatarFallback>
                </Avatar>
                <Avatar class="glass-avatar glass-avatar-teal">
                  <AvatarFallback>MD</AvatarFallback>
                </Avatar>
                <Avatar class="glass-avatar glass-avatar-amber">
                  <AvatarFallback>RN</AvatarFallback>
                </Avatar>
                <div>
                  <p class="text-sm font-semibold">Care team</p>
                  <p class="text-xs text-muted-foreground">Owner, doctor, nurse</p>
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <span class="glass-badge glass-badge-blue">Active</span>
                <span class="glass-badge glass-badge-teal">Checked in</span>
                <span class="glass-badge glass-badge-amber">Follow up</span>
                <span class="glass-badge glass-badge-rose">Overdue</span>
                <span class="glass-badge glass-badge-neutral">Draft</span>
              </div>
            </div>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Form Controls</h4>
              <p class="text-sm text-muted-foreground">Readable controls, glass shell. The text field is not where we get clever.</p>
            </div>
            <div class="grid gap-4">
              <div class="space-y-2">
                <Label for="glass-control-patient">Patient</Label>
                <Input id="glass-control-patient" class="glass-field" placeholder="Search patient..." />
              </div>
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="space-y-2">
                  <Label>Visit type</Label>
                  <Select default-value="consult">
                    <SelectTrigger class="glass-field">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consult">Consultation</SelectItem>
                      <SelectItem value="follow-up">Follow-up</SelectItem>
                      <SelectItem value="urgent">Urgent care</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="space-y-2">
                  <Label>Priority</Label>
                  <div class="glass-segment">
                    <button type="button" class="is-active">Routine</button>
                    <button type="button">Urgent</button>
                  </div>
                </div>
              </div>
              <div class="space-y-2">
                <Label for="glass-control-note">Clinical note</Label>
                <Textarea id="glass-control-note" class="glass-field" rows="3" placeholder="Short note..." />
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl p-3 glass-control-row">
                <div class="flex items-center gap-3">
                  <Checkbox id="glass-control-checkbox" class="glass-checkbox" />
                  <Label for="glass-control-checkbox" class="text-sm">Send patient reminder</Label>
                </div>
                <button type="button" class="glass-toggle" aria-pressed="true">
                  <span />
                </button>
              </div>
            </div>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Cards</h4>
              <p class="text-sm text-muted-foreground">Cards should separate priority, not become decorative fog machines.</p>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="glass-mini-card">
                <div class="glass-mini-card-top">
                  <span class="glass-badge glass-badge-teal">Today</span>
                  <Stethoscope class="size-4 text-teal-600" />
                </div>
                <strong>24 visits</strong>
                <p>7 completed, 3 waiting</p>
              </div>
              <div class="glass-mini-card glass-mini-card-blue">
                <div class="glass-mini-card-top">
                  <span class="glass-badge glass-badge-blue">Billing</span>
                  <Activity class="size-4 text-blue-600" />
                </div>
                <strong>₱18,420</strong>
                <p>Collected this week</p>
              </div>
              <div class="glass-mini-card glass-mini-card-amber sm:col-span-2">
                <div class="glass-mini-card-top">
                  <span class="glass-badge glass-badge-amber">Attention</span>
                  <Bell class="size-4 text-amber-600" />
                </div>
                <strong>3 pending callbacks</strong>
                <p>Keep this kind of card rare so it still means something.</p>
              </div>
            </div>
          </div>

          <div class="glass-panel p-5 lg:col-span-2">
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 class="font-semibold">Table</h4>
                <p class="text-sm text-muted-foreground">Dense data gets light glass, clear rows, and no circus lighting.</p>
              </div>
              <button type="button" class="glass-button glass-button-secondary">
                <Copy class="size-4" />
                Export
              </button>
            </div>
            <div class="glass-table-wrap">
              <table class="glass-table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Visit</th>
                    <th>Status</th>
                    <th class="text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>
                      <div class="glass-table-person">
                        <Avatar class="glass-avatar-sm">
                          <AvatarFallback>AM</AvatarFallback>
                        </Avatar>
                        <span>Ana Mercado</span>
                      </div>
                    </td>
                    <td>Follow-up</td>
                    <td><span class="glass-badge glass-badge-teal">Checked in</span></td>
                    <td class="text-right">₱0</td>
                  </tr>
                  <tr>
                    <td>
                      <div class="glass-table-person">
                        <Avatar class="glass-avatar-sm glass-avatar-amber">
                          <AvatarFallback>RL</AvatarFallback>
                        </Avatar>
                        <span>Rico Luna</span>
                      </div>
                    </td>
                    <td>Consultation</td>
                    <td><span class="glass-badge glass-badge-blue">Scheduled</span></td>
                    <td class="text-right">₱850</td>
                  </tr>
                  <tr>
                    <td>
                      <div class="glass-table-person">
                        <Avatar class="glass-avatar-sm glass-avatar-teal">
                          <AvatarFallback>KC</AvatarFallback>
                        </Avatar>
                        <span>Kaye Cruz</span>
                      </div>
                    </td>
                    <td>Lab review</td>
                    <td><span class="glass-badge glass-badge-amber">Pending</span></td>
                    <td class="text-right">₱1,200</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="glass-panel p-5 lg:col-span-2">
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 class="font-semibold">Timelines</h4>
                <p class="text-sm text-muted-foreground">For encounters, appointments, billing, and activity history.</p>
              </div>
              <span class="glass-chip">time-based UI</span>
            </div>

            <div class="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div class="glass-timeline-card">
                <div class="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <h5 class="font-semibold">Encounter timeline</h5>
                    <p class="text-sm text-muted-foreground">Clear chronology with enough hierarchy for clinical scanning.</p>
                  </div>
                  <span class="glass-badge glass-badge-blue">Today</span>
                </div>

                <div class="glass-timeline">
                  <div class="glass-timeline-item is-complete">
                    <div class="glass-timeline-marker">
                      <CheckCircle2 class="size-4" />
                    </div>
                    <div class="glass-timeline-content">
                      <div class="glass-timeline-head">
                        <strong>Patient checked in</strong>
                        <span>8:42 AM</span>
                      </div>
                      <p>Vitals captured and queue status updated.</p>
                    </div>
                  </div>
                  <div class="glass-timeline-item is-active">
                    <div class="glass-timeline-marker">
                      <Stethoscope class="size-4" />
                    </div>
                    <div class="glass-timeline-content">
                      <div class="glass-timeline-head">
                        <strong>Consultation in progress</strong>
                        <span>9:05 AM</span>
                      </div>
                      <p>SOAP note draft opened with active prescriptions.</p>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <span class="glass-badge glass-badge-teal">SOAP</span>
                        <span class="glass-badge glass-badge-neutral">Rx pending</span>
                      </div>
                    </div>
                  </div>
                  <div class="glass-timeline-item is-warning">
                    <div class="glass-timeline-marker">
                      <AlertTriangle class="size-4" />
                    </div>
                    <div class="glass-timeline-content">
                      <div class="glass-timeline-head">
                        <strong>Lab result pending</strong>
                        <span>Later</span>
                      </div>
                      <p>Result attachment expected before follow-up booking.</p>
                    </div>
                  </div>
                </div>
              </div>

              <div class="space-y-5">
                <div class="glass-timeline-card">
                  <div class="mb-4">
                    <h5 class="font-semibold">Activity feed</h5>
                    <p class="text-sm text-muted-foreground">Compact variant for sidebars and detail drawers.</p>
                  </div>
                  <div class="space-y-3">
                    <div class="glass-feed-item">
                      <CalendarCheck class="size-4" />
                      <div>
                        <strong>Appointment moved</strong>
                        <p>Apr 30, 2:30 PM</p>
                      </div>
                    </div>
                    <div class="glass-feed-item">
                      <Bell class="size-4" />
                      <div>
                        <strong>Reminder sent</strong>
                        <p>SMS queued successfully</p>
                      </div>
                    </div>
                    <div class="glass-feed-item">
                      <Activity class="size-4" />
                      <div>
                        <strong>Billing updated</strong>
                        <p>₱850 invoice created</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="glass-timeline-card">
                  <div class="mb-4">
                    <h5 class="font-semibold">Care journey</h5>
                    <p class="text-sm text-muted-foreground">Horizontal variant for status progress.</p>
                  </div>
                  <div class="glass-stepper">
                    <div class="glass-step is-done">
                      <span>1</span>
                      <strong>Booked</strong>
                    </div>
                    <div class="glass-step is-current">
                      <span>2</span>
                      <strong>Visit</strong>
                    </div>
                    <div class="glass-step">
                      <span>3</span>
                      <strong>Billing</strong>
                    </div>
                    <div class="glass-step">
                      <span>4</span>
                      <strong>Follow-up</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6">
        <div class="mb-4">
          <h3 class="font-semibold">Floating and Feedback Surfaces</h3>
          <p class="text-sm text-muted-foreground">Modals, drawers, menus, feedback, and loading states need their own glass rules.</p>
        </div>

        <div class="grid gap-5 lg:grid-cols-2">
          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Dialog and Sheet</h4>
              <p class="text-sm text-muted-foreground">High-focus surfaces get stronger borders and less transparency.</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <button type="button" class="glass-button glass-button-primary" @click="glassDialogOpen = true">
                Open dialog
              </button>
              <button type="button" class="glass-button glass-button-secondary" @click="glassSheetOpen = true">
                <PanelRight class="size-4" />
                Open sheet
              </button>
            </div>

            <Dialog v-model:open="glassDialogOpen">
              <DialogContent
                :class="[
                  'glass-floating-content glass-dialog-preview',
                  { 'glass-floating-content-dark': isDark },
                ]"
              >
                <DialogHeader>
                  <DialogTitle>Confirm visit update</DialogTitle>
                  <DialogDescription>
                    This keeps the modal premium without making the text fight the background.
                  </DialogDescription>
                </DialogHeader>
                <div class="glass-floating-summary">
                  <span class="glass-badge glass-badge-teal">Ready</span>
                  <p class="text-sm">Patient reminder and visit notes are prepared.</p>
                </div>
                <DialogFooter>
                  <Button variant="outline" @click="glassDialogOpen = false">Cancel</Button>
                  <Button @click="glassDialogOpen = false">Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Sheet v-model:open="glassSheetOpen">
              <SheetContent
                :class="[
                  'glass-floating-content glass-sheet-preview',
                  { 'glass-floating-content-dark': isDark },
                ]"
              >
                <SheetHeader>
                  <SheetTitle>Appointment drawer</SheetTitle>
                  <SheetDescription>
                    Drawers can use glass, but the content area still needs quiet structure.
                  </SheetDescription>
                </SheetHeader>
                <div class="mt-5 space-y-3">
                  <div class="glass-mini-card">
                    <span class="glass-badge glass-badge-blue">2:30 PM</span>
                    <strong class="mt-3 block">Ana Mercado</strong>
                    <p>Follow-up consultation</p>
                  </div>
                  <button type="button" class="glass-button glass-button-primary w-full" @click="glassSheetOpen = false">
                    Mark arrived
                  </button>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Popover and Dropdown</h4>
              <p class="text-sm text-muted-foreground">Floating menus need a clearer edge than normal cards.</p>
            </div>
            <div class="flex flex-wrap gap-3">
              <Popover>
                <PopoverTrigger as-child>
                  <button type="button" class="glass-button glass-button-secondary">
                    <Info class="size-4" />
                    Visit info
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  :class="[
                    'glass-floating-content glass-popover-preview',
                    { 'glass-floating-content-dark': isDark },
                  ]"
                >
                  <div class="space-y-2">
                    <h5 class="font-semibold">Glass popover</h5>
                    <p class="text-sm text-muted-foreground">Compact, readable, and not too transparent.</p>
                    <span class="glass-badge glass-badge-blue">18px blur</span>
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <button type="button" class="glass-button glass-button-secondary">
                    Actions
                    <ChevronDown class="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  :class="[
                    'glass-floating-content glass-menu-preview',
                    { 'glass-floating-content-dark': isDark },
                  ]"
                >
                  <DropdownMenuItem>
                    <User class="mr-2 size-4" />
                    Open patient
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Mail class="mr-2 size-4" />
                    Send reminder
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <LogOut class="mr-2 size-4" />
                    Archive visit
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Alerts and Toasts</h4>
              <p class="text-sm text-muted-foreground">Feedback surfaces stay more solid because status should be obvious.</p>
            </div>

            <div class="space-y-5">
              <div>
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h5 class="text-sm font-semibold">Inline Alerts</h5>
                  <span class="glass-chip">persistent feedback</span>
                </div>
                <div class="glass-alert-grid">
                  <div class="glass-alert glass-alert-info">
                    <Info class="size-5" />
                    <div>
                      <strong>Patient profile updated</strong>
                      <p>Use for neutral context, state changes, or helpful system notes.</p>
                      <span class="glass-alert-meta">Info / context</span>
                    </div>
                  </div>
                  <div class="glass-alert glass-alert-success">
                    <CheckCircle2 class="size-5" />
                    <div>
                      <strong>Visit saved</strong>
                      <p>Use when the user action completed and no follow-up is required.</p>
                      <span class="glass-alert-meta">Success / complete</span>
                    </div>
                  </div>
                  <div class="glass-alert glass-alert-warning">
                    <AlertTriangle class="size-5" />
                    <div>
                      <strong>Payment pending</strong>
                      <p>Use for recoverable issues that need attention before moving on.</p>
                      <span class="glass-alert-meta">Warning / attention</span>
                    </div>
                  </div>
                  <div class="glass-alert glass-alert-danger">
                    <AlertTriangle class="size-5" />
                    <div>
                      <strong>Unable to finalize encounter</strong>
                      <p>Use for blocked workflows, destructive outcomes, or failed requests.</p>
                      <span class="glass-alert-meta">Error / blocked</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h5 class="text-sm font-semibold">Compact Form Alerts</h5>
                  <span class="glass-chip">near-field feedback</span>
                </div>
                <div class="space-y-2">
                  <div class="glass-alert-compact glass-alert-info">
                    <Info class="size-4" />
                    <span>Email verification is required before clinic access.</span>
                  </div>
                  <div class="glass-alert-compact glass-alert-danger">
                    <AlertTriangle class="size-4" />
                    <span>Password must contain at least 8 characters.</span>
                  </div>
                </div>
              </div>

              <div>
                <div class="mb-3 flex items-center justify-between gap-3">
                  <h5 class="text-sm font-semibold">Toast Variants</h5>
                  <span class="glass-chip">temporary feedback</span>
                </div>
                <div class="glass-toast-guide">
                  <div class="glass-toast-stack">
                    <div class="glass-toast glass-toast-success">
                      <CheckCircle2 class="size-4" />
                      <span>Invoice created</span>
                    </div>
                    <div class="glass-toast glass-toast-info">
                      <Bell class="size-4" />
                      <span>Reminder queued for 4:00 PM</span>
                    </div>
                    <div class="glass-toast glass-toast-warning">
                      <AlertTriangle class="size-4" />
                      <span>Queue display is reconnecting</span>
                    </div>
                    <div class="glass-toast glass-toast-danger">
                      <AlertTriangle class="size-4" />
                      <span>Failed to download PDF</span>
                    </div>
                    <div class="glass-toast glass-toast-loading">
                      <LoaderCircle class="size-4 animate-spin" />
                      <span>Generating billing report</span>
                    </div>
                  </div>
                  <div class="glass-toast-rules">
                    <div>
                      <strong>Toast</strong>
                      <p>Short-lived confirmation after a completed action.</p>
                    </div>
                    <div>
                      <strong>Inline alert</strong>
                      <p>Persistent message when the user must read or act.</p>
                    </div>
                    <div>
                      <strong>Danger</strong>
                      <p>Reserve red for failure, blocking, or destructive states.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="glass-panel p-5">
            <div class="mb-4">
              <h4 class="font-semibold">Tabs and Empty State</h4>
              <p class="text-sm text-muted-foreground">Navigation can be glassy; empty states need one obvious action.</p>
            </div>
            <Tabs default-value="overview" class="glass-tabs-preview">
              <TabsList class="glass-tabs-list">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="billing">Billing</TabsTrigger>
              </TabsList>
              <TabsContent value="overview" class="glass-empty-state">
                <div class="glass-icon">
                  <CalendarCheck class="size-5" />
                </div>
                <strong>No visits today</strong>
                <p>Schedule a patient or keep the queue clear.</p>
                <button type="button" class="glass-button glass-button-primary">Create visit</button>
              </TabsContent>
              <TabsContent value="history" class="glass-empty-state">
                <div class="glass-icon">
                  <Activity class="size-5" />
                </div>
                <strong>No recent history</strong>
                <p>Completed encounters will appear here.</p>
              </TabsContent>
              <TabsContent value="billing" class="glass-empty-state">
                <div class="glass-icon">
                  <CheckCircle2 class="size-5" />
                </div>
                <strong>Nothing to collect</strong>
                <p>This patient has no open balance.</p>
              </TabsContent>
            </Tabs>
          </div>

          <div class="glass-panel p-5 lg:col-span-2">
            <div class="mb-4">
              <h4 class="font-semibold">Loading and Skeletons</h4>
              <p class="text-sm text-muted-foreground">Skeletons should feel native to glass surfaces, not pasted from another theme.</p>
            </div>
            <div class="grid gap-4 md:grid-cols-3">
              <div class="glass-loading-card">
                <div class="flex items-center gap-3">
                  <Skeleton class="glass-skeleton size-10 rounded-full" />
                  <div class="flex-1 space-y-2">
                    <Skeleton class="glass-skeleton h-3 w-2/3" />
                    <Skeleton class="glass-skeleton h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton class="glass-skeleton mt-5 h-20 w-full rounded-2xl" />
              </div>
              <div class="glass-loading-card">
                <Skeleton class="glass-skeleton h-4 w-1/2" />
                <div class="mt-6 flex items-end gap-2">
                  <Skeleton v-for="height in [46, 64, 38, 72, 56]" :key="height" class="glass-skeleton flex-1 rounded-full" :style="{ height: `${height}px` }" />
                </div>
              </div>
              <div class="glass-loading-card">
                <Skeleton class="glass-skeleton h-8 w-24 rounded-full" />
                <Skeleton class="glass-skeleton mt-4 h-3 w-full" />
                <Skeleton class="glass-skeleton mt-2 h-3 w-5/6" />
                <Skeleton class="glass-skeleton mt-6 h-10 w-full rounded-full" />
              </div>
            </div>
          </div>

          <div class="glass-panel p-5 lg:col-span-2">
            <div class="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h4 class="font-semibold">Motion Recipes</h4>
                <p class="text-sm text-muted-foreground">Interaction-only motion: reveal, hover, press, focus, and route changes.</p>
              </div>
              <span class="glass-chip">no passive wobble</span>
            </div>

            <div class="grid gap-4 md:grid-cols-3">
              <button type="button" class="glass-motion-card glass-motion-hover">
                <span class="glass-badge glass-badge-blue">Hover</span>
                <strong>Lift and clarify</strong>
                <p>Card moves 2px, border brightens, shadow deepens.</p>
              </button>

              <button type="button" class="glass-motion-card glass-motion-press">
                <span class="glass-badge glass-badge-teal">Click</span>
                <strong>Press response</strong>
                <p>Action compresses slightly so taps feel deliberate.</p>
              </button>

              <button type="button" class="glass-motion-card glass-motion-focus">
                <span class="glass-badge glass-badge-amber">Focus</span>
                <strong>Accessible bloom</strong>
                <p>Keyboard focus gets a soft glass ring.</p>
              </button>
            </div>

            <div class="mt-5 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <div class="glass-motion-panel">
                <div class="glass-motion-modal-sample">
                  <span class="glass-badge glass-badge-blue">Reveal</span>
                  <strong>Modal entrance</strong>
                  <p>Fade, blur settle, tiny scale. No bouncing circus act.</p>
                  <div class="mt-4 flex gap-2">
                    <span class="glass-motion-dot" />
                    <span class="glass-motion-dot" />
                    <span class="glass-motion-dot" />
                  </div>
                </div>
              </div>

              <div class="glass-motion-panel">
                <div class="glass-motion-timeline">
                  <div class="glass-motion-timeline-item">
                    <span />
                    <div>
                      <strong>Route changed</strong>
                      <p>New content reveals in sequence.</p>
                    </div>
                  </div>
                  <div class="glass-motion-timeline-item">
                    <span />
                    <div>
                      <strong>Visit updated</strong>
                      <p>Fresh row slides into place.</p>
                    </div>
                  </div>
                  <div class="glass-motion-timeline-item">
                    <span />
                    <div>
                      <strong>Status advanced</strong>
                      <p>Connector sweep confirms progress.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Buttons -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Buttons</h2>
      <Separator />

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Variants</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Sizes</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon"><Heart class="size-4" /></Button>
          <Button size="icon-sm"><Heart class="size-4" /></Button>
          <Button size="icon-lg"><Heart class="size-4" /></Button>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">With Icons</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Button><Plus class="size-4" /> Create</Button>
          <Button variant="outline"><Search class="size-4" /> Search</Button>
          <Button variant="destructive"><Trash2 class="size-4" /> Delete</Button>
          <Button variant="secondary"><Mail class="size-4" /> Send Email</Button>
          <Button variant="ghost"><Settings class="size-4" /> Settings</Button>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">States</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Button disabled>Disabled</Button>
          <Button disabled variant="outline">Disabled Outline</Button>
          <Button>
            <LoaderCircle class="size-4 animate-spin" />
            Loading...
          </Button>
        </div>
      </div>
    </section>

    <!-- Badges -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Badges</h2>
      <Separator />

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Variants</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Badge>Default</Badge>
          <Badge variant="secondary">Secondary</Badge>
          <Badge variant="destructive">Destructive</Badge>
          <Badge variant="outline">Outline</Badge>
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Patient Status Badges</h3>
        <div class="flex flex-wrap items-center gap-3">
          <PatientStatusBadge status="new" />
          <PatientStatusBadge status="active" />
          <PatientStatusBadge status="inactive" />
          <PatientStatusBadge status="returning" />
        </div>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Custom Colors (outline variant)</h3>
        <div class="flex flex-wrap items-center gap-3">
          <Badge variant="outline" class="border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-700 dark:bg-blue-950 dark:text-blue-400">Blue</Badge>
          <Badge variant="outline" class="border-green-300 bg-green-100 text-green-700 dark:border-green-700 dark:bg-green-950 dark:text-green-400">Green</Badge>
          <Badge variant="outline" class="border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400">Amber</Badge>
          <Badge variant="outline" class="border-red-300 bg-red-100 text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-400">Red</Badge>
          <Badge variant="outline" class="border-purple-300 bg-purple-100 text-purple-700 dark:border-purple-700 dark:bg-purple-950 dark:text-purple-400">Purple</Badge>
        </div>
      </div>
    </section>

    <!-- Inputs -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Inputs</h2>
      <Separator />

      <div class="grid max-w-md gap-4">
        <div class="space-y-2">
          <Label for="demo-input">Text Input</Label>
          <Input id="demo-input" v-model="inputVal" placeholder="Type something..." />
        </div>

        <div class="space-y-2">
          <Label>Input with Icon</Label>
          <div class="relative">
            <Search class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search..." class="pl-8" />
          </div>
        </div>

        <div class="space-y-2">
          <Label>Disabled Input</Label>
          <Input placeholder="Can't type here" disabled />
        </div>

        <div class="space-y-2">
          <Label for="demo-textarea">Textarea</Label>
          <Textarea id="demo-textarea" v-model="textareaVal" placeholder="Write something longer..." rows="3" />
        </div>
      </div>
    </section>

    <!-- Select, Checkbox, Slider -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Form Controls</h2>
      <Separator />

      <div class="grid max-w-md gap-4">
        <div class="space-y-2">
          <Label>Select</Label>
          <Select v-model="selectVal">
            <SelectTrigger>
              <SelectValue placeholder="Choose an option" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="option1">Option 1</SelectItem>
              <SelectItem value="option2">Option 2</SelectItem>
              <SelectItem value="option3">Option 3</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex items-center gap-2">
          <Checkbox id="demo-check" :checked="checkboxVal" @update:checked="(v: boolean) => checkboxVal = v" />
          <Label for="demo-check">Accept terms and conditions</Label>
        </div>

        <div class="space-y-2">
          <Label>Slider ({{ sliderVal[0] }})</Label>
          <Slider v-model="sliderVal" :max="100" :step="1" />
        </div>
      </div>
    </section>

    <!-- Cards -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Cards</h2>
      <Separator />

      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Basic Card</CardTitle>
            <CardDescription>A simple card with header and content.</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">Some content goes here.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Card with Footer</CardTitle>
            <CardDescription>This card has action buttons.</CardDescription>
          </CardHeader>
          <CardContent>
            <p class="text-sm text-muted-foreground">Content area.</p>
          </CardContent>
          <CardFooter class="gap-2">
            <Button variant="outline" size="sm">Cancel</Button>
            <Button size="sm">Save</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Stat Card</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-3xl font-bold">2,847</p>
            <p class="text-xs text-muted-foreground">Total patients this month</p>
          </CardContent>
        </Card>
      </div>
    </section>

    <!-- Table -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Table</h2>
      <Separator />

      <div class="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="i in 4" :key="i">
              <TableCell class="font-medium">User {{ i }}</TableCell>
              <TableCell>user{{ i }}@example.com</TableCell>
              <TableCell>
                <Badge variant="secondary">{{ ['Admin', 'Doctor', 'Staff', 'Secretary'][i - 1] }}</Badge>
              </TableCell>
              <TableCell class="text-right">
                <Button variant="ghost" size="icon-sm"><MoreHorizontal class="size-4" /></Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </section>

    <!-- Pagination -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Pagination</h2>
      <Separator />

      <Pagination :total="100" :items-per-page="10" :page="3" :sibling-count="1" :show-edges="true">
        <PaginationContent v-slot="{ items }">
          <PaginationPrevious />
          <template v-for="(item, index) in items" :key="item.type === 'page' ? item.value : `e-${index}`">
            <PaginationItem v-if="item.type === 'page'" :value="item.value" :is-active="item.value === 3">
              {{ item.value }}
            </PaginationItem>
            <PaginationEllipsis v-else :index="index" />
          </template>
          <PaginationNext />
        </PaginationContent>
      </Pagination>
    </section>

    <!-- Tabs -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Tabs</h2>
      <Separator />

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Small</h3>
        <Tabs default-value="tab1" size="sm" class="max-w-md">
          <TabsList>
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" class="rounded-md border p-4 text-sm">Account settings content.</TabsContent>
          <TabsContent value="tab2" class="rounded-md border p-4 text-sm">Password settings content.</TabsContent>
          <TabsContent value="tab3" class="rounded-md border p-4 text-sm">General settings content.</TabsContent>
        </Tabs>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Default</h3>
        <Tabs default-value="tab1" class="max-w-md">
          <TabsList>
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" class="rounded-md border p-4 text-sm">Account settings content.</TabsContent>
          <TabsContent value="tab2" class="rounded-md border p-4 text-sm">Password settings content.</TabsContent>
          <TabsContent value="tab3" class="rounded-md border p-4 text-sm">General settings content.</TabsContent>
        </Tabs>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">Large</h3>
        <Tabs default-value="tab1" size="lg" class="max-w-md">
          <TabsList>
            <TabsTrigger value="tab1">Account</TabsTrigger>
            <TabsTrigger value="tab2">Password</TabsTrigger>
            <TabsTrigger value="tab3">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1" class="rounded-md border p-4 text-sm">Account settings content.</TabsContent>
          <TabsContent value="tab2" class="rounded-md border p-4 text-sm">Password settings content.</TabsContent>
          <TabsContent value="tab3" class="rounded-md border p-4 text-sm">General settings content.</TabsContent>
        </Tabs>
      </div>
    </section>

    <!-- Dialog -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Dialog</h2>
      <Separator />

      <Button @click="dialogOpen = true">Open Dialog</Button>
      <Dialog :open="dialogOpen" @update:open="dialogOpen = $event">
        <DialogContent class="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dialog Title</DialogTitle>
            <DialogDescription>This is a description of the dialog content.</DialogDescription>
          </DialogHeader>
          <div class="py-4">
            <p class="text-sm text-muted-foreground">Dialog body content goes here.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" @click="dialogOpen = false">Cancel</Button>
            <Button @click="dialogOpen = false">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>

    <!-- Tooltip, Popover, Dropdown -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Overlays</h2>
      <Separator />

      <div class="flex flex-wrap items-center gap-4">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger as-child>
              <Button variant="outline">Hover for Tooltip</Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>This is a tooltip</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline">Open Popover</Button>
          </PopoverTrigger>
          <PopoverContent class="w-64">
            <div class="space-y-2">
              <h4 class="text-sm font-medium">Popover Content</h4>
              <p class="text-sm text-muted-foreground">This is a popover with some content inside.</p>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button variant="outline">
              Dropdown
              <ChevronDown class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem><User class="size-4" /> Profile</DropdownMenuItem>
            <DropdownMenuItem><Settings class="size-4" /> Settings</DropdownMenuItem>
            <DropdownMenuItem><Bell class="size-4" /> Notifications</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem><Copy class="size-4" /> Copy</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem class="text-destructive"><LogOut class="size-4" /> Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Sheet>
          <SheetTrigger as-child>
            <Button variant="outline"><PanelRight class="size-4" /> Sheet</Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
              <SheetDescription>This is a side panel sheet component.</SheetDescription>
            </SheetHeader>
            <div class="py-4 text-sm text-muted-foreground">Sheet body content.</div>
          </SheetContent>
        </Sheet>
      </div>
    </section>

    <!-- Avatar -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Avatar</h2>
      <Separator />

      <div class="flex items-center gap-4">
        <Avatar>
          <AvatarImage src="https://github.com/shadcn.png" alt="User" />
          <AvatarFallback>SC</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
        <Avatar>
          <AvatarFallback class="bg-primary/10 text-primary">AB</AvatarFallback>
        </Avatar>
        <Avatar class="size-12">
          <AvatarFallback class="text-lg">XL</AvatarFallback>
        </Avatar>
        <Avatar class="size-6">
          <AvatarFallback class="text-[10px]">SM</AvatarFallback>
        </Avatar>
      </div>
    </section>

    <!-- Skeleton -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Skeleton</h2>
      <Separator />

      <div class="flex items-center gap-4">
        <Skeleton class="size-12 rounded-full" />
        <div class="space-y-2">
          <Skeleton class="h-4 w-48" />
          <Skeleton class="h-4 w-32" />
        </div>
      </div>
      <div class="space-y-2">
        <Skeleton class="h-4 w-full" />
        <Skeleton class="h-4 w-3/4" />
        <Skeleton class="h-4 w-1/2" />
      </div>
    </section>

    <!-- Separator -->
    <section class="space-y-4">
      <h2 class="text-lg font-semibold">Separator</h2>
      <Separator />

      <div class="space-y-4">
        <div>
          <p class="text-sm">Horizontal separator above and below.</p>
          <Separator class="my-2" />
          <p class="text-sm text-muted-foreground">Content below separator.</p>
        </div>

        <div class="flex h-8 items-center gap-4">
          <span class="text-sm">Item 1</span>
          <Separator orientation="vertical" />
          <span class="text-sm">Item 2</span>
          <Separator orientation="vertical" />
          <span class="text-sm">Item 3</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.glass-lab {
  position: relative;
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.16), transparent 32%),
    linear-gradient(215deg, rgba(20, 184, 166, 0.14), transparent 36%),
    linear-gradient(180deg, rgba(248, 250, 252, 0.86), rgba(226, 232, 240, 0.72));
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.08);
}

.glass-lab::before {
  content: '';
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(rgba(255, 255, 255, 0.32) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.22) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(to bottom, rgba(0, 0, 0, 0.7), transparent 72%);
}

.glass-lab > * {
  position: relative;
}

.glass-panel,
.glass-card {
  background: rgba(255, 255, 255, 0.68);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.glass-panel {
  border-radius: 22px;
}

.glass-card {
  min-height: 160px;
  border-radius: 20px;
  padding: 1.25rem;
}

.glass-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.75rem;
  border-radius: 9999px;
  padding: 0 0.75rem;
  background: rgba(255, 255, 255, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.48);
  font-size: 0.75rem;
  font-weight: 500;
  color: rgb(71, 85, 105);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.glass-icon {
  display: inline-flex;
  width: 2.75rem;
  height: 2.75rem;
  align-items: center;
  justify-content: center;
  border-radius: 1rem;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.5);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.08);
  color: rgb(37, 99, 235);
}

.glass-nav-item,
.glass-nav-active {
  display: flex;
  min-height: 2.75rem;
  align-items: center;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 0 0.9rem;
  font-size: 0.95rem;
}

.glass-nav-item {
  color: rgb(71, 85, 105);
}

.glass-nav-active {
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.54);
  box-shadow: 0 14px 32px rgba(37, 99, 235, 0.12);
  color: rgb(37, 99, 235);
  font-weight: 600;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-chart {
  display: flex;
  height: 14rem;
  align-items: end;
  gap: 0.75rem;
  border-radius: 1.25rem;
  padding: 1rem;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.4);
}

.glass-chart > div {
  flex: 1;
  min-height: 18%;
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.7), rgba(20, 184, 166, 0.52));
}

.glass-swatch,
.glass-opacity-card,
.glass-recipe-row {
  min-height: 6.5rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.glass-swatch {
  display: flex;
  align-items: end;
  padding: 0.85rem;
  overflow: hidden;
}

.glass-swatch span {
  border-radius: 9999px;
  padding: 0.35rem 0.65rem;
  background: rgba(255, 255, 255, 0.64);
  font-size: 0.75rem;
  font-weight: 600;
  color: rgb(51, 65, 85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.glass-bg-clinic {
  background:
    radial-gradient(circle at 22% 20%, rgba(20, 184, 166, 0.3), transparent 34%),
    linear-gradient(135deg, rgb(241, 245, 249), rgb(219, 234, 254));
}

.glass-bg-blue {
  background:
    radial-gradient(circle at 78% 18%, rgba(59, 130, 246, 0.36), transparent 34%),
    linear-gradient(135deg, rgb(239, 246, 255), rgb(207, 250, 254));
}

.glass-bg-aurora {
  background:
    radial-gradient(circle at 15% 25%, rgba(34, 197, 94, 0.28), transparent 28%),
    radial-gradient(circle at 85% 18%, rgba(59, 130, 246, 0.32), transparent 32%),
    radial-gradient(circle at 60% 88%, rgba(236, 72, 153, 0.18), transparent 34%),
    rgb(248, 250, 252);
}

.glass-opacity-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 1rem;
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.18), transparent),
    repeating-linear-gradient(45deg, rgba(15, 23, 42, 0.06) 0 8px, transparent 8px 16px);
}

.glass-opacity-card span {
  font-size: 0.8rem;
  color: rgb(71, 85, 105);
}

.glass-opacity-card strong {
  font-size: 1.5rem;
}

.glass-opacity-light {
  background-color: rgba(255, 255, 255, 0.52);
}

.glass-opacity-balanced {
  background-color: rgba(255, 255, 255, 0.68);
}

.glass-opacity-solid {
  background-color: rgba(255, 255, 255, 0.82);
}

.glass-recipe-row {
  display: flex;
  min-height: 3.5rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0 1rem;
  background: rgba(255, 255, 255, 0.62);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-recipe-row code {
  border-radius: 9999px;
  padding: 0.25rem 0.55rem;
  background: rgba(15, 23, 42, 0.08);
  font-size: 0.75rem;
}

.glass-border-soft {
  border-color: rgba(255, 255, 255, 0.45);
}

.glass-shadow-soft {
  box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
}

.glass-shadow-deep {
  box-shadow: 0 24px 70px rgba(15, 23, 42, 0.12);
}

.glass-nav-solid {
  background: rgb(37, 99, 235);
  border-color: rgb(37, 99, 235);
  color: white;
  box-shadow: 0 14px 34px rgba(37, 99, 235, 0.24);
}

.glass-nav-minimal {
  background: rgba(37, 99, 235, 0.08);
  border-color: rgba(37, 99, 235, 0.14);
  box-shadow: none;
}

.glass-button {
  display: inline-flex;
  min-height: 2.5rem;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.46);
  padding: 0 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
  transition: transform 120ms ease, box-shadow 120ms ease, background 120ms ease;
}

.glass-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 16px 34px rgba(15, 23, 42, 0.12);
}

.glass-button-primary {
  background: linear-gradient(135deg, rgb(37, 99, 235), rgb(20, 184, 166));
  color: white;
}

.glass-button-secondary {
  background: rgba(255, 255, 255, 0.66);
  color: rgb(30, 41, 59);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-button-quiet {
  background: rgba(15, 23, 42, 0.06);
  color: rgb(51, 65, 85);
  box-shadow: none;
}

.glass-button-success {
  background: rgba(16, 185, 129, 0.16);
  color: rgb(4, 120, 87);
}

.glass-button-warning {
  background: rgba(245, 158, 11, 0.18);
  color: rgb(146, 64, 14);
}

.glass-button-danger {
  background: rgba(244, 63, 94, 0.14);
  color: rgb(190, 18, 60);
}

.glass-avatar {
  width: 3rem;
  height: 3rem;
  border: 1px solid rgba(255, 255, 255, 0.54);
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.18), rgba(255, 255, 255, 0.66));
  color: rgb(30, 64, 175);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.1);
}

.glass-avatar-sm {
  width: 2rem;
  height: 2rem;
  border: 1px solid rgba(255, 255, 255, 0.5);
  background: rgba(255, 255, 255, 0.62);
  color: rgb(30, 64, 175);
}

.glass-avatar-teal {
  background: linear-gradient(135deg, rgba(20, 184, 166, 0.22), rgba(255, 255, 255, 0.66));
  color: rgb(15, 118, 110);
}

.glass-avatar-amber {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.24), rgba(255, 255, 255, 0.66));
  color: rgb(146, 64, 14);
}

.glass-badge {
  display: inline-flex;
  min-height: 1.6rem;
  align-items: center;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.48);
  padding: 0 0.65rem;
  font-size: 0.75rem;
  font-weight: 700;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.glass-badge-blue {
  background: rgba(37, 99, 235, 0.12);
  color: rgb(29, 78, 216);
}

.glass-badge-teal {
  background: rgba(20, 184, 166, 0.14);
  color: rgb(13, 148, 136);
}

.glass-badge-amber {
  background: rgba(245, 158, 11, 0.16);
  color: rgb(146, 64, 14);
}

.glass-badge-rose {
  background: rgba(244, 63, 94, 0.12);
  color: rgb(190, 18, 60);
}

.glass-badge-neutral {
  background: rgba(100, 116, 139, 0.12);
  color: rgb(71, 85, 105);
}

.glass-field {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.74);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.07);
}

.glass-control-row {
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.glass-checkbox {
  border-color: rgba(37, 99, 235, 0.32);
  background: rgba(255, 255, 255, 0.72);
}

.glass-segment {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-height: 2.5rem;
  gap: 0.25rem;
  border-radius: 0.9rem;
  padding: 0.25rem;
  background: rgba(15, 23, 42, 0.07);
}

.glass-segment button {
  border-radius: 0.7rem;
  font-size: 0.8rem;
  font-weight: 700;
  color: rgb(71, 85, 105);
}

.glass-segment button.is-active {
  background: rgba(255, 255, 255, 0.74);
  color: rgb(37, 99, 235);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.08);
}

.glass-toggle {
  width: 3.1rem;
  height: 1.7rem;
  border-radius: 9999px;
  padding: 0.2rem;
  background: rgba(37, 99, 235, 0.18);
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.glass-toggle span {
  display: block;
  width: 1.25rem;
  height: 1.25rem;
  margin-left: auto;
  border-radius: 9999px;
  background: rgb(37, 99, 235);
  box-shadow: 0 8px 18px rgba(37, 99, 235, 0.22);
}

.glass-mini-card {
  min-height: 8rem;
  border-radius: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.48);
  padding: 1rem;
  background:
    linear-gradient(135deg, rgba(20, 184, 166, 0.1), transparent),
    rgba(255, 255, 255, 0.54);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-mini-card-blue {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.12), transparent),
    rgba(255, 255, 255, 0.54);
}

.glass-mini-card-amber {
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.16), transparent),
    rgba(255, 255, 255, 0.54);
}

.glass-mini-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
}

.glass-mini-card strong {
  display: block;
  font-size: 1.35rem;
}

.glass-mini-card p {
  margin-top: 0.2rem;
  font-size: 0.85rem;
  color: rgb(71, 85, 105);
}

.glass-table-wrap {
  overflow: hidden;
  border-radius: 1.15rem;
  border: 1px solid rgba(255, 255, 255, 0.44);
  background: rgba(255, 255, 255, 0.44);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.glass-table {
  width: 100%;
  min-width: 42rem;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.glass-table th,
.glass-table td {
  padding: 0.9rem 1rem;
}

.glass-table th {
  background: rgba(255, 255, 255, 0.48);
  color: rgb(71, 85, 105);
  font-weight: 700;
  text-align: left;
}

.glass-table td {
  border-top: 1px solid rgba(255, 255, 255, 0.38);
}

.glass-table-person {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-weight: 700;
}

.glass-timeline-card {
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  padding: 1rem;
  background: rgba(255, 255, 255, 0.46);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-timeline {
  position: relative;
  display: grid;
  gap: 1rem;
}

.glass-timeline::before {
  content: '';
  position: absolute;
  top: 1.25rem;
  bottom: 1.25rem;
  left: 1.18rem;
  width: 2px;
  border-radius: 9999px;
  background: linear-gradient(180deg, rgba(37, 99, 235, 0.38), rgba(20, 184, 166, 0.26), rgba(245, 158, 11, 0.26));
}

.glass-timeline-item {
  position: relative;
  display: grid;
  grid-template-columns: 2.5rem 1fr;
  gap: 0.85rem;
}

.glass-timeline-marker {
  position: relative;
  z-index: 1;
  display: inline-flex;
  width: 2.4rem;
  height: 2.4rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  background: rgba(255, 255, 255, 0.7);
  box-shadow: 0 10px 26px rgba(15, 23, 42, 0.1);
  color: rgb(37, 99, 235);
}

.glass-timeline-item.is-complete .glass-timeline-marker {
  color: rgb(13, 148, 136);
}

.glass-timeline-item.is-active .glass-timeline-marker {
  background: linear-gradient(135deg, rgb(37, 99, 235), rgb(20, 184, 166));
  color: white;
}

.glass-timeline-item.is-warning .glass-timeline-marker {
  color: rgb(217, 119, 6);
}

.glass-timeline-content {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.48);
}

.glass-timeline-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}

.glass-timeline-head span,
.glass-timeline-content p,
.glass-feed-item p {
  font-size: 0.8rem;
  color: rgb(71, 85, 105);
}

.glass-timeline-content p {
  margin-top: 0.25rem;
}

.glass-feed-item {
  display: flex;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  padding: 0.8rem;
  background: rgba(255, 255, 255, 0.48);
  color: rgb(37, 99, 235);
}

.glass-feed-item strong {
  display: block;
  color: rgb(30, 41, 59);
}

.glass-stepper {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.5rem;
}

.glass-step {
  position: relative;
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  padding: 0.8rem 0.45rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.42);
}

.glass-step span {
  display: inline-flex;
  width: 1.85rem;
  height: 1.85rem;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: rgba(15, 23, 42, 0.08);
  color: rgb(71, 85, 105);
  font-size: 0.75rem;
  font-weight: 800;
}

.glass-step strong {
  font-size: 0.78rem;
}

.glass-step.is-done span {
  background: rgba(20, 184, 166, 0.18);
  color: rgb(13, 148, 136);
}

.glass-step.is-current {
  background: rgba(37, 99, 235, 0.12);
}

.glass-step.is-current span {
  background: rgb(37, 99, 235);
  color: white;
}

:global(.glass-floating-content) {
  border: 1px solid rgba(255, 255, 255, 0.58);
  background: rgba(248, 250, 252, 0.82) !important;
  box-shadow: 0 28px 80px rgba(15, 23, 42, 0.18) !important;
  backdrop-filter: blur(24px) saturate(145%);
  -webkit-backdrop-filter: blur(24px) saturate(145%);
}

:global(.glass-floating-content .text-muted-foreground) {
  color: rgb(100, 116, 139);
}

:global(.glass-dialog-preview) {
  border-radius: 1.35rem;
}

:global(.glass-sheet-preview) {
  border-left-color: rgba(255, 255, 255, 0.58) !important;
}

:global(.glass-popover-preview),
:global(.glass-menu-preview) {
  border-radius: 1rem;
  background: rgba(248, 250, 252, 0.86) !important;
}

:global(.glass-menu-preview [role='menuitem']) {
  border-radius: 0.75rem;
}

:global([data-slot='dialog-overlay']) {
  background: rgba(15, 23, 42, 0.32) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}

.glass-floating-summary {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  border-radius: 1rem;
  padding: 0.9rem;
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.42);
}

.glass-alert-grid {
  display: grid;
  gap: 0.75rem;
}

.glass-alert {
  display: flex;
  gap: 0.85rem;
  border-radius: 1.1rem;
  border: 1px solid rgba(255, 255, 255, 0.48);
  padding: 1rem;
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.glass-alert > svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}

.glass-alert strong {
  display: block;
  font-size: 0.95rem;
}

.glass-alert p {
  margin-top: 0.15rem;
  font-size: 0.85rem;
  color: rgb(71, 85, 105);
}

.glass-alert-meta {
  display: inline-flex;
  margin-top: 0.65rem;
  border-radius: 9999px;
  padding: 0.18rem 0.55rem;
  background: rgba(255, 255, 255, 0.45);
  color: currentColor;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.glass-alert-compact {
  display: flex;
  min-height: 2.5rem;
  align-items: center;
  gap: 0.65rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  padding: 0.65rem 0.8rem;
  font-size: 0.82rem;
  font-weight: 700;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.06);
}

.glass-alert-info {
  background: var(--feedback-info-bg);
  color: var(--feedback-info-fg);
}

.glass-alert-success {
  background: var(--feedback-success-bg);
  color: var(--feedback-success-fg);
}

.glass-alert-warning {
  background: var(--feedback-warning-bg);
  color: var(--feedback-warning-fg);
}

.glass-alert-danger {
  background: var(--feedback-danger-bg);
  color: var(--feedback-danger-fg);
}

.glass-toast-guide {
  display: grid;
  gap: 1rem;
}

.glass-toast-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.glass-toast {
  display: inline-flex;
  min-height: 2.6rem;
  align-items: center;
  gap: 0.65rem;
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.52);
  padding: 0 1rem;
  background: rgba(255, 255, 255, 0.72);
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
  color: rgb(30, 41, 59);
  font-size: 0.875rem;
  font-weight: 700;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.glass-toast-success {
  color: var(--feedback-success-fg);
}

.glass-toast-info {
  color: var(--feedback-info-fg);
}

.glass-toast-warning {
  color: var(--feedback-warning-fg);
}

.glass-toast-danger {
  color: var(--feedback-danger-fg);
}

.glass-toast-loading {
  color: var(--feedback-loading-fg);
}

.glass-toast-rules {
  display: grid;
  gap: 0.75rem;
}

.glass-toast-rules > div {
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.38);
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
}

.glass-toast-rules strong {
  display: block;
  font-size: 0.84rem;
}

.glass-toast-rules p {
  margin-top: 0.2rem;
  color: rgb(71, 85, 105);
  font-size: 0.78rem;
  line-height: 1.45;
}

.glass-tabs-preview {
  width: 100%;
}

.glass-tabs-list {
  background: rgba(255, 255, 255, 0.48);
  border: 1px solid rgba(255, 255, 255, 0.46);
  box-shadow: 0 12px 28px rgba(15, 23, 42, 0.08);
}

.glass-empty-state {
  display: flex;
  min-height: 15rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  padding: 1.5rem;
  text-align: center;
  background: rgba(255, 255, 255, 0.44);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.glass-empty-state p {
  max-width: 18rem;
  font-size: 0.875rem;
  color: rgb(71, 85, 105);
}

.glass-loading-card {
  min-height: 12rem;
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  padding: 1rem;
  background: rgba(255, 255, 255, 0.44);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
}

.glass-skeleton {
  border: 1px solid rgba(255, 255, 255, 0.36);
  background:
    linear-gradient(90deg, rgba(148, 163, 184, 0.18), rgba(255, 255, 255, 0.68), rgba(96, 165, 250, 0.18)),
    rgba(226, 232, 240, 0.46);
  background-size: 200% 100%;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    0 10px 24px rgba(15, 23, 42, 0.06);
}

.glass-motion-card,
.glass-motion-panel {
  border-radius: 1.2rem;
  border: 1px solid rgba(255, 255, 255, 0.46);
  background: rgba(255, 255, 255, 0.46);
  box-shadow: 0 14px 34px rgba(15, 23, 42, 0.08);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
}

.glass-motion-card {
  min-height: 10rem;
  padding: 1rem;
  text-align: left;
  transition:
    transform 160ms ease,
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.glass-motion-card strong {
  display: block;
  margin-top: 1.3rem;
  font-size: 1rem;
}

.glass-motion-card p,
.glass-motion-modal-sample p,
.glass-motion-timeline-item p {
  margin-top: 0.3rem;
  font-size: 0.84rem;
  color: rgb(71, 85, 105);
}

.glass-motion-hover:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.72);
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 20px 46px rgba(37, 99, 235, 0.13);
}

.glass-motion-press:active {
  transform: translateY(1px) scale(0.985);
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
}

.glass-motion-focus:focus-visible {
  outline: none;
  border-color: rgba(37, 99, 235, 0.42);
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, 0.14),
    0 18px 40px rgba(37, 99, 235, 0.12);
}

.glass-motion-panel {
  min-height: 15rem;
  padding: 1rem;
}

.glass-motion-modal-sample {
  max-width: 20rem;
  border-radius: 1.25rem;
  border: 1px solid rgba(255, 255, 255, 0.52);
  padding: 1rem;
  background: rgba(255, 255, 255, 0.58);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.1);
  animation: glass-reveal 520ms ease both;
}

.glass-motion-modal-sample strong {
  display: block;
  margin-top: 1rem;
}

.glass-motion-dot {
  width: 0.6rem;
  height: 0.6rem;
  border-radius: 9999px;
  background: rgb(37, 99, 235);
}

.glass-motion-timeline {
  display: grid;
  gap: 0.85rem;
}

.glass-motion-timeline-item {
  display: grid;
  grid-template-columns: 1rem 1fr;
  gap: 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  padding: 0.85rem;
  background: rgba(255, 255, 255, 0.48);
  animation: glass-item-reveal 460ms ease both;
}

.glass-motion-timeline-item:nth-child(2) {
  animation-delay: 80ms;
}

.glass-motion-timeline-item:nth-child(3) {
  animation-delay: 160ms;
}

.glass-motion-timeline-item > span {
  width: 0.75rem;
  height: 0.75rem;
  margin-top: 0.3rem;
  border-radius: 9999px;
  background: linear-gradient(135deg, rgb(37, 99, 235), rgb(20, 184, 166));
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
}

@keyframes glass-reveal {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.985);
    filter: blur(6px);
  }

  to {
    opacity: 1;
    transform: translateY(0) scale(1);
    filter: blur(0);
  }
}

@keyframes glass-item-reveal {
  from {
    opacity: 0;
    transform: translateX(-8px);
  }

  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .glass-button,
  .glass-motion-card,
  .glass-motion-modal-sample,
  .glass-motion-timeline-item {
    animation: none;
    transition: none;
  }

  .glass-button:hover,
  .glass-motion-hover:hover,
  .glass-motion-press:active {
    transform: none;
  }
}

.glass-lab-dark {
  color: rgb(226, 232, 240);
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.18), transparent 32%),
    linear-gradient(215deg, rgba(20, 184, 166, 0.14), transparent 36%),
    radial-gradient(circle at 82% 10%, rgba(99, 102, 241, 0.16), transparent 28%),
    linear-gradient(180deg, rgba(15, 23, 42, 0.94), rgba(2, 6, 23, 0.9));
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.32);
}

.glass-lab-dark .glass-panel,
.glass-lab-dark .glass-card {
  background: rgba(15, 23, 42, 0.56);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 18px 45px rgba(0, 0, 0, 0.28);
}

.glass-lab-dark .glass-chip,
.glass-lab-dark .glass-icon,
.glass-lab-dark .glass-nav-active,
.glass-lab-dark .glass-chart {
  background: rgba(30, 41, 59, 0.54);
  border-color: rgba(255, 255, 255, 0.1);
}

.glass-lab-dark .glass-chip,
.glass-lab-dark .glass-nav-item {
  color: rgb(203, 213, 225);
}

.glass-lab-dark .glass-nav-active {
  color: rgb(147, 197, 253);
  box-shadow: 0 14px 32px rgba(59, 130, 246, 0.18);
}

.glass-lab-dark .glass-icon {
  color: rgb(147, 197, 253);
}

.glass-lab-dark :deep(.text-muted-foreground) {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-swatch span,
.glass-lab-dark .glass-opacity-card span {
  color: rgb(226, 232, 240);
}

.glass-lab-dark .glass-swatch {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.26);
}

.glass-lab-dark .glass-swatch span {
  background: rgba(15, 23, 42, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-lab-dark .glass-bg-clinic {
  background:
    radial-gradient(circle at 22% 20%, rgba(45, 212, 191, 0.24), transparent 36%),
    radial-gradient(circle at 84% 82%, rgba(37, 99, 235, 0.2), transparent 34%),
    linear-gradient(135deg, rgb(15, 23, 42), rgb(30, 41, 59));
}

.glass-lab-dark .glass-bg-blue {
  background:
    radial-gradient(circle at 78% 18%, rgba(96, 165, 250, 0.34), transparent 36%),
    radial-gradient(circle at 18% 86%, rgba(14, 165, 233, 0.2), transparent 34%),
    linear-gradient(135deg, rgb(8, 13, 28), rgb(23, 37, 84));
}

.glass-lab-dark .glass-bg-aurora {
  background:
    radial-gradient(circle at 15% 25%, rgba(34, 197, 94, 0.22), transparent 30%),
    radial-gradient(circle at 85% 18%, rgba(96, 165, 250, 0.28), transparent 34%),
    radial-gradient(circle at 60% 88%, rgba(236, 72, 153, 0.2), transparent 36%),
    rgb(15, 23, 42);
}

.glass-lab-dark .glass-opacity-card,
.glass-lab-dark .glass-recipe-row {
  border-color: rgba(255, 255, 255, 0.1);
  background-color: rgba(30, 41, 59, 0.58);
}

.glass-lab-dark .glass-opacity-light {
  background-color: rgba(15, 23, 42, 0.44);
}

.glass-lab-dark .glass-opacity-balanced {
  background-color: rgba(15, 23, 42, 0.62);
}

.glass-lab-dark .glass-opacity-solid {
  background-color: rgba(15, 23, 42, 0.78);
}

.glass-lab-dark .glass-recipe-row code {
  background: rgba(255, 255, 255, 0.1);
}

.glass-lab-dark .glass-nav-solid {
  background: rgb(37, 99, 235);
  border-color: rgb(59, 130, 246);
  color: white;
}

.glass-lab-dark .glass-nav-minimal {
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(147, 197, 253, 0.14);
}

.glass-lab-dark .glass-button {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-button:hover {
  box-shadow: 0 18px 42px rgba(0, 0, 0, 0.3);
}

.glass-lab-dark .glass-button-secondary {
  background: rgba(30, 41, 59, 0.72);
  color: rgb(226, 232, 240);
}

.glass-lab-dark .glass-button-quiet {
  background: rgba(148, 163, 184, 0.1);
  color: rgb(203, 213, 225);
}

.glass-lab-dark .glass-button-success {
  background: rgba(20, 184, 166, 0.16);
  color: rgb(94, 234, 212);
}

.glass-lab-dark .glass-button-warning {
  background: rgba(245, 158, 11, 0.16);
  color: rgb(251, 191, 36);
}

.glass-lab-dark .glass-button-danger {
  background: rgba(244, 63, 94, 0.15);
  color: rgb(251, 113, 133);
}

.glass-lab-dark .glass-avatar,
.glass-lab-dark .glass-avatar-sm {
  border-color: rgba(255, 255, 255, 0.1);
  background: linear-gradient(135deg, rgba(96, 165, 250, 0.2), rgba(30, 41, 59, 0.74));
  color: rgb(191, 219, 254);
}

.glass-lab-dark .glass-avatar-teal {
  background: linear-gradient(135deg, rgba(45, 212, 191, 0.18), rgba(30, 41, 59, 0.74));
  color: rgb(153, 246, 228);
}

.glass-lab-dark .glass-avatar-amber {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(30, 41, 59, 0.74));
  color: rgb(253, 230, 138);
}

.glass-lab-dark .glass-badge {
  border-color: rgba(255, 255, 255, 0.1);
}

.glass-lab-dark .glass-badge-blue {
  background: rgba(59, 130, 246, 0.16);
  color: rgb(147, 197, 253);
}

.glass-lab-dark .glass-badge-teal {
  background: rgba(20, 184, 166, 0.16);
  color: rgb(94, 234, 212);
}

.glass-lab-dark .glass-badge-amber {
  background: rgba(245, 158, 11, 0.16);
  color: rgb(251, 191, 36);
}

.glass-lab-dark .glass-badge-rose {
  background: rgba(244, 63, 94, 0.16);
  color: rgb(251, 113, 133);
}

.glass-lab-dark .glass-badge-neutral {
  background: rgba(148, 163, 184, 0.12);
  color: rgb(203, 213, 225);
}

.glass-lab-dark .glass-field {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(15, 23, 42, 0.68);
  color: rgb(226, 232, 240);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22);
}

.glass-lab-dark .glass-field::placeholder {
  color: rgb(100, 116, 139);
}

.glass-lab-dark .glass-control-row,
.glass-lab-dark .glass-segment,
.glass-lab-dark .glass-table-wrap,
.glass-lab-dark .glass-timeline-card,
.glass-lab-dark .glass-timeline-content,
.glass-lab-dark .glass-feed-item,
.glass-lab-dark .glass-step,
.glass-lab-dark .glass-motion-card,
.glass-lab-dark .glass-motion-panel,
.glass-lab-dark .glass-motion-modal-sample,
.glass-lab-dark .glass-motion-timeline-item {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.44);
}

.glass-lab-dark .glass-checkbox {
  border-color: rgba(147, 197, 253, 0.24);
  background: rgba(15, 23, 42, 0.72);
}

.glass-lab-dark .glass-segment button {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-segment button.is-active {
  background: rgba(30, 41, 59, 0.82);
  color: rgb(147, 197, 253);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-toggle {
  background: rgba(59, 130, 246, 0.16);
  border-color: rgba(147, 197, 253, 0.16);
}

.glass-lab-dark .glass-toggle span {
  background: rgb(96, 165, 250);
}

.glass-lab-dark .glass-mini-card {
  border-color: rgba(255, 255, 255, 0.1);
  background:
    linear-gradient(135deg, rgba(20, 184, 166, 0.12), transparent),
    rgba(15, 23, 42, 0.58);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-mini-card-blue {
  background:
    linear-gradient(135deg, rgba(59, 130, 246, 0.14), transparent),
    rgba(15, 23, 42, 0.58);
}

.glass-lab-dark .glass-mini-card-amber {
  background:
    linear-gradient(135deg, rgba(245, 158, 11, 0.14), transparent),
    rgba(15, 23, 42, 0.58);
}

.glass-lab-dark .glass-mini-card p {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-table th {
  background: rgba(30, 41, 59, 0.62);
  color: rgb(203, 213, 225);
}

.glass-lab-dark .glass-table td {
  border-top-color: rgba(255, 255, 255, 0.08);
}

.glass-lab-dark .glass-timeline-card {
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-timeline::before {
  background: linear-gradient(180deg, rgba(96, 165, 250, 0.42), rgba(45, 212, 191, 0.28), rgba(251, 191, 36, 0.28));
}

.glass-lab-dark .glass-timeline-marker {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.8);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.24);
  color: rgb(147, 197, 253);
}

.glass-lab-dark .glass-timeline-item.is-complete .glass-timeline-marker {
  color: rgb(94, 234, 212);
}

.glass-lab-dark .glass-timeline-item.is-warning .glass-timeline-marker {
  color: rgb(251, 191, 36);
}

.glass-lab-dark .glass-timeline-head span,
.glass-lab-dark .glass-timeline-content p,
.glass-lab-dark .glass-feed-item p {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-feed-item {
  color: rgb(147, 197, 253);
}

.glass-lab-dark .glass-feed-item strong {
  color: rgb(226, 232, 240);
}

.glass-lab-dark .glass-step span {
  background: rgba(148, 163, 184, 0.12);
  color: rgb(203, 213, 225);
}

.glass-lab-dark .glass-step.is-done span {
  background: rgba(20, 184, 166, 0.16);
  color: rgb(94, 234, 212);
}

.glass-lab-dark .glass-step.is-current {
  background: rgba(59, 130, 246, 0.14);
}

.glass-lab-dark .glass-step.is-current span {
  background: rgb(96, 165, 250);
  color: rgb(15, 23, 42);
}

.glass-lab-dark .glass-motion-card,
.glass-lab-dark .glass-motion-panel,
.glass-lab-dark .glass-motion-modal-sample {
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-motion-card p,
.glass-lab-dark .glass-motion-modal-sample p,
.glass-lab-dark .glass-motion-timeline-item p {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-motion-hover:hover {
  border-color: rgba(147, 197, 253, 0.26);
  background: rgba(30, 41, 59, 0.58);
  box-shadow: 0 20px 46px rgba(59, 130, 246, 0.18);
}

.glass-lab-dark .glass-motion-press:active {
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
}

.glass-lab-dark .glass-motion-focus:focus-visible {
  border-color: rgba(147, 197, 253, 0.36);
  box-shadow:
    0 0 0 4px rgba(59, 130, 246, 0.18),
    0 18px 40px rgba(59, 130, 246, 0.16);
}

.glass-lab-dark .glass-motion-dot {
  background: rgb(96, 165, 250);
}

.glass-lab-dark .glass-motion-timeline-item > span {
  background: linear-gradient(135deg, rgb(96, 165, 250), rgb(45, 212, 191));
  box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.14);
}

:global(.glass-floating-content-dark) {
  border-color: rgba(255, 255, 255, 0.12) !important;
  background: rgba(15, 23, 42, 0.84) !important;
  color: rgb(226, 232, 240);
  box-shadow: 0 28px 90px rgba(0, 0, 0, 0.42) !important;
}

:global(.glass-floating-content-dark .text-muted-foreground) {
  color: rgb(148, 163, 184);
}

:global(.glass-floating-content-dark.glass-sheet-preview) {
  border-left-color: rgba(255, 255, 255, 0.12) !important;
}

:global(.glass-floating-content-dark.glass-popover-preview),
:global(.glass-floating-content-dark.glass-menu-preview) {
  background: rgba(15, 23, 42, 0.88) !important;
}

:global(.glass-floating-content-dark.glass-menu-preview [role='menuitem']:focus) {
  background: rgba(59, 130, 246, 0.16) !important;
}

.glass-lab-dark .glass-floating-summary,
.glass-lab-dark .glass-empty-state,
.glass-lab-dark .glass-loading-card {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.46);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-alert {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

.glass-lab-dark .glass-alert-compact {
  border-color: rgba(255, 255, 255, 0.1);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
}

.glass-lab-dark .glass-alert p,
.glass-lab-dark .glass-empty-state p,
.glass-lab-dark .glass-toast-rules p {
  color: rgb(148, 163, 184);
}

.glass-lab-dark .glass-alert-meta {
  background: rgba(255, 255, 255, 0.08);
}

.glass-lab-dark .glass-toast {
  border-color: rgba(255, 255, 255, 0.12);
  background: rgba(30, 41, 59, 0.78);
  color: rgb(226, 232, 240);
  box-shadow: 0 16px 42px rgba(0, 0, 0, 0.3);
}

.glass-lab-dark .glass-toast-rules > div {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.42);
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.22);
}

.glass-lab-dark .glass-tabs-list {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(15, 23, 42, 0.48);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.22);
}

.glass-lab-dark .glass-skeleton {
  border-color: rgba(255, 255, 255, 0.08);
  background:
    linear-gradient(90deg, rgba(30, 41, 59, 0.72), rgba(96, 165, 250, 0.24), rgba(30, 41, 59, 0.72)),
    rgba(15, 23, 42, 0.6);
  background-size: 200% 100%;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 10px 24px rgba(0, 0, 0, 0.2);
}
</style>
