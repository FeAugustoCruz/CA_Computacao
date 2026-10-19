import { ArrowLink, ButtonLink, Section } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'
import { complementares, complementaresSource } from '../content/complementares'
import { docCategories } from '../content/documents'
import { getDocuments } from '../services/content'

function Hero() {
  return (
    <section className="on-dark bg-night text-white" aria-labelledby="titulo-pagina">
      <div className="wrap py-[clamp(3rem,9vw,7rem)]">
        <p className="eyebrow rise text-orange">Ciência da Computação · UFES · Alegre</p>
        <h1
          id="titulo-pagina"
          tabIndex={-1}
          className="display rise mt-5 max-w-[18ch] text-[clamp(2.2rem,7vw,5rem)] leading-[1.02] !text-white outline-none"
          style={{ animationDelay: '70ms' }}
        >
          Representando estudantes. <span className="text-orange">Construindo o futuro da Computação.</span>
        </h1>
        <p className="rise mt-6 max-w-[56ch] text-[clamp(1rem,2.2vw,1.2rem)] text-white/80" style={{ animationDelay: '140ms' }}>
          Canal de comunicação entre o Centro Acadêmico e a turma: documentos, atividades complementares e as formas de participar da vida do curso.
        </p>
        <div className="rise mt-8 flex flex-wrap gap-3" style={{ animationDelay: '210ms' }}>
          <ButtonLink href="#sobre">Conheça o Centro Acadêmico</ButtonLink>
          <ButtonLink href="#complementares" variant="outline-dark">
            Veja as atividades complementares
          </ButtonLink>
        </div>
      </div>
    </section>
  )
}

const quick: { href: string; title: string; text: string; icon: IconName }[] = [
  { href: '#integrantes', title: 'Integrantes', text: 'Quem faz parte da gestão', icon: 'user' },
  { href: '#grade', title: 'Grade curricular', text: 'Marque as disciplinas e veja seu progresso', icon: 'grid' },
  { href: '#documentos', title: 'Documentos', text: 'Estatuto, atas, editais e relatórios', icon: 'file' },
  { href: '#complementares', title: 'Atividades complementares', text: `${complementares.length} atividades da lista da UFES`, icon: 'hours' },
  { href: '#contato', title: 'Contato', text: 'Dúvidas, sugestões e solicitações', icon: 'mail' },
]

export function Home() {
  const docs = getDocuments()
  const cA = complementares.find((a) => a.code === 'ATV01609')

  return (
    <>
      <Hero />

      <section aria-label="Acesso rápido" className="border-b border-line bg-sand">
        <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)]">
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-3">
            {quick.map((q) => (
              <li key={q.href}>
                <a href={q.href} className="flex h-full items-start gap-4 rounded-lg border border-line bg-surface p-4 transition-[border-color,transform] duration-200 hover:border-ink motion-safe:hover:-translate-y-0.5">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-night text-orange">
                    <Icon name={q.icon} size={20} />
                  </span>
                  <span className="min-w-0">
                    <span className="display block text-base leading-tight text-ink">{q.title}</span>
                    <span className="mt-1 block text-sm text-muted">{q.text}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section title="Documentos importantes" eyebrow="Transparência" action={<ArrowLink href="#documentos">Todos os documentos</ArrowLink>}>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-3">
          {docCategories.map((c) => {
            const n = docs.filter((d) => d.category === c).length
            return (
              <li key={c}>
                <a href="#documentos" className="flex h-full items-center justify-between gap-3 rounded-lg border border-line bg-surface p-4 transition-[border-color,transform] duration-200 hover:border-ink motion-safe:hover:-translate-y-0.5">
                  <span className="min-w-0 font-semibold text-ink">{c}</span>
                  <span className="eyebrow shrink-0 text-[0.62rem] text-muted">{n > 0 ? `${n} ${n === 1 ? 'arquivo' : 'arquivos'}` : 'A publicar'}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </Section>

      <section aria-labelledby="horas-t" className="bg-orange text-night">
        <div className="wrap flex flex-wrap items-center justify-between gap-x-10 gap-y-5 py-[clamp(2rem,5vw,3.5rem)]">
          <div className="min-w-0 max-w-[60ch] flex-1 basis-80">
            <h2 id="horas-t" className="display text-[clamp(1.4rem,3.4vw,2.2rem)] !text-night">
              Participar do Centro Acadêmico pode contar horas.
            </h2>
            <p className="mt-3 text-night/90">
              No relatório do Colegiado emitido em {complementaresSource.issuedAt}, a atividade {cA?.code} (participação efetiva em Diretórios e Centros Acadêmicos…) aparece com CH total de {cA?.ch}. Confirme as regras em vigor com o Colegiado.
            </p>
          </div>
          <a
            href="#complementares"
            className="inline-flex min-h-[46px] items-center gap-2 rounded-md border-2 border-night bg-night px-5 py-2.5 font-semibold text-white transition-colors hover:bg-transparent hover:text-night"
          >
            Ver a lista completa <Icon name="arrow" size={18} />
          </a>
        </div>
      </section>
    </>
  )
}
