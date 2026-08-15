// 推广/赞助标识徽章——琥珀色与品牌蓝区分，满足广告可识别性要求
export default function AdBadge({ label }) {
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-pill border px-1.5 py-0.5 text-[10px] leading-none"
      style={{ color: '#e8b04b', borderColor: 'rgba(232, 176, 75, 0.45)' }}
    >
      {label}
    </span>
  )
}
