<script setup lang="ts">
import MarkdownRender from '@/components/MarkdownRender.vue'

defineProps<{ message: any }>()
const emit = defineEmits<{ retry: [messageId: number] }>()

function formatToolValue(value: unknown): string {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const result = value as Record<string, unknown>
    if (typeof result.raw === 'string') return result.raw
    if (result.value !== undefined) return String(result.value)
    return JSON.stringify(result)
  }
  return String(value ?? '')
}
</script>

<template>
  <div :class="['flex w-full', message.role === 'user' ? 'justify-end' : 'justify-start']">
    <div :class="['flex gap-3 sm:gap-3.5', message.role === 'user' ? 'w-full max-w-[78%] flex-col items-end' : 'w-[calc(100%-44px)] max-w-[900px] items-start']">
      <div v-if="message.role !== 'user'" class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-blue-600 text-xs font-bold text-white shadow-sm shadow-blue-200" aria-label="AI 助手">
        AI
      </div>
      <div :class="['flex min-w-0 flex-col', message.role === 'user' ? 'max-w-full items-end' : 'assistant-message-content items-start']">
        <div v-if="message.role !== 'user'" class="mb-1.5 w-fit px-1 text-xs font-semibold text-slate-500">AI 助手</div>
        <!-- RAG 命中 -->
        <div v-if="message.ragHit" class="mb-2 w-fit rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[11px] font-medium text-blue-700">
          📚 命中 {{ message.ragHit }} 条知识库
        </div>
        <!-- 工具调用 -->
        <div v-if="message.toolCalls?.length" class="mb-2 w-full space-y-2">
          <div v-for="tc in message.toolCalls" :key="tc.id" class="rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3 text-xs text-amber-900 sm:px-4">
            <div class="flex items-center justify-between gap-3">
              <span class="font-semibold">🔧 {{ tc.label || tc.name }}</span>
              <span class="text-[10px] text-amber-700">{{ tc.status === 'running' ? '执行中' : tc.status === 'error' ? '失败' : tc.status === 'success' ? '已完成' : '等待执行' }}</span>
            </div>
            <div class="mt-1.5 break-all text-amber-800/75">参数：{{ formatToolValue(tc.params) }}</div>
            <div v-if="tc.result" class="mt-2 break-words border-t border-amber-200/70 pt-2 font-medium">
              {{ tc.status === 'error' ? '错误' : '结果' }}：{{ formatToolValue(tc.result) }}
            </div>
            <div v-if="tc.duration" class="mt-1.5 text-right text-[10px] text-amber-700/60">耗时 {{ tc.duration }}</div>
          </div>
        </div>
        <!-- 消息气泡 -->
        <div :class="[
          'max-w-full px-4 py-3 text-sm leading-7 sm:px-[18px]',
          message.role === 'user'
            ? 'rounded-[22px] rounded-br-md bg-[#4f7df3] text-white shadow-sm shadow-blue-200/70'
            : 'w-full rounded-2xl border border-slate-200/80 bg-white text-slate-700 shadow-[0_2px_10px_rgba(15,23,42,0.035)]'
        ]">
          <div v-if="message.isStreaming && !message.content" class="flex items-center gap-2 text-slate-400" role="status" aria-live="polite">
            <span class="loading-dots" aria-hidden="true"><i></i><i></i><i></i></span>
            <span>正在等待 AI 回复...</span>
          </div>
          <MarkdownRender v-else-if="message.content" :content="message.content" :is-streaming="message.isStreaming" />
          <span v-if="message.isStreaming" class="streaming-cursor" aria-hidden="true"></span>
        </div>
        <div v-if="message.error" class="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700" role="alert">
          <span>{{ message.error }}</span>
          <button
            v-if="message.canRetry"
            type="button"
            class="rounded-lg border border-rose-200 bg-white px-2.5 py-1 font-semibold text-rose-700 transition hover:bg-rose-100"
            @click="emit('retry', message.id)"
          >
            重试
          </button>
        </div>
        <div v-if="message.usage || message.responseTime" class="mt-1.5 flex w-fit gap-3 px-1 text-[11px] text-slate-400">
          <span v-if="message.usage">{{ message.usage.total }} tokens</span>
          <span v-if="message.responseTime">{{ message.responseTime }} ms</span>
        </div>
      </div>
    </div>
  </div>
</template>