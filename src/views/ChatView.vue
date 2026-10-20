<script setup lang="ts">
import { nextTick, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useSessionStore } from '@/stores/sessions'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import { useVirtualScroll } from '@/composables/useVirtualScroll'

const chatStore = useChatStore()
const sessionStore = useSessionStore()
const ragEnabled = ref(chatStore.ragEnabled)
const messageContainer = ref<HTMLElement | null>(null)
const messageContent = ref<HTMLElement | null>(null)
const { visibleItems, totalHeight, offsetY, bottomOffset, useVirtual, measureItem } = useVirtualScroll(
  () => chatStore.messages,
  () => messageContainer.value
)

let contentObserver: ResizeObserver | undefined
const followLatest = ref(true)

async function scrollToLatest() {
  await nextTick()
  const container = messageContainer.value
  if (!container) return
  container.scrollTop = container.scrollHeight
  await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  container.scrollTop = container.scrollHeight
}

function updateFollowState() {
  const container = messageContainer.value
  if (container) {
    followLatest.value = container.scrollHeight - container.scrollTop - container.clientHeight < 120
  }
}

onMounted(async () => {
  const active = sessionStore.sessions.find(session => session.id === sessionStore.activeId)
  chatStore.messages = active
    ? active.messages.map(message => ({ ...message, isStreaming: false }))
    : []
  await nextTick()
  if (typeof ResizeObserver !== 'undefined') {
    contentObserver = new ResizeObserver(() => {
      if (followLatest.value) void scrollToLatest()
    })
    if (messageContent.value) contentObserver.observe(messageContent.value)
  }
  followLatest.value = true
  await scrollToLatest()
})

let persistTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => chatStore.messages,
  (messages) => {
    const firstUserMessage = messages.find(message => message.role === 'user')
    if (firstUserMessage && sessionStore.activeId) {
      sessionStore.updateTitle(sessionStore.activeId, firstUserMessage.content)
    }
    if (persistTimer) clearTimeout(persistTimer)
    persistTimer = setTimeout(() => {
      if (sessionStore.activeId) {
        sessionStore.updateMessages(sessionStore.activeId, messages)
      }
    }, 300)
  },
  { deep: true }
)

watch(
  () => chatStore.messages.map(message => message.content).join('\u0000'),
  () => {
    if (followLatest.value) void scrollToLatest()
  },
  { flush: 'post' }
)

watch(
  () => chatStore.messages.length,
  (length, previousLength) => {
    if (messageContent.value && contentObserver) {
      contentObserver.observe(messageContent.value)
    }
    if (length > previousLength && chatStore.isStreaming) {
      followLatest.value = true
      void scrollToLatest()
    }
  },
  { flush: 'post' }
)

onBeforeUnmount(() => {
  if (persistTimer) clearTimeout(persistTimer)
  contentObserver?.disconnect()
  if (sessionStore.activeId) {
    sessionStore.updateMessages(sessionStore.activeId, chatStore.messages)
  }
})

const quickSend = (text: string) => {
  if (!chatStore.isStreaming) chatStore.send(text)
}

const toggleRag = (val: boolean) => {
  ragEnabled.value = val
  chatStore.setRagEnabled(val)
}
</script>

<template>
  <div class="relative flex h-screen flex-1 flex-col bg-white">
    <!-- 顶部导航 -->
    <header class="z-10 flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200/80 bg-white/90 px-[18px] backdrop-blur sm:px-[34px]">
      <div class="flex min-w-0 items-center gap-3 sm:gap-5">
        <div class="min-w-0">
          <h1 class="truncate text-sm font-bold tracking-tight text-slate-800 sm:text-base">AI 流式对话</h1>
          <p class="hidden text-[11px] text-slate-400 sm:block">智能助手 · 让想法自然流动</p>
        </div>
        <span v-if="chatStore.isDemoMode" class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 sm:text-[11px]">本地演示</span>
        <span class="hidden h-7 w-px bg-slate-200 sm:block"></span>
        <label class="flex cursor-pointer select-none items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-blue-200 hover:bg-blue-50">
          <input type="checkbox" :checked="ragEnabled" @change="toggleRag(($event.target as HTMLInputElement).checked)" class="accent-blue-600">
          <span>知识库检索</span>
        </label>
      </div>
      <router-link to="/workflow" class="shrink-0 rounded-lg px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 sm:text-sm">工作流 <span aria-hidden="true">→</span></router-link>
    </header>

    <!-- 欢迎态 / 消息区 -->
    <main ref="messageContainer" @scroll="updateFollowState" class="flex-1 overflow-y-auto bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-50/70 via-slate-50 to-slate-100/70 px-[18px] py-6 sm:px-[34px] sm:py-10">
      <div v-if="chatStore.messages.length === 0" class="mx-auto mt-4 w-full text-center sm:mt-10">
        <div class="welcome-mark mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-white text-3xl shadow-lg shadow-blue-100 ring-1 ring-slate-200/80">✦</div>
        <p class="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-blue-600">你的 AI 助手已就绪</p>
        <h2 class="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">有什么可以帮你？</h2>
        <p class="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-500 sm:text-base">随时提问、探索想法，或从下面的示例开始体验。</p>
        <div class="mt-9 grid gap-3 text-left lg:grid-cols-3">
          <button @click="quickSend('北京天气')" class="group rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60">
            <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-lg">🌤️</span>
            <span class="block text-sm font-semibold text-slate-800">查询天气</span>
            <span class="mt-1 block text-xs text-slate-500">北京今天的天气怎么样？</span>
          </button>
          <button @click="quickSend('计算 123 * 456')" class="group rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60">
            <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-lg">🧮</span>
            <span class="block text-sm font-semibold text-slate-800">计算表达式</span>
            <span class="mt-1 block text-xs text-slate-500">帮我算一下 123 × 456</span>
          </button>
          <button @click="quickSend('查询请假制度')" class="group rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-100/60">
            <span class="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-lg">📚</span>
            <span class="block text-sm font-semibold text-slate-800">搜索知识库</span>
            <span class="mt-1 block text-xs text-slate-500">公司请假制度是什么？</span>
          </button>
        </div>
        <p v-if="chatStore.isDemoMode" class="mt-5 text-[11px] text-slate-400">
          当前使用本地模拟数据，天气、回复和工具结果用于演示交互流程
        </p>
      </div>
      <div v-else ref="messageContent" class="w-full">
        <div v-if="useVirtual" :style="{ height: `${offsetY}px` }"></div>
        <div>
          <div v-for="message in visibleItems" :key="message.id" :ref="(element) => measureItem(element, message._vIndex)" class="pb-5">
            <ChatMessage :message="message" @retry="chatStore.retry" />
          </div>
        </div>
        <div v-if="useVirtual" :style="{ height: `${bottomOffset}px` }"></div>
      </div>
    </main>

    <!-- 输入区 -->
    <ChatInput />
  </div>
</template>