import { useEffect, useRef } from 'react'
import { Footer } from './components/Footer'
import { Header } from './components/Header'
import { nav } from './content/site'
import { usePageTitle, useRoute } from './lib/route'
import { Complementares } from './pages/Complementares'
import { Contato } from './pages/Contato'
import { Documentos } from './pages/Documentos'
import { Grade } from './pages/Grade'
import { Home } from './pages/Home'
import { Integrantes } from './pages/Integrantes'
import { NaoEncontrada } from './pages/NaoEncontrada'
import { Sobre } from './pages/Sobre'

export default function App() {
  const route = useRoute()
  const first = useRef(true)
  const label = nav.find((n) => n.page === route.page)?.label ?? ''
  usePageTitle(route.page === 'inicio' ? '' : label || 'Página não encontrada')

  // A cada troca de página: volta ao topo e leva o foco ao título, para leitores de tela e teclado.
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    window.scrollTo({ top: 0, behavior: 'auto' })
    document.getElementById('titulo-pagina')?.focus({ preventScroll: true })
  }, [route.page])

  let page
  switch (route.page) {
    case 'inicio': page = <Home />; break
    case 'sobre': page = <Sobre />; break
    case 'integrantes': page = <Integrantes />; break
    case 'grade': page = <Grade />; break
    case 'documentos': page = <Documentos />; break
    case 'complementares': page = <Complementares />; break
    case 'contato': page = <Contato />; break
    default: page = <NaoEncontrada />
  }

  return (
    <>
      <a href="#conteudo" onClick={(e) => { e.preventDefault(); document.getElementById('conteudo')?.focus() }} className="fixed left-3 top-3 z-[70] -translate-y-24 rounded-md bg-orange px-4 py-2 font-semibold text-night focus:translate-y-0">
        Ir para o conteúdo
      </a>
      <Header route={route} />
      <main key={route.page} id="conteudo" tabIndex={-1} className="page-in outline-none">{page}</main>
      <Footer />
    </>
  )
}
