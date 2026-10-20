import { defineStore } from 'pinia'
import { computed, reactive, ref, watch } from 'vue'
import type { ToolCall } from '@/types/tool'
import { searchKnowledge, buildRagContext } from '@/utils/rag'

// ========== 配置区 ==========
const API_KEY = import.meta.env.VITE_API_KEY || ''
const BASE_URL = import.meta.env.VITE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
const MODEL = import.meta.env.VITE_MODEL || 'qwen-plus'
const DEMO_MODE = !API_KEY
const REQUEST_TIMEOUT_MS = 60_000
// =============================

let msgId = Date.now() * 1000
let toolId = 0

// 防抖持久化
let saveTimer: any = null
function persist(msgs: any[]) {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    const toSave = msgs
      .filter((m: any) => !m.isStreaming)
      .map((m: any) => ({
        ...m,
        toolCalls: (m.toolCalls || []).map((tc: any) => ({ ...tc })),
      }))
    localStorage.setItem('chat_messages', JSON.stringify(toSave))
  }, 300)
}

// ========== 工具定义（OpenAI 标准格式）==========
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: '获取指定城市的实时天气信息，包括天气状况、温度、湿度',
      parameters: {
        type: 'object',
        properties: {
          city: { type: 'string', description: '城市名称，如"北京"、"上海"' }
        },
        required: ['city']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'calc',
      description: '执行数学计算，支持加减乘除、括号等表达式',
      parameters: {
        type: 'object',
        properties: {
          expr: { type: 'string', description: '数学表达式，如"1+2 * 3"、"(100-20)/4"' }
        },
        required: ['expr']
      }
    }
  }
]

// ========== 模型决策（本地兜底，模型也支持 tools 时以模型为准）==========
function localDecideTools(text: string, context: string[]): any[] {
  const tools: any[] = []

  // 天气意图
  const weatherMatch = text.match(/(.+?)(?:天气|气温|呢|怎么样)/)
  const hasWeather = /(天气|气温|多少度|冷不冷|热不热)/.test(text)
  if (weatherMatch || hasWeather) {
    let city = weatherMatch ? weatherMatch[1].trim() : ''
    if (!city || city.length < 2) {
      for (let i = context.length - 1; i >= 0; i--) {
        const m = context[i].match(/(.+?)(?:天气|气温)/)
        if (m) { city = m[1].trim(); break }
      }
    }
    city = city.replace(/^(查|问|看|帮|那|呢|我|你|的)/g, '').replace(/天气$/, '').trim()
    if (city && city.length >= 2) {
      tools.push({ name: 'get_weather', label: '查询天气', params: { city } })
    }
  }

  // 计算意图
  const exprMatch = text.match(/([\d+\-*/().\s]{3,})/)
  if (exprMatch && /[\+\-\*\/]/.test(exprMatch[1])) {
    tools.push({ name: 'calc', label: '计算器', params: { expr: exprMatch[1].trim() } })
  }

  return tools
}

// ========== 执行工具 ==========
async function executeTool(tc: ToolCall, demoMode = false) {
  tc.status = 'running'
  tc.startTime = Date.now()

  try {
    if (demoMode) await new Promise(resolve => setTimeout(resolve, 350))
    if (tc.name === 'get_weather') {
      if (demoMode) {
        tc.result = { city: tc.params.city, raw: `${tc.params.city}：晴，22°C，湿度 45%（演示数据）` }
      } else {
        const city = encodeURIComponent(tc.params.city)
        const res = await fetch(`https://wttr.in/${city}?format=%l:+%C+%t+湿度%h+%w`)
        if (!res.ok) throw new Error(`天气查询失败 (${res.status})`)
        const text = await res.text()
        tc.result = { city: tc.params.city, raw: text.trim() }
      }
    } else if (tc.name === 'calc') {
      const expr = tc.params.expr
      // 安全计算：只允许数字和基本运算符
      if (/^[\d+\-*/().\s]+$/.test(expr)) {
        const value = Function(`"use strict";return (${expr})`)()
        tc.result = { expr, value }
      } else {
        throw new Error('非法表达式')
      }
    }
    tc.status = 'success'
  } catch (e: any) {
    tc.status = 'error'
    tc.result = { error: e.message || '执行失败' }
  }

  tc.duration = (Date.now() - tc.startTime) + 'ms'
}

function createDemoReply(text: string, context: string[], ragResults: any[], toolCalls: ToolCall[]) {
  if (toolCalls.length > 0) {
    const results = toolCalls.map((tool) => {
      if (tool.name === 'get_weather') return String(tool.result?.raw || `${tool.params.city}天气查询完成`)
      if (tool.name === 'calc') return `${tool.params.expr} = ${tool.result?.value}`
      return `${tool.label}已完成`
    })
    return `已完成本地工具调用：\n\n${results.map(result => `- ${result}`).join('\n')}\n\n以上为演示数据，用于展示工具调用与结果回传流程。`
  }

  if (ragResults.length > 0) {
    const [result] = ragResults
    return `根据知识库「${result.title}」：\n\n${result.content}\n\n（以上内容由本地知识库检索生成）`
  }

  if (/\b(hi|hello)\b|你好|您好|早上好|下午好/.test(text.toLowerCase())) {
    return [
      '下面是几种语言输出 `Hello World!` 的示例：',
      '```bash\necho "Hello World!"\n```',
      '```csharp\nConsole.WriteLine("Hello World!");\n```',
      '```go\npackage main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("Hello World!")\n}\n```',
      '```java\nSystem.out.println("Hello World!");\n```',
      '```javascript\nconsole.log("Hello World!");\n```',
      '```python\nprint("Hello World!")\n```',
      '```rust\nfn main() {\n    println!("Hello World!");\n}\n```',
      '```sql\nSELECT \'Hello World!\';\n```',
      '```typescript\nconsole.log("Hello World!");\n```',
      '你好！我是 AI 流式对话 Demo 助手。你可以试试天气查询、数学计算，或开启知识库检索来查询制度和规范。'
    ].join('\n\n')
  }

  if (/你是谁|你能做什么|功能|演示/.test(text)) {
    return '这是一个 AI 应用交互演示，包含流式回复、多轮对话、工具调用、知识库检索和工作流可视化。当前使用本地模拟响应，无需配置 API Key。'
  }

  const previousTurns = Math.max(0, context.length - 1)
  return `收到你的问题：「${text}」\n\n这是本地演示模式下的模拟回复，用于展示流式输出与多轮对话交互。当前对话已包含 ${previousTurns} 轮历史消息。你可以试试「北京天气」「计算 123 * 456」，或开启知识库检索后查询「请假制度」。`
}

// ========== Store ==========
export const useChatStore = defineStore('chat', () => {
  // ---- 状态 ----
  const messages = ref<any[]>([])
  const isLoading = ref(false)
  const isStreaming = ref(false)
  const ragEnabled = ref(false)
  const lastRagResults = ref<any[]>([])
  const tokenUsage = computed(() =>
    [...messages.value].reverse().find(message => message.role === 'assistant')?.usage
    || { prompt: 0, completion: 0, total: 0 }
  )
  const totalTokens = computed(() =>
    messages.value.reduce((total, message) => total + (message.role === 'assistant' ? message.usage?.total || 0 : 0), 0)
  )
  const lastResponseTime = ref(0)
  const errorMsg = ref('')

  // 加载持久化消息
  const raw = localStorage.getItem('chat_messages')
  if (raw) {
    try {
      messages.value = JSON.parse(raw).map((m: any) => ({
        ...m,
        isStreaming: false,
        toolCalls: (m.toolCalls || []).map((tc: any) => ({
          ...tc,
          status: tc.status === 'running' ? 'success' : tc.status
        }))
      }))
    } catch (e) {
      messages.value = []
    }
  }

  // 持久化监听
  watch(messages, (val) => persist(val), { deep: true })

  // ---- Actions ----
  function setRagEnabled(val: boolean) {
    ragEnabled.value = val
  }

  function toggleRag() {
    ragEnabled.value = !ragEnabled.value
  }

  function clear() {
    messages.value = []
    isLoading.value = false
    isStreaming.value = false
    lastRagResults.value = []
    errorMsg.value = ''
  }

  /**
   * 核心发送逻辑
   * 支持：真实 SSE 流式 + Tool Calling 闭环 + RAG 上下文注入
   */
  async function send(text: string, retryAssistantMsg?: any) {
    if ((!retryAssistantMsg && !text.trim()) || isStreaming.value) return

    isLoading.value = true
    isStreaming.value = true
    errorMsg.value = ''
    lastRagResults.value = []

    let userMsg: any
    if (retryAssistantMsg) {
      const assistantIndex = messages.value.indexOf(retryAssistantMsg)
      userMsg = assistantIndex > 0 ? messages.value[assistantIndex - 1] : null
      if (!userMsg || userMsg.role !== 'user') {
        isLoading.value = false
        isStreaming.value = false
        return
      }
      text = userMsg.content
      retryAssistantMsg.content = ''
      retryAssistantMsg.error = ''
      retryAssistantMsg.canRetry = false
      retryAssistantMsg.isStreaming = true
      retryAssistantMsg.toolCalls = []
      retryAssistantMsg.usage = null
      retryAssistantMsg.responseTime = 0
    } else {
      // 1. 添加用户消息
      userMsg = { id: ++msgId, role: 'user', content: text, toolCalls: [], isStreaming: false }
      messages.value.push(userMsg)
    }

    // 2. 构建上下文消息
    const context = messages.value
      .filter(m => m.role === 'user')
      .slice(-6)
      .map(m => m.content)

    // 3. RAG 检索（如果开启）
    let systemPrompt = '你是一个有帮助的 AI 助手，回答简洁清晰。'
    let ragHit = 0
    if (ragEnabled.value) {
      const results = searchKnowledge(text, 3)
      lastRagResults.value = results
      ragHit = results.length
      if (results.length > 0) {
        const ctx = buildRagContext(results)
        systemPrompt = `${ctx}\n\n${systemPrompt}`
      }
    }

    // 4. 本地兜底：检测是否需要工具调用
    const localTools = DEMO_MODE ? localDecideTools(text, context) : []

    // 5. 添加助手占位消息
    const assistantMsg = retryAssistantMsg || reactive({
      id: ++msgId,
      role: 'assistant',
      content: '',
      toolCalls: [] as ToolCall[],
      ragHit,
      isStreaming: true,
      usage: null as any,
      responseTime: 0
    })
    assistantMsg.ragHit = ragHit
    if (!retryAssistantMsg) messages.value.push(assistantMsg)

    const startTime = Date.now()

    try {
      // 构建 API 消息列表
      const apiMessages: any[] = [
        { role: 'system', content: systemPrompt }
      ]

      // 加入历史消息（排除当前占位）
      const history = messages.value
        .filter((message) => message !== assistantMsg && (message.role === 'user' || message.role === 'assistant'))
        .slice(-12)
      for (const message of history) {
        apiMessages.push({ role: message.role, content: message.content })
      }

      // 如果有本地检测到的工具，先执行本地工具再让模型总结
      if (localTools.length > 0) {
        const pendingCalls: { id: string; type: 'function'; function: { name: string; arguments: string } }[] = []
        for (const toolDef of localTools) {
          const tc: ToolCall = {
            id: ++toolId,
            apiCallId: `call_${toolId}`,
            name: toolDef.name,
            label: toolDef.label,
            params: toolDef.params,
            result: null,
            status: 'pending',
            startTime: 0,
            duration: ''
          }
          assistantMsg.toolCalls.push(tc)
          const callId = `call_${tc.id}`
          pendingCalls.push({
            id: callId,
            type: 'function',
            function: { name: tc.name, arguments: JSON.stringify(tc.params) }
          })

          // 执行工具
          await executeTool(assistantMsg.toolCalls[assistantMsg.toolCalls.length - 1], DEMO_MODE)

          // 将工具结果作为消息传给模型
          apiMessages.push({
            role: 'tool',
            tool_call_id: callId,
            name: tc.name,
            content: tc.status === 'success'
              ? JSON.stringify(tc.result)
              : `工具执行失败: ${tc.result?.error || '未知错误'}`
          })
        }
        if (!DEMO_MODE) {
          apiMessages.splice(apiMessages.length - localTools.length, 0, {
            role: 'assistant',
            content: null,
            tool_calls: pendingCalls
          })
        }

        // 重新请求模型，带上工具结果
        if (DEMO_MODE) {
          const reply = createDemoReply(text, context, lastRagResults.value, assistantMsg.toolCalls)
          await streamDemoReply(reply, assistantMsg, context.length)
        } else {
          await streamCompletion(apiMessages, assistantMsg, startTime)
        }
      } else {
        if (DEMO_MODE) {
          const reply = createDemoReply(text, context, lastRagResults.value, assistantMsg.toolCalls)
          await streamDemoReply(reply, assistantMsg, context.length)
        } else {
          await streamCompletion(apiMessages, assistantMsg, startTime)
        }
      }

    } catch (e: any) {
      console.error('[Chat] Send error:', e)
      errorMsg.value = e.message || '请求失败，请检查网络或 API 配置'
      assistantMsg.error = errorMsg.value
      assistantMsg.canRetry = true
      assistantMsg.isStreaming = false
    } finally {
      isLoading.value = false
      isStreaming.value = false
      assistantMsg.responseTime = Date.now() - startTime
      lastResponseTime.value = assistantMsg.responseTime
    }
  }

  function retry(messageId: number) {
    const assistantMsg = messages.value.find(message => message.id === messageId)
    if (assistantMsg?.role === 'assistant' && assistantMsg.canRetry && !isStreaming.value) {
      void send('', assistantMsg)
    }
  }

  async function streamDemoReply(reply: string, assistantMsg: any, turns: number) {
    const characters = Array.from(reply)
    for (let index = 0; index < characters.length; index += 3) {
      await new Promise(resolve => setTimeout(resolve, 24))
      assistantMsg.content += characters.slice(index, index + 3).join('')
      const completion = Math.ceil(Array.from(assistantMsg.content).length / 2)
      const prompt = turns * 12 + 8
      assistantMsg.usage = { prompt, completion, total: prompt + completion }
    }
    assistantMsg.isStreaming = false
  }

  /**
   * SSE 流式请求
   */
  async function streamCompletion(
    apiMessages: any[],
    assistantMsg: any,
    startTime: number,
    usageTotal = { prompt: 0, completion: 0, total: 0 }
  ) {
    const controller = new AbortController()
    let timeoutExpired = false
    const timeout = setTimeout(() => {
      timeoutExpired = true
      controller.abort()
    }, REQUEST_TIMEOUT_MS)
    let res: Response
    try {
      res = await fetch(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
        body: JSON.stringify({
          model: MODEL,
          messages: apiMessages,
          tools: TOOLS,
          tool_choice: 'auto',
          stream: true,
          stream_options: { include_usage: true },
          temperature: 0.7
        }),
        signal: controller.signal
      })
    } catch {
      clearTimeout(timeout)
      throw new Error(timeoutExpired
        ? 'AI 回复超时，请检查网络后重试'
        : '网络连接失败，请检查网络后重试')
    }

    if (!res.ok) {
      clearTimeout(timeout)
      const errText = await res.text()
      throw new Error(`API 请求失败 (${res.status}): ${errText.slice(0, 200)}`)
    }

    if (!res.body) {
      clearTimeout(timeout)
      throw new Error('API 未返回可读取的流式响应')
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let fullContent = ''
    const toolCallsMap = new Map<number, ToolCall & { apiCallId: string; rawArguments: string }>()

    const processLine = (line: string) => {
      const trimmed = line.trim()
      if (!trimmed || !trimmed.startsWith('data:')) return

      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return

      try {
        const json = JSON.parse(data)
        if (json.usage) {
          usageTotal.prompt += json.usage.prompt_tokens || 0
          usageTotal.completion += json.usage.completion_tokens || 0
          usageTotal.total += json.usage.total_tokens || 0
          assistantMsg.usage = { ...usageTotal }
        }

        const choice = json.choices?.[0]
        if (!choice) return
        const delta = choice.delta || {}

        if (delta.content) {
          fullContent += delta.content
          assistantMsg.content = fullContent
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const index = tc.index
            if (!toolCallsMap.has(index)) {
              toolCallsMap.set(index, {
                id: ++toolId,
                apiCallId: tc.id || `call_${toolId}`,
                name: '',
                label: '',
                params: {},
                rawArguments: '',
                result: null,
                status: 'pending' as const,
                startTime: 0,
                duration: ''
              })
            }
            const existing = toolCallsMap.get(index)
            if (tc.id) existing.apiCallId = tc.id
            if (tc.function?.name) existing.name = tc.function.name
            if (tc.function?.arguments) existing.rawArguments += tc.function.arguments
          }
        }
      } catch {
        // Ignore incomplete or non-JSON SSE data frames.
      }
    }

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
        lines.forEach(processLine)
      }
    } catch {
      throw new Error(timeoutExpired
        ? 'AI 回复超时，请检查网络后重试'
        : '网络连接中断，请检查网络后重试')
    } finally {
      clearTimeout(timeout)
    }
    buffer += decoder.decode()
    if (buffer.trim()) processLine(buffer)

    // 如果有工具调用，执行它们
    if (toolCallsMap.size > 0) {
      const toolCalls = Array.from(toolCallsMap.values())
      for (const tc of toolCalls) {
        tc.label = tc.name === 'get_weather' ? '查询天气' : tc.name === 'calc' ? '计算器' : tc.name
        try {
          tc.params = JSON.parse(tc.rawArguments || '{}')
        } catch {
          tc.params = { error: '工具参数不是有效的 JSON' }
        }
        assistantMsg.toolCalls.push(tc)
        const activeToolCall = assistantMsg.toolCalls[assistantMsg.toolCalls.length - 1]
        if ('error' in activeToolCall.params) {
          activeToolCall.status = 'error'
          activeToolCall.result = { error: activeToolCall.params.error }
          activeToolCall.duration = '0ms'
        } else {
          await executeTool(activeToolCall)
        }

        apiMessages.push({
          role: 'tool',
          tool_call_id: tc.apiCallId,
          name: tc.name,
          content: tc.status === 'success'
            ? JSON.stringify(tc.result)
            : `工具执行失败: ${tc.result?.error || '未知错误'}`
        })
      }

      apiMessages.splice(apiMessages.length - toolCalls.length, 0, {
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.apiCallId,
          type: 'function',
          function: { name: tc.name, arguments: JSON.stringify(tc.params) }
        }))
      })

      // 递归：带上工具结果再次请求模型
      await streamCompletion(apiMessages, assistantMsg, startTime, usageTotal)
      return
    }

    if (usageTotal.total > 0) {
      assistantMsg.usage = { ...usageTotal }
    } else {
      const prompt = Math.ceil(apiMessages.reduce((count, message) => count + String(message.content || '').length, 0) / 4)
      const completion = Math.ceil(fullContent.length / 4)
      assistantMsg.usage = { prompt, completion, total: prompt + completion }
    }
    assistantMsg.isStreaming = false
    assistantMsg.responseTime = Date.now() - startTime
  }

  return {
    // state
    messages,
    isLoading,
    isStreaming,
    ragEnabled,
    lastRagResults,
    tokenUsage,
    totalTokens,
    lastResponseTime,
    errorMsg,
    isDemoMode: DEMO_MODE,
    // actions
    send,
    retry,
    clear,
    setRagEnabled,
    toggleRag
  }
})