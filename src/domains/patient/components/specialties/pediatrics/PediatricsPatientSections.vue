<script setup lang="ts">
import { Baby, Syringe, TrendingUp } from 'lucide-vue-next'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Birth History -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <Baby class="size-4 text-muted-foreground" />
          Birth History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Not yet available</p>
      </CardContent>
    </Card>

    <!-- Immunizations -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <Syringe class="size-4 text-muted-foreground" />
          Immunizations
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Not yet available</p>
      </CardContent>
    </Card>

    <!-- Growth Charts -->
    <Card>
      <CardHeader class="pb-2">
        <CardTitle class="flex items-center gap-2 text-sm font-medium">
          <TrendingUp class="size-4 text-muted-foreground" />
          Growth Charts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p class="text-sm text-muted-foreground">Not yet available</p>
      </CardContent>
    </Card>
  </div>
</template>
