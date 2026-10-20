import knowledge from '@/data/knowledge.json'

export interface RagResult {
  id: number
  title: string
  content: string
  score: number
}

// 简易关键词匹配（模拟向量检索）
export function searchKnowledge(query: string, topK: number = 3): RagResult[] {
  const keywords = new Set(query.toLowerCase().split(/\s+/).filter(w => w.length > 1))
  for (const phrase of query.match(/[\u4e00-\u9fff]{2,}/g) || []) {
    for (let index = 0; index < phrase.length - 1; index++) {
      keywords.add(phrase.slice(index, index + 2))
    }
  }
  
  const scored = knowledge.map(item => {
    let score = 0
    const text = `${item.title} ${item.content}`.toLowerCase()
    
    for (const kw of keywords) {
      // 标题命中权重更高
      if (item.title.toLowerCase().includes(kw)) score += 3
      if (text.includes(kw)) score += 1
    }
    
    return { ...item, score }
  })
  
  return scored
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
}

// 拼接成 system prompt 上下文
export function buildRagContext(results: RagResult[]): string {
  if (results.length === 0) return ''
  
  const context = results.map(r => `【${r.title}】\n${r.content}`).join('\n\n')
  return `以下是相关参考资料，请基于这些信息回答用户问题：\n\n${context}\n\n---`
}