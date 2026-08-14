import { createContext, useContext, useState, useEffect } from 'react'

const LanguageContext = createContext()

const SUPPORTED = ['zh', 'en']

function detect() {
  if (typeof window === 'undefined') return 'zh'
  const saved = localStorage.getItem('dsh-lang')
  if (saved && SUPPORTED.includes(saved)) return saved
  const nav = navigator.language?.toLowerCase() || ''
  return nav.startsWith('en') ? 'en' : 'zh'
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('zh')

  useEffect(() => {
    setLang(detect())
  }, [])

  const change = (l) => {
    setLang(l)
    try {
      localStorage.setItem('dsh-lang', l)
    } catch {
      // 忽略
    }
  }

  const toggle = () => change(lang === 'zh' ? 'en' : 'zh')

  return (
    <LanguageContext.Provider value={{ lang, change, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLang() {
  const ctx = useContext(LanguageContext)
  return ctx || { lang: 'zh', change: () => {}, toggle: () => {} }
}
