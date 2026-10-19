import { useMemo, useState } from 'react'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/ui'
import { norm } from '../lib/text'
import { MAX_CH, complementares, complementaresSource } from '../content/complementares'
import type { Complementar } from '../types'

type Sort = 'relatorio' | 'codigo' | 'ch-desc' | 'ch-asc'
const typeLabel = (a: Pick<Complementar, 'type' | 'typeTruncated'>) => (a.typeTruncated ? `${a.type}…` : a.type)

const types = Array.from(new Map(complementares.map((a) => [a.type, a])).values()).sort((a, b) => a.type.localeCompare(b.type, 'pt-BR'))
const highlights = ['ATV01609', 'ATV01635'].map((c) => complementares.find((a) => a.code === c)!)

function Hours({ ch }: { ch: number | null }) {
  if (ch === null) {
    return (
      <p className="font-mono text-sm text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">Carga horária em branco no relatório</span>
      </p>
    )
  }
  return (
    <div className="flex items-center gap-3" aria-label={`Carga horária total: ${ch} horas`}>
      <div className="h-2 flex-1 rounded-full bg-sand" aria-hidden="true">
        <div className="h-full rounded-full bg-orange" style={{ width: `${(ch / MAX_CH) * 100}%` }} />
      </div>
      <p className="w-14 shrink-0 text-right font-mono text-sm font-bold tabular-nums text-ink">{ch} h</p>
    </div>
  )
}

function Cut() {
  return (
    <span className="text-muted" title="O relatório da UFES corta o texto neste ponto">
      …<span className="sr-only"> (texto cortado no relatório original)</span>
    </span>
  )
}

function Row({ a }: { a: Complementar }) {
  return (
    <li className="grid min-w-0 gap-x-6 gap-y-2 border-b border-line px-4 py-4 lg:grid-cols-[6.5rem_minmax(0,1fr)_14rem_11rem] lg:items-center lg:px-5">
      <p className="font-mono text-xs font-medium text-muted">{a.code}</p>
      <p className="min-w-0 text-[0.98rem] text-ink">
        {a.description}
        {a.truncated && <Cut />}
      </p>
      <p className="min-w-0 text-sm text-muted">
        <span className="eyebrow mr-2 text-[0.6rem] lg:hidden">Tipo</span>
        {typeLabel(a)}
      </p>
      <Hours ch={a.ch} />
    </li>
  )
}

export function Complementares() {
  const [q, setQ] = useState('')
  const [type, setType] = useState('todos')
  const [sort, setSort] = useState<Sort>('relatorio')

  const rows = useMemo(() => {
    const nq = norm(q.trim())
    const list = complementares.filter(
      (a) => (type === 'todos' || a.type === type) && (!nq || norm(`${a.code} ${a.description} ${a.type}`).includes(nq)),
    )
    if (sort === 'relatorio') return list
    const sorted = [...list]
    if (sort === 'codigo') sorted.sort((a, b) => a.code.localeCompare(b.code))
    else {
      const dir = sort === 'ch-desc' ? -1 : 1
      sorted.sort((a, b) => {
        if (a.ch === null) return 1
        if (b.ch === null) return -1
        return (a.ch - b.ch) * dir
      })
    }
    return sorted
  }, [q, type, sort])

  const control = 'min-h-[46px] w-full rounded-md border border-line bg-surface px-3 text-fg'

  return (
    <>
      <PageHeader
        eyebrow="Horas complementares"
        title="Atividades complementares"
        lead="O que pode virar horas complementares no curso, com a carga horária de cada atividade, conforme o relatório do Colegiado emitido pela UFES."
      />
      <div className="wrap py-[clamp(2rem,6vw,4rem)]">
        <aside className="flex flex-wrap items-start gap-x-8 gap-y-3 rounded-lg bg-night p-5 text-white on-dark" aria-label="Origem dos dados">
          <Icon name="file" size={26} className="mt-0.5 shrink-0 text-orange" />
          <div className="min-w-0 flex-1">
            <p className="eyebrow text-[0.68rem] text-orange">Fonte</p>
            <p className="mt-1 font-mono text-sm text-white">
              {complementaresSource.report}
            </p>
            <p className="mt-1 text-sm text-white/75">
              {complementaresSource.unit} · emitido em {complementaresSource.issuedAt} · {complementaresSource.total} atividades. Relatório de 2020: confirme com o Colegiado se as regras continuam valendo.
            </p>
          </div>
        </aside>

        <section aria-labelledby="destaques-t" className="mt-10">
          <h2 id="destaques-t" className="display text-xl md:text-2xl">Atuação no CA e em empresas juniores</h2>
          <ul className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(min(100%,19rem),1fr))] gap-4">
            {highlights.map((a) => (
              <li key={a.code} className="min-w-0 rounded-lg border-2 border-ink bg-surface p-5">
                <p className="font-mono text-xs text-muted">{a.code}</p>
                <p className="mt-2 text-lg font-semibold text-ink">
                  {a.description}
                  {a.truncated && <Cut />}
                </p>
                <p className="mt-3 text-sm text-muted">{typeLabel(a)}</p>
                <div className="mt-3"><Hours ch={a.ch} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="lista-t" className="mt-14">
          <h2 id="lista-t" className="display text-xl md:text-2xl">Lista completa</h2>
          <form className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-4" role="search" aria-label="Filtrar atividades" onSubmit={(e) => e.preventDefault()}>
            <div>
              <label htmlFor="busca-atv" className="eyebrow mb-2 block text-muted">Buscar</label>
              <input id="busca-atv" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Monitoria, estágio, ATV01609…" className={control} />
            </div>
            <div>
              <label htmlFor="tipo-atv" className="eyebrow mb-2 block text-muted">Tipo de atividade</label>
              <select id="tipo-atv" value={type} onChange={(e) => setType(e.target.value)} className={control}>
                <option value="todos">Todos os tipos</option>
                {types.map((t) => (
                  <option key={t.type} value={t.type}>{typeLabel(t)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="ordem-atv" className="eyebrow mb-2 block text-muted">Ordenar por</label>
              <select id="ordem-atv" value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={control}>
                <option value="relatorio">Ordem do relatório</option>
                <option value="codigo">Código</option>
                <option value="ch-desc">Maior carga horária</option>
                <option value="ch-asc">Menor carga horária</option>
              </select>
            </div>
          </form>
          <p className="mt-4 text-sm text-muted" role="status" aria-live="polite">
            {rows.length} de {complementares.length} atividades
          </p>

          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface">
            <div className="eyebrow hidden grid-cols-[6.5rem_minmax(0,1fr)_14rem_11rem] gap-x-6 border-b border-line bg-surface-2 px-5 py-3 text-[0.66rem] text-muted lg:grid">
              <span>Código</span>
              <span>Atividade</span>
              <span>Tipo</span>
              <span className="text-right">CH total</span>
            </div>
            {rows.length > 0 ? (
              <ul>{rows.map((a) => <Row key={a.code} a={a} />)}</ul>
            ) : (
              <p className="p-8 text-center text-muted">Nenhuma atividade encontrada. Tente outra palavra ou outro tipo.</p>
            )}
          </div>

          <ul className="mt-5 space-y-1.5 text-sm text-muted">
            <li><span className="font-bold text-ink">…</span> indica texto cortado no relatório original. O enunciado completo está com o Colegiado.</li>
            <li><span className="font-bold text-ink">—</span> indica carga horária em branco no relatório (atividades ATV01604 e ATV01606).</li>
            <li>As barras comparam as cargas horárias entre si; a maior do relatório é {MAX_CH} h.</li>
          </ul>
        </section>
      </div>
    </>
  )
}
