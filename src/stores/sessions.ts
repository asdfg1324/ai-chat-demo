import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface ChatSession {
  id: string
  title: string
  messages: any[]
  updatedAt: number
}

export const useSessionStore = defineStore('sessions', () => {
  const sessions = ref<ChatSession[]>([])
  const activeId = ref<string | null>(null)

  // ---- 加载 ----
  function load() {
    try {
      const ids = JSON.parse(localStorage.getItem('chat_sessions') || '[]')
      sessions.value = ids
        .map((id: string) => {
          const raw = localStorage.getItem(`session_${id}`)
          if (!raw) return null
          return { id, ...JSON.parse(raw) }
        })
        .filter(Boolean)
        .sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt)

      activeId.value = localStorage.getItem('active_session_id')
    } catch (e) {
      sessions.value = []
      activeId.value = null
    }
  }

  // ---- 持久化 ----
  function persist() {
    const ids = sessions.value.map(s => s.id)
    localStorage.setItem('chat_sessions', JSON.stringify(ids))
    for (const s of sessions.value) {
      localStorage.setItem(`session_${s.id}`, JSON.stringify({
        title: s.title,
        messages: s.messages,
        updatedAt: s.updatedAt
      }))
    }
    if (activeId.value) {
      localStorage.setItem('active_session_id', activeId.value)
    }
  }

  // ---- 新建会话 ----
  function createSession(): string {
    const id = `session_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const session: ChatSession = {
      id,
      title: '新对话',
      messages: [],
      updatedAt: Date.now()
    }
    sessions.value.unshift(session)
    activeId.value = id
    persist()
    return id
  }

  // ---- 删除会话 ----
  function deleteSession(id: string) {
    sessions.value = sessions.value.filter(s => s.id !== id)
    localStorage.removeItem(`session_${id}`)

    if (activeId.value === id) {
      activeId.value = sessions.value.length > 0 ? sessions.value[0].id : null
      if (!activeId.value) {
        // 没有会话了，自动创建一个
        createSession()
      }
    }
    persist()
  }

  // ---- 更新标题 ----
  function updateTitle(id: string, firstUserMsg: string) {
    const session = sessions.value.find(s => s.id === id)
    if (session && session.title === '新对话' && firstUserMsg) {
      const title = firstUserMsg.length > 12
        ? firstUserMsg.slice(0, 12) + '...'
        : firstUserMsg
      session.title = title
      session.updatedAt = Date.now()
      persist()
    }
  }

  // ---- 更新消息 ----
  function updateMessages(id: string, messages: any[]) {
    const session = sessions.value.find(s => s.id === id)
    if (session) {
      session.messages = messages
      session.updatedAt = Date.now()
      persist()
    }
  }

  // ---- 切换会话 ----
  function switchSession(id: string) {
    activeId.value = id
    localStorage.setItem('active_session_id', id)
    // 排序：把当前会话提到最前面
    const idx = sessions.value.findIndex(s => s.id === id)
    if (idx > 0) {
      const [session] = sessions.value.splice(idx, 1)
      sessions.value.unshift(session)
      persist()
    }
  }

  // ---- 导出全部 ----
  function exportAll() {
    const data = sessions.value.map(s => ({
      title: s.title,
      messages: s.messages,
      updatedAt: new Date(s.updatedAt).toISOString()
    }))
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chat-export-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // 初始化
  load()
  if (sessions.value.length === 0) {
    createSession()
  }

  return {
    sessions,
    activeId,
    load,
    persist,
    createSession,
    deleteSession,
    updateTitle,
    updateMessages,
    switchSession,
    exportAll
  }
})