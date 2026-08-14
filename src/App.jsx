import Navbar from './components/Navbar'
import Hero from './components/Hero'
import StatsBar from './components/StatsBar'
import BlueprintSection from './components/BlueprintSection'
import HubSection from './components/HubSection'
import Footer from './components/Footer'
import repoData from './data/repos.json'

// 防御聚合数据异常：确保 repos / stats 至少是合法结构
const safeData = {
  repos: Array.isArray(repoData?.repos) ? repoData.repos : [],
  stats: repoData?.stats && typeof repoData.stats === 'object' ? repoData.stats : {},
  generatedAt: typeof repoData?.generatedAt === 'string' ? repoData.generatedAt : null,
}

export default function App() {
  return (
    <div className="min-h-screen bg-bg text-fg">
      <Navbar />
      <main>
        <Hero />
        <StatsBar stats={safeData.stats} generatedAt={safeData.generatedAt} />
        <BlueprintSection />
        <HubSection />
      </main>
      <Footer />
    </div>
  )
}
