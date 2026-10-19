import { useState } from 'react'
import { DocRow } from '../components/cards'
import { Icon } from '../components/Icon'
import { Chips, EmptyState, PageHeader } from '../components/ui'
import { docCategories } from '../content/documents'
import { norm } from '../lib/text'
import { getDocuments } from '../services/content'
import type { DocCategory } from '../types'

type Filter = 'todos' | DocCategory

export function Documentos() {
  const docs = getDocuments()
  const [filter, setFilter] = useState<Filter>('todos')
  const [q, setQ] = useState('')
  const matches = (d: (typeof docs)[number]) => !q || norm(`${d.title} ${d.description}`).includes(norm(q))
  const cats = docCategories.filter((c) => filter === 'todos' || c === filter)

  return (
    <>
      <PageHeader eyebrow="Transparência" title="Documentos" lead="Estatuto, atas, editais, relatórios e outros arquivos da gestão. Só aparece aqui o que foi publicado de verdade." />
      <div className="wrap py-[clamp(2rem,6vw,4rem)]">
        <div className="grid gap-5">
          <div className="relative max-w-md">
            <label htmlFor="busca-doc" className="eyebrow mb-2 block text-muted">Buscar documento</label>
            <Icon name="search" size={18} className="pointer-events-none absolute bottom-3.5 left-3.5 text-muted" />
            <input
              id="busca-doc"
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Título ou assunto"
              className="min-h-[46px] w-full rounded-md border border-line bg-surface py-2 pl-10 pr-3 text-fg placeholder:text-muted"
            />
          </div>
          <Chips<Filter>
            label="Filtrar por categoria"
            value={filter}
            onChange={setFilter}
            options={[{ value: 'todos', label: 'Todas' }, ...docCategories.map((c) => ({ value: c, label: c }))]}
          />
        </div>

        <div className="mt-10 space-y-10">
          {cats.map((c) => {
            const list = docs.filter((d) => d.category === c && matches(d))
            if (q && list.length === 0) return null
            return (
              <section key={c} aria-labelledby={`cat-${c}`}>
                <h2 id={`cat-${c}`} className="display mb-4 text-xl md:text-2xl">{c}</h2>
                {list.length > 0 ? (
                  <ul className="grid gap-3">{list.map((d) => <DocRow key={d.id} doc={d} />)}</ul>
                ) : (
                  <EmptyState title="Nenhum arquivo publicado nesta categoria ainda">A gestão publica os arquivos conforme forem disponibilizados.</EmptyState>
                )}
              </section>
            )
          })}
          {q && cats.every((c) => docs.filter((d) => d.category === c && matches(d)).length === 0) && (
            <EmptyState title="Nada encontrado para essa busca">Tente outra palavra ou limpe o campo.</EmptyState>
          )}
        </div>
      </div>
    </>
  )
}
