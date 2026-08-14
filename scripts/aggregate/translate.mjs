// LLM 翻译模块：兼容 OpenAI 协议的任何第三方大模型 API
// 环境变量：
//   LLM_API_KEY   —— API Key(必填,或沿用 DEEPSEEK_API_KEY)
//   LLM_API_BASE  —— OpenAI 兼容接口地址,默认 https://api.deepseek.com
//   LLM_MODEL     —— 模型名,默认 deepseek-chat
// 未配置 key 时降级保留原文

const KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || ''
const BASE = (process.env.LLM_API_BASE || 'https://api.deepseek.com').replace(/\/$/, '')
const MODEL = process.env.LLM_MODEL || 'deepseek-chat'

export function hasTranslator() {
  return Boolean(KEY)
}

function isChinese(s) {
  return /[\u4e00-\u9fa5]/.test(s || '')
}

async function translateOne(text) {
  if (!text || isChinese(text)) return { text, translated: false }
  const url = `${BASE}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content: '你是 GitHub 项目简介翻译器。把用户给的英文简介翻译成简洁、准确、技术化的简体中文，只输出译文，不要解释、不要引号、不要前后缀。',
        },
        { role: 'user', content: text },
      ],
      temperature: 0.2,
      max_tokens: 300,
    }),
  })
  if (!res.ok) {
    console.warn(`翻译失败 ${res.status}: ${await res.text()}`)
    return { text, translated: false }
  }
  const data = await res.json()
  const out = data.choices?.[0]?.message?.content?.trim() || text
  return { text: out, translated: true }
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      try {
        results[idx] = await fn(items[idx], idx)
      } catch (e) {
        results[idx] = { error: e.message }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

export async function translateDescriptions(repos) {
  if (!KEY) {
    console.log('未配置 LLM_API_KEY / DEEPSEEK_API_KEY，跳过翻译（保留原文）')
    return repos.map((r) => ({
      ...r,
      description: r.descriptionOriginal || r.description || '',
      translated: false,
    }))
  }
  console.log(`翻译 ${repos.length} 条简介（${MODEL} @ ${BASE}，并发 5）…`)
  const out = await mapLimit(repos, 5, async (r) => {
    const t = await translateOne(r.descriptionOriginal || r.description)
    return { ...r, description: t.text, translated: t.translated }
  })
  return out
}