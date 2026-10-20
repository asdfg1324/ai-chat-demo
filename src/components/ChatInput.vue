<script setup lang="ts">
import { ref } from 'vue'
import { useChatStore } from '@/stores/chat'
const chatStore = useChatStore()
const input = ref('')
const send = () => {
  if (!input.value.trim() || chatStore.isStreaming) return
  chatStore.send(input.value)
  input.value = ''
}
</script>

<template>
  <footer class="shrink-0 border-t border-slate-200/70 bg-white/90 px-[18px] pb-3 pt-4 backdrop-blur sm:px-[34px] sm:pb-5">
    <div class="w-full">
      <div class="relative flex items-end rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50 transition focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-100/70">
        <textarea v-model="input" @keydown.enter.exact.prevent="send" rows="1" placeholder="发消息，开始一场对话..." class="max-h-36 min-h-14 flex-1 resize-none bg-transparent px-5 py-4 text-sm leading-relaxed text-slate-800 outline-none placeholder:text-slate-400"></textarea>
        <button @click="send" :disabled="chatStore.isStreaming || !input.trim()" class="m-2 flex h-10 shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none">
          <span>{{ chatStore.isStreaming ? '生成中...' : '发送' }}</span>
          <span aria-hidden="true" class="text-base">↑</span>
        </button>
      </div>
      <div class="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-400">
        <span>Enter 发送 · Shift + Enter 换行</span>
        <span>本轮 {{ chatStore.tokenUsage.total }} tokens · 累计 {{ chatStore.totalTokens }}</span>
      </div>
    </div>
  </footer>
</template>