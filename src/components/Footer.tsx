import { nav, placeholders, site } from '../content/site'
import { LogoMark, Wordmark } from './Logo'
import { Placeholder } from './ui'

export function Footer() {
  return (
    <footer className="on-dark border-t-4 border-orange bg-night text-white">
      <div className="wrap grid gap-10 py-[clamp(2.5rem,6vw,3.5rem)] md:grid-cols-[1.3fr_1fr_1fr]">
        <div className="min-w-0">
          <a href="#inicio" className="inline-flex min-h-[44px] items-center gap-3">
            <LogoMark className="h-11 w-auto" />
            <Wordmark />
          </a>
          <p className="mt-5 max-w-[40ch] text-sm text-white/70">
            {site.name}. Representação e integração dos estudantes do curso.
          </p>
          <p className="eyebrow mt-5 text-white/60">
            {site.institution} · {site.campus}
          </p>
        </div>

        <nav aria-label="Navegação do rodapé">
          <h2 className="eyebrow !text-white/60">Páginas</h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 text-sm">
            {nav.map((item) => (
              <li key={item.page}>
                <a href={`#${item.page}`} className="inline-block py-3 text-white/85 underline-offset-4 transition-colors hover:text-orange hover:underline">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="eyebrow !text-white/60">Contato e redes</h2>
          <ul className="mt-4 space-y-2 text-sm text-white/85">
            <li>{site.email ? <span className="select-all">{site.email}</span> : <Placeholder>{placeholders.email}</Placeholder>}</li>
            <li>{site.instagram ? <span className="select-all">{site.instagram}</span> : <Placeholder>{placeholders.instagram}</Placeholder>}</li>
            <li>{site.location ? site.location : <Placeholder>{placeholders.location}</Placeholder>}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-graphite">
        <div className="wrap flex flex-wrap items-center justify-between gap-2 py-5 text-xs text-white/60">
          <p>© {new Date().getFullYear()} {site.name}</p>
          <p>{site.institutionShort} · {site.campus} · Alegre, ES</p>
        </div>
      </div>
    </footer>
  )
}
