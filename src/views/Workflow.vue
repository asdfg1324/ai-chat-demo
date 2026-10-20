<script setup lang="ts">
import { ref, computed } from 'vue'
import { VueFlow, useVueFlow, Position } from '@vue-flow/core'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'
import { useChatStore } from '@/stores/chat'

const store = useChatStore()
const { fitView } = useVueFlow()

const executedTools = computed(() => {
  const tools = new Set<string>()
  for (const m of store.messages) {
    if (m.toolCalls?.length) {
      for (const tc of m.toolCalls) {
        tools.add(tc.name)
      }
    }
  }
  return tools
})

const nodes = ref([
  { id: '1', type: 'input', label: '用户输入', position: { x: 250, y: 0 }, data: { content: '北京天气，再算 (1+2)*3' }, sourcePosition: Position.Bottom },
  { id: '2', label: '模型决策\nmockDecide', position: { x: 230, y: 130 }, data: { desc: '正则匹配意图 → tool_calls' }, targetPosition: Position.Top, sourcePosition: Position.Bottom },
  { id: '3', label: 'get_weather', position: { x: 60, y: 280 }, data: { result: '多云 20°C', active: false }, targetPosition: Position.Top, sourcePosition: Position.Bottom },
  { id: '4', label: 'calc', position: { x: 380, y: 280 }, data: { result: '(1+2)*3 = 9', active: false }, targetPosition: Position.Top, sourcePosition: Position.Bottom },
  { id: '5', label: '模型总结\nmockSummarize', position: { x: 230, y: 430 }, data: { desc: '拼接结果 → 流式输出' }, targetPosition: Position.Top, sourcePosition: Position.Bottom },
  { id: '6', type: 'output', label: '流式输出到 UI', position: { x: 250, y: 570 }, targetPosition: Position.Top },
])

const edges = ref([
  { id: 'e1', source: '1', target: '2', label: '文本', animated: true },
  { id: 'e2', source: '2', target: '3', label: 'tool_call', animated: true },
  { id: 'e3', source: '2', target: '4', label: 'tool_call', animated: true },
  { id: 'e4', source: '3', target: '5', label: '结果', animated: true },
  { id: 'e5', source: '4', target: '5', label: '结果', animated: true },
  { id: 'e6', source: '5', target: '6', label: '逐字流', animated: true },
])

</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center justify-between px-6 py-3 bg-white border-b shadow-sm">
      <div>
        <h2 class="text-lg font-bold">🔀 Tool Calling 工作流</h2>
        <p class="text-xs text-gray-500">模拟大模型工具调用全链路（节点颜色随实际执行变化）</p>
      </div>
      <div class="flex gap-2">
        <button @click="fitView()" class="px-3 py-1.5 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 transition">适应视图</button>
        <router-link to="/" class="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition">← 返回对话</router-link>
      </div>
    </div>
    <div class="flex-1">
      <VueFlow
        v-model:nodes="nodes"
        v-model:edges="edges"
        :default-viewport="{ zoom: 1.1 }"
        :min-zoom="0.5"
        :max-zoom="2"
        fit-view-on-init
        class="bg-gray-50"
      >
        <template #node-default="{ data }">
          <div class="px-4 py-3 rounded-xl border-2 border-blue-300 bg-white shadow-md min-w-[170px] text-center transition-colors" :class="{ '!border-green-400 !bg-green-50': data.active || (data.result && executedTools.has(data.result.includes('=') ? 'calc' : 'get_weather')) }">
            <div class="font-semibold text-sm text-gray-800 whitespace-pre-line">{{ data.label }}</div>
            <div v-if="data.desc" class="text-xs text-gray-500 mt-1">{{ data.desc }}</div>
            <div v-if="data.result" class="text-xs text-green-600 mt-1.5 bg-green-50 rounded px-2 py-1 font-mono">→ {{ data.result }}</div>
          </div>
        </template>
        <template #node-input="{ data }">
          <div class="px-4 py-3 rounded-xl border-2 border-green-400 bg-green-50 shadow-md min-w-[170px] text-center">
            <div class="font-semibold text-sm text-green-800">{{ data.label }}</div>
            <div v-if="data.content" class="text-xs text-green-600 mt-1.5 bg-white rounded px-2 py-1 font-mono">"{{ data.content }}"</div>
          </div>
        </template>
        <template #node-output="{ data }">
          <div class="px-4 py-3 rounded-xl border-2 border-purple-400 bg-purple-50 shadow-md min-w-[170px] text-center">
            <div class="font-semibold text-sm text-purple-800">{{ data.label }}</div>
          </div>
        </template>
      </VueFlow>
    </div>
  </div>
</template>