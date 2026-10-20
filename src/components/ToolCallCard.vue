<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ tool: any }>()

const statusColor = computed(() => {
  switch (props.tool.status) {
    case 'success': return 'border-green-300 bg-green-50'
    case 'error': return 'border-red-300 bg-red-50'
    case 'running': return 'border-blue-300 bg-blue-50'
    default: return 'border-gray-300 bg-gray-50'
  }
})

const statusIcon = computed(() => {
  switch (props.tool.status) {
    case 'success': return '✅'
    case 'error': return '❌'
    case 'running': return '⏳'
    default: return '⚪'
  }
})

const statusText = computed(() => {
  switch (props.tool.status) {
    case 'success': return '成功'
    case 'error': return '失败'
    case 'running': return '执行中...'
    default: return '等待'
  }
})
</script>

<template>
  <div :class="statusColor" class="rounded-lg border p-2.5 text-xs transition-colors">
    <div class="flex items-center justify-between mb-1.5">
      <div class="flex items-center gap-1.5 font-medium text-gray-700">
        <span>{{ statusIcon }}</span>
        <span>{{ tool.label }}</span>
        <code class="text-gray-500 font-mono">{{ tool.name }}</code>
      </div>
      <span class="text-gray-400">{{ statusText }}</span>
    </div>
    <div class="flex flex-wrap gap-2 text-gray-500 font-mono text-[11px]">
      <span v-for="(val, key) in tool.params" :key="key" class="bg-white rounded px-1.5 py-0.5">
        {{ key }}={{ typeof val === 'object' ? JSON.stringify(val) : val }}
      </span>
    </div>
    <div v-if="tool.result" class="mt-1.5 bg-white rounded px-2 py-1 font-mono text-[11px] text-gray-600">
      → {{ typeof tool.result === 'object' ? JSON.stringify(tool.result) : tool.result }}
    </div>
    <div v-if="tool.duration" class="mt-1 text-[10px] text-gray-400">
      {{ tool.duration }}
    </div>
  </div>
</template>