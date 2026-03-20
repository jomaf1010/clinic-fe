<script setup lang="ts">
import { ref } from 'vue'
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
  LoaderCircle,
  ChevronDown,
  Bell,
  User,
  LogOut,
  Copy,
  MoreHorizontal,
  PanelRight,
} from 'lucide-vue-next'

const dialogOpen = ref(false)
const checkboxVal = ref(false)
const selectVal = ref('')
const sliderVal = ref([50])
const inputVal = ref('')
const textareaVal = ref('')
</script>

<template>
  <div class="mx-auto max-w-5xl space-y-10 pb-10">
    <div>
      <h1 class="text-2xl font-bold">Components</h1>
      <p class="text-muted-foreground">All UI components and their variations.</p>
    </div>

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
