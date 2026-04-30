<script setup lang="ts">
import { ref, watch, onUnmounted, nextTick } from 'vue'
import { ZoomIn, ZoomOut, Upload } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = withDefaults(defineProps<{
  open: boolean
  title?: string
  description?: string
  outputSize?: number
}>(), {
  title: 'Upload Image',
  description: 'Drag to reposition and use the slider to zoom.',
  outputSize: 512,
})

const emit = defineEmits<{
  'update:open': [value: boolean]
  'crop': [file: Blob]
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)

const imageSrc = ref<string | null>(null)
const image = ref<HTMLImageElement | null>(null)
const zoom = ref([1])
const panX = ref(0)
const panY = ref(0)
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })

const VIEWPORT_SIZE = 280

function reset() {
  if (imageSrc.value) URL.revokeObjectURL(imageSrc.value)
  imageSrc.value = null
  image.value = null
  zoom.value = [1]
  panX.value = 0
  panY.value = 0
}

function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return
  loadImage(file)
  input.value = ''
}

function handleDrop(event: DragEvent) {
  event.preventDefault()
  const file = event.dataTransfer?.files[0]
  if (!file || !file.type.startsWith('image/')) return
  loadImage(file)
}

function loadImage(file: File) {
  reset()
  const url = URL.createObjectURL(file)
  imageSrc.value = url
  const img = new Image()
  img.onload = () => {
    image.value = img
    // Fit image so shorter side fills the viewport
    const minDim = Math.min(img.width, img.height)
    const fitZoom = VIEWPORT_SIZE / minDim
    zoom.value = [fitZoom]
    panX.value = 0
    panY.value = 0
    nextTick(draw)
  }
  img.src = url
}

function draw() {
  const canvas = canvasRef.value
  const img = image.value
  if (!canvas || !img) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = VIEWPORT_SIZE
  canvas.height = VIEWPORT_SIZE

  ctx.clearRect(0, 0, VIEWPORT_SIZE, VIEWPORT_SIZE)

  // Save and clip to circle
  ctx.save()
  ctx.beginPath()
  ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, 0, Math.PI * 2)
  ctx.clip()

  const z = zoom.value[0] ?? 1
  const drawW = img.width * z
  const drawH = img.height * z
  const x = (VIEWPORT_SIZE - drawW) / 2 + panX.value
  const y = (VIEWPORT_SIZE - drawH) / 2 + panY.value

  ctx.drawImage(img, x, y, drawW, drawH)
  ctx.restore()

  // Draw circle border
  ctx.beginPath()
  ctx.arc(VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2, VIEWPORT_SIZE / 2 - 1, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 2
  ctx.stroke()
}

function onPointerDown(e: PointerEvent) {
  if (!image.value) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY }
  panStart.value = { x: panX.value, y: panY.value }
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!isDragging.value) return
  panX.value = panStart.value.x + (e.clientX - dragStart.value.x)
  panY.value = panStart.value.y + (e.clientY - dragStart.value.y)
  draw()
}

function onPointerUp() {
  isDragging.value = false
}

function onWheel(e: WheelEvent) {
  if (!image.value) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.05 : 0.05
  const img = image.value
  const minDim = Math.min(img.width, img.height)
  const minZoom = VIEWPORT_SIZE / minDim * 0.5
  const maxZoom = VIEWPORT_SIZE / minDim * 4
  zoom.value = [Math.max(minZoom, Math.min(maxZoom, (zoom.value[0] ?? 1) + delta))]
  draw()
}

function handleZoomChange(val: number[]) {
  zoom.value = val
  draw()
}

function cropAndEmit() {
  const img = image.value
  if (!img) return

  const outputCanvas = document.createElement('canvas')
  outputCanvas.width = props.outputSize
  outputCanvas.height = props.outputSize
  const ctx = outputCanvas.getContext('2d')
  if (!ctx) return

  const z = zoom.value[0] ?? 1
  const scale = props.outputSize / VIEWPORT_SIZE
  const drawW = img.width * z * scale
  const drawH = img.height * z * scale
  const x = ((VIEWPORT_SIZE - img.width * z) / 2 + panX.value) * scale
  const y = ((VIEWPORT_SIZE - img.height * z) / 2 + panY.value) * scale

  ctx.drawImage(img, x, y, drawW, drawH)

  outputCanvas.toBlob((blob) => {
    if (blob) {
      emit('crop', blob)
      emit('update:open', false)
    }
  }, 'image/png')
}

// Compute slider range based on loaded image
function getMinZoom() {
  const img = image.value
  if (!img) return 0.1
  const minDim = Math.min(img.width, img.height)
  return (VIEWPORT_SIZE / minDim) * 0.5
}

function getMaxZoom() {
  const img = image.value
  if (!img) return 5
  const minDim = Math.min(img.width, img.height)
  return (VIEWPORT_SIZE / minDim) * 4
}

watch(() => props.open, (open) => {
  if (!open) reset()
})

watch(zoom, () => draw())

onUnmounted(() => {
  if (imageSrc.value) URL.revokeObjectURL(imageSrc.value)
})
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
        <DialogDescription>{{ description }}</DialogDescription>
      </DialogHeader>

      <div class="flex flex-col items-center gap-4">
        <!-- Upload / Canvas area -->
        <div
          v-if="!image"
          class="flex size-[280px] cursor-pointer flex-col items-center justify-center gap-3 rounded-full border-2 border-dashed border-muted-foreground/25 bg-muted/30 transition-colors hover:border-muted-foreground/40 hover:bg-muted/50"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
          @dragover.prevent
          @drop="handleDrop"
        >
          <Upload class="size-8 text-muted-foreground" />
          <div class="text-center">
            <p class="text-sm font-medium">Drop image here</p>
            <p class="text-xs text-muted-foreground">or click to browse</p>
          </div>
        </div>

        <div
          v-else
          class="relative cursor-grab active:cursor-grabbing"
          @pointerdown="onPointerDown"
          @pointermove="onPointerMove"
          @pointerup="onPointerUp"
          @wheel="onWheel"
        >
          <canvas
            ref="canvasRef"
            :width="VIEWPORT_SIZE"
            :height="VIEWPORT_SIZE"
            class="rounded-full"
          />
        </div>

        <!-- Zoom controls -->
        <div v-if="image" class="flex w-full items-center gap-3 px-4">
          <ZoomOut class="size-4 shrink-0 text-muted-foreground" />
          <Slider
            :model-value="zoom"
            :min="getMinZoom()"
            :max="getMaxZoom()"
            :step="0.01"
            class="flex-1"
            @update:model-value="handleZoomChange"
          />
          <ZoomIn class="size-4 shrink-0 text-muted-foreground" />
        </div>

        <!-- Change image link -->
        <button
          v-if="image"
          type="button"
          class="text-xs text-muted-foreground underline-offset-2 hover:underline"
          @click="($refs.fileInput as HTMLInputElement)?.click()"
        >
          Choose different image
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="sr-only"
        @change="handleFileSelect"
      />

      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">Cancel</Button>
        <Button :disabled="!image" @click="cropAndEmit">Save</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
