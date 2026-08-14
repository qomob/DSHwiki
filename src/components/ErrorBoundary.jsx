import { Component } from 'react'

// 全局错误边界：任何子树抛错时显示降级 UI，避免整页白屏
// 尤其保护 repos.json 数据异常导致的运行时崩溃
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error?.message || '未知错误' }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary 捕获:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, message: '' })
    if (typeof window !== 'undefined') window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid min-h-screen place-items-center bg-bg px-6 text-center">
          <div className="max-w-md">
            <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-border-subtle bg-surface-1">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-fg-muted">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
            </div>
            <h1 className="text-lg font-medium text-fg">页面出了点问题</h1>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">
              数据加载或渲染时发生异常。通常刷新即可恢复；如果反复出现,可能是每日聚合数据异常,请稍后再试。
            </p>
            <p className="mt-3 break-words rounded-[10px] border border-border-subtle bg-surface-2 px-3 py-2 text-left font-mono text-[11px] text-fg-dim">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="ds-btn-primary mt-5 inline-flex items-center gap-2"
            >
              刷新重试
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
