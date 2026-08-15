// API 供应商推荐位配置（P0 变现 · 联盟分销）
// 价格核对于 2026-08-14，来源：
//   DeepSeek   https://api-docs.deepseek.com/zh-cn/quick_start/pricing
//   硅基流动    https://siliconflow.cn/pricing
//   OpenRouter https://openrouter.ai/deepseek/deepseek-v4-flash（官方 DeepSeek 渠道价）
// 注意：DeepSeek 将于 2026-08-17 起实行峰谷定价——flash 闲时 输入¥1.5/输出¥4.5，
//   高峰 ¥3/¥9；届时需更新下方 price 与 ui.js 里的 note。
//
// 联盟现状（2026-08 核实）：
//   - 仅硅基流动有邀请返利：经邀请链接注册双方各得 ¥14
//   - DeepSeek 官方无联盟计划，保持自然链接
//   - OpenRouter referral 仅返平台额度（且需被邀人消费满 $10），暂不接入
// 上线步骤：把 SILICONFLOW_INVITE_CODE 换成你账号后台的邀请码
//   （cloud.siliconflow.cn → 个人中心 → 邀请好友），链接自动变为推广链；
//   留空则为自然链接，不携带推广标识。

const SILICONFLOW_INVITE_CODE = ''

export const API_PROVIDERS = [
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    affiliate: false,
    model: 'deepseek-v4-flash',
    price: { zh: '¥1 / ¥2', en: '¥1 / ¥2' },
    bonus: { zh: '官方直连渠道', en: 'Official channel' },
    baseUrl: 'https://api.deepseek.com',
    url: 'https://platform.deepseek.com',
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    affiliate: Boolean(SILICONFLOW_INVITE_CODE),
    model: 'deepseek-ai/DeepSeek-V4-Flash',
    price: { zh: '¥1 / ¥2', en: '¥1 / ¥2' },
    bonus: { zh: '新用户赠 ¥14', en: '¥14 signup credit' },
    baseUrl: 'https://api.siliconflow.cn',
    url: SILICONFLOW_INVITE_CODE
      ? `https://cloud.siliconflow.cn/i/${SILICONFLOW_INVITE_CODE}`
      : 'https://cloud.siliconflow.cn',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    affiliate: false,
    model: 'deepseek/deepseek-v4-flash',
    price: { zh: '$0.14 / $0.28', en: '$0.14 / $0.28' },
    bonus: { zh: '新用户赠 $1 额度', en: '$1 signup credit' },
    baseUrl: 'https://openrouter.ai/api/v1',
    url: 'https://openrouter.ai',
  },
]
