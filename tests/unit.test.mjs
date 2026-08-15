// 纯函数单测——使用 Node 内置 node:test,零额外依赖
// 运行: npm test
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { categorize, getCategory } from '../src/lib/categories.js'
import { formatNumber, relativeDate, langColor } from '../src/lib/format.js'
import { extractRepos } from '../scripts/aggregate/awesome.mjs'
import { activeSponsors, sponsorFor } from '../src/lib/sponsors.js'

describe('categorize', () => {
  it('官方 owner 归 core', () => {
    const r = { owner: 'deepseek-ai', name: 'harness', description: '', topics: [] }
    assert.equal(categorize(r), 'core')
  })
  it('awesome 关键词归 awesome', () => {
    const r = { owner: 'x', name: 'awesome-dsh', description: 'curated list', topics: [] }
    assert.equal(categorize(r), 'awesome')
  })
  it('终端关键词归 terminal', () => {
    const r = { owner: 'x', name: 'my-tui', description: 'a terminal app', topics: ['cli'] }
    assert.equal(categorize(r), 'terminal')
  })
  it('视觉关键词归 vision', () => {
    const r = { owner: 'x', name: 'ocr-tool', description: 'image recognition', topics: [] }
    assert.equal(categorize(r), 'vision')
  })
  it('记忆/RAG 关键词归 memory', () => {
    const r = { owner: 'x', name: 'ctx-store', description: 'context embedding rag', topics: [] }
    assert.equal(categorize(r), 'memory')
  })
  it('无匹配归 other', () => {
    const r = { owner: 'x', name: 'random', description: 'something unrelated', topics: [] }
    assert.equal(categorize(r), 'other')
  })
  it('空对象不崩溃,归 other', () => {
    assert.equal(categorize({}), 'other')
  })
  it('topics undefined 不崩溃', () => {
    assert.equal(categorize({ name: 'x', description: '' }), 'other')
  })
})

describe('getCategory', () => {
  it('已知 id 返回对应分类', () => {
    assert.equal(getCategory('core').id, 'core')
  })
  it('未知 id fallback 到 other', () => {
    assert.equal(getCategory('nonexistent').id, 'other')
  })
})

describe('formatNumber', () => {
  it('null 返回 -', () => {
    assert.equal(formatNumber(null), '-')
  })
  it('小于 1000 原样返回', () => {
    assert.equal(formatNumber(42), '42')
    assert.equal(formatNumber(999), '999')
  })
  it('千位转 k', () => {
    assert.equal(formatNumber(1200), '1.2k')
    assert.equal(formatNumber(1500), '1.5k')
  })
  it('万位取整', () => {
    assert.equal(formatNumber(12000), '12k')
    assert.equal(formatNumber(15000), '15k')
  })
  it('正好 1000 转 1k', () => {
    assert.equal(formatNumber(1000), '1k')
  })
})

describe('relativeDate', () => {
  it('空字符串返回空', () => {
    assert.equal(relativeDate(''), '')
    assert.equal(relativeDate(null), '')
  })
  it('非法日期返回空', () => {
    assert.equal(relativeDate('not-a-date'), '')
  })
  it('未来日期返回今天更新', () => {
    const future = new Date(Date.now() + 3600000).toISOString()
    assert.equal(relativeDate(future), '今天更新')
  })
  it('1 天前返回昨天更新', () => {
    const past = new Date(Date.now() - 1.5 * 86400000).toISOString()
    assert.equal(relativeDate(past), '昨天更新')
  })
})

describe('langColor', () => {
  it('已知语言返回对应色值', () => {
    assert.equal(langColor('TypeScript'), '#3178c6')
  })
  it('未知语言返回默认灰色', () => {
    assert.equal(langColor('Brainfuck'), '#64748b')
  })
  it('空值返回默认灰色', () => {
    assert.equal(langColor(null), '#64748b')
  })
})

describe('extractRepos', () => {
  it('从 markdown 提取 owner/repo', () => {
    const md = '- [foo](https://github.com/userA/repoA) and [bar](https://github.com/userB/repoB)'
    const result = extractRepos(md)
    assert.ok(result.includes('userA/repoA'))
    assert.ok(result.includes('userB/repoB'))
  })
  it('过滤非仓库段(issues/pull/blob 等)', () => {
    const md = 'see [issues](https://github.com/userA/repoA/issues) and [tree](https://github.com/userB/repoB/tree/main)'
    const result = extractRepos(md)
    // owner/repo 本身应被提取,但非仓库段不应产生额外条目
    assert.ok(result.includes('userA/repoA'))
    assert.ok(result.includes('userB/repoB'))
    assert.ok(!result.some(x => x.includes('issues')))
    assert.ok(!result.some(x => x.includes('tree')))
  })
  it('去重相同仓库', () => {
    const md = '[a](https://github.com/user/repo) [b](https://github.com/user/repo)'
    const result = extractRepos(md)
    assert.equal(result.filter(x => x === 'user/repo').length, 1)
  })
  it('空字符串返回空数组', () => {
    assert.deepEqual(extractRepos(''), [])
  })
  it('剥离 .git 后缀', () => {
    const md = 'clone https://github.com/user/repo.git'
    const result = extractRepos(md)
    assert.ok(result.includes('user/repo'))
    assert.ok(!result.some(x => x.endsWith('.git')))
  })
})

describe('activeSponsors', () => {
  const base = { id: 'a', name: 'a', url: 'https://example.com', placement: 'card' }
  it('过滤已过期赞助', () => {
    assert.equal(activeSponsors([{ ...base, expiresAt: '2020-01-01' }]).length, 0)
  })
  it('保留未过期赞助', () => {
    assert.equal(activeSponsors([{ ...base, expiresAt: '2099-01-01' }]).length, 1)
  })
  it('到期当天仍生效', () => {
    const now = new Date('2026-08-14T10:00:00')
    assert.equal(activeSponsors([{ ...base, expiresAt: '2026-08-14' }], now).length, 1)
  })
  it('非法日期被剔除', () => {
    assert.equal(activeSponsors([{ ...base, expiresAt: 'not-a-date' }]).length, 0)
  })
  it('缺必填字段的条目被剔除', () => {
    assert.equal(activeSponsors([{ expiresAt: '2099-01-01' }, null]).length, 0)
  })
  it('非数组输入返回空', () => {
    assert.deepEqual(activeSponsors(null), [])
  })
})

describe('sponsorFor', () => {
  const list = [
    { id: 'r1', name: 'r', url: 'https://example.com', placement: 'ranking', expiresAt: '2099-01-01' },
    { id: 'c1', name: 'c', url: 'https://example.com', placement: 'card', expiresAt: '2099-01-01' },
  ]
  it('按 placement 取对应赞助', () => {
    assert.equal(sponsorFor(list, 'card').id, 'c1')
    assert.equal(sponsorFor(list, 'ranking').id, 'r1')
  })
  it('无匹配返回 null', () => {
    assert.equal(sponsorFor(list, 'footer'), null)
  })
  it('过期赞助不会被取出', () => {
    const expired = [{ id: 'x', name: 'x', url: 'u', placement: 'card', expiresAt: '2020-01-01' }]
    assert.equal(sponsorFor(expired, 'card'), null)
  })
})
