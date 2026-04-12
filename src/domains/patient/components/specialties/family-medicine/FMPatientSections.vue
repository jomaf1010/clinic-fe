<script setup lang="ts">
import { ListChecks, Activity } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Problem List -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <ListChecks class="size-4 text-muted-foreground" />
          Problem List
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Not yet available</p>
      </CardContent>
    </Card>

    <!-- Chronic Disease Trends -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <Activity class="size-4 text-muted-foreground" />
          Chronic Disease Trends
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Not yet available</p>
      </CardContent>
    </Card>
  </div>
</template>
