<script setup lang="ts">
import SessionSidebar from '@/components/SessionSidebar.vue'
</script>

<template>
  <div class="flex h-screen w-screen overflow-hidden bg-slate-50">
    <SessionSidebar />
    <div class="flex-1 min-w-0 flex flex-col">
      <router-view />
    </div>
  </div>
</template>