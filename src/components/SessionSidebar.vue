<script setup lang="ts">
import { useSessionStore } from '@/stores/sessions'
import { useChatStore } from '@/stores/chat'

const sessionStore = useSessionStore()
const chatStore = useChatStore()

const saveActiveSession = () => {
  if (sessionStore.activeId) {
    sessionStore.updateMessages(sessionStore.activeId, chatStore.messages)
  }
}

const selectSession = (id: string) => {
  saveActiveSession()
  sessionStore.switchSession(id)
  const active = sessionStore.sessions.find(s => s.id === id)
  chatStore.messages = active
    ? active.messages.map(message => ({ ...message, isStreaming: false }))
    : []
}

const newChat = () => {
  saveActiveSession()
  sessionStore.createSession()
  chatStore.messages = []
}

const remove = (e: Event, id: string) => {
  e.stopPropagation()
  saveActiveSession()
  sessionStore.deleteSession(id)
  const active = sessionStore.sessions.find(s => s.id === sessionStore.activeId)
  chatStore.messages = active
    ? active.messages.map(message => ({ ...message, isStreaming: false }))
    : []
}
</script>

<template>
  <aside class="flex h-screen w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white sm:w-72">
    <div class="flex items-center gap-3 border-b border-slate-100 px-5 py-5">
      <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white shadow-lg shadow-blue-200/70">AI</div>
      <div class="min-w-0">
        <p class="truncate text-sm font-semibold tracking-tight text-slate-800">AI 对话工作台</p>
        <p class="mt-0.5 text-[11px] font-medium tracking-[0.12em] text-slate-400">CHAT WORKSPACE</p>
      </div>
    </div>
    <div class="px-4 pb-4 pt-5">
      <button @click="newChat" class="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white shadow-md shadow-slate-300/70 transition hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100">
        <span class="text-lg leading-none">+</span>
        新建对话
      </button>
    </div>
    <div class="px-5 pb-2 pt-1 text-[11px] font-semibold tracking-[0.12em] text-slate-400">最近对话</div>
    <div class="flex-1 space-y-1 overflow-y-auto px-[14px] pb-4">
      <div v-for="s in sessionStore.sessions" :key="s.id"
        @click="selectSession(s.id)"
        :class="['group flex cursor-pointer flex-col rounded-xl border px-3.5 py-3 transition', s.id === sessionStore.activeId ? 'border-blue-100 bg-blue-50/80 text-blue-700 shadow-sm shadow-blue-100/50' : 'border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50']"
      >
        <div class="flex w-full items-center justify-between gap-2">
          <span class="truncate text-[13px] font-semibold">{{ s.title || '新对话' }}</span>
          <button @click="remove($event, s.id)" aria-label="删除对话" class="rounded-md px-1.5 py-1 text-slate-400 opacity-0 transition hover:bg-red-50 hover:text-red-500 focus:opacity-100 group-hover:opacity-100">×</button>
        </div>
        <span class="mt-1 text-[11px] text-slate-400">{{ new Date(s.updatedAt).toLocaleString('zh-CN', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) }}</span>
      </div>
    </div>
    <div class="border-t border-slate-100 p-4">
      <button @click="sessionStore.exportAll" class="w-full rounded-lg py-2 text-xs font-medium text-slate-500 transition hover:bg-slate-50 hover:text-blue-700">导出所有对话</button>
    </div>
  </aside>
</template>