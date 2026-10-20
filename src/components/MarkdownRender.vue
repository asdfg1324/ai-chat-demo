<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'
import 'highlight.js/styles/github-dark.css'

const props = defineProps<{ content: string; isStreaming?: boolean }>()

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('cs', csharp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('ts', typescript)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('yaml', yaml)
hljs.registerLanguage('yml', yaml)

const md = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(str, lang) {
    const language = lang && hljs.getLanguage(lang) ? lang : undefined
    const highlighted = language
      ? hljs.highlight(str, { language }).value
      : hljs.highlightAuto(str).value
    const languageClass = language ? ` class="language-${md.utils.escapeHtml(language)}"` : ''
    return `<pre class="hljs"><code${languageClass}>${highlighted}</code></pre>`
  }
})

// 防抖：流式进行中显示纯文本，结束后 150ms 再渲染 Markdown
const renderedHtml = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(
  () => props.content,
  (val) => {
    if (props.isStreaming) {
      // 流式进行中：显示纯文本（不 parse）
      renderedHtml.value = ''
    } else {
      // 流式结束：防抖 150ms 后渲染 Markdown
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        renderedHtml.value = md.render(val)
      }, 150)
    }
  },
  { immediate: true }
)

// 流式结束后如果还没触发过渲染，立即触发
watch(
  () => props.isStreaming,
  (streaming) => {
    if (!streaming && props.content) {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        renderedHtml.value = md.render(props.content)
      }, 150)
    }
  }
)

const showMarkdown = computed(() => renderedHtml.value.length > 0)
</script>

<template>
  <div>
    <!-- 流式进行中 或 Markdown 还没渲染完：纯文本 -->
    <span v-if="!showMarkdown" class="whitespace-pre-wrap">{{ content }}</span>
    <!-- Markdown 渲染完成：富文本 -->
    <div v-else class="markdown-content" v-html="renderedHtml" />
  </div>
</template>