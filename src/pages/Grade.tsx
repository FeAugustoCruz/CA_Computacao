import { useState } from 'react'
import { Icon } from '../components/Icon'
import { PageHeader } from '../components/ui'
import { curriculoSource, disciplinas } from '../content/curriculo'
import { norm } from '../lib/text'
import { useConcluidas } from '../lib/useConcluidas'
import type { Disciplina } from '../types'

const byCode = new Map(disciplinas.map((d) => [d.code, d]))
const VALID = new Set(byCode.keys())
const obrigatorias = disciplinas.filter((d) => d.kind === 'OB')
const optativas = disciplinas.filter((d) => d.kind === 'OP').sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
const periodos = Array.from({ length: Math.max(...obrigatorias.map((d) => d.period ?? 0)) }, (_, i) => i + 1).map((p) => ({
  p,
  items: obrigatorias.filter((d) => d.period === p),
}))
const sumCr = (list: Disciplina[]) => list.reduce((s, d) => s + d.credits, 0)
const TOTAL_CR = sumCr(obrigatorias)
const cr = (n: number) => `${n} ${n === 1 ? 'crédito' : 'créditos'}`

function Pre({ d, done }: { d: Disciplina; done: Set<string> }) {
  const lines: string[] = []
  if (d.minPeriod) lines.push(`Ter vencido o ${d.minPeriod}º período`)
  if (d.minCredits) lines.push(`Mínimo de ${d.minCredits} créditos`)
  const reqs = d.prereqs.map((c) => byCode.get(c)).filter((x): x is Disciplina => !!x)
  if (lines.length === 0 && reqs.length === 0) return <span className="mt-2 block text-[0.78rem] opacity-80">Sem pré-requisito</span>
  return (
    <span className="mt-2 block space-y-0.5 text-[0.78rem]">
      <span className="eyebrow block text-[0.6rem] opacity-80">Pré-requisitos</span>
      {reqs.map((r) => (
        <span key={r.code} className="flex items-start gap-1.5">
          <Icon name={done.has(r.code) ? 'check' : 'close'} size={13} className="mt-[3px] shrink-0" />
          <span>
            {r.name}
            <span className="sr-only">{done.has(r.code) ? ' (concluída)' : ' (ainda não concluída)'}</span>
          </span>
        </span>
      ))}
      {lines.map((l) => (
        <span key={l} className="block">{l}</span>
      ))}
    </span>
  )
}

function DisciplinaBtn({ d, done, onToggle, showPre }: { d: Disciplina; done: Set<string>; onToggle: (c: string) => void; showPre: boolean }) {
  const on = done.has(d.code)
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={() => onToggle(d.code)}
      className={`flex min-h-[56px] w-full items-start gap-3 rounded-md border-2 px-3 py-2.5 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.98] ${
        on ? 'border-orange bg-orange text-night' : 'border-line bg-surface text-fg hover:border-ink'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[5px] border-2 transition-colors duration-150 ${
          on ? 'border-night bg-night text-orange' : 'border-muted bg-transparent text-transparent'
        }`}
      >
        <Icon name="check" size={15} strokeWidth={2.6} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold leading-snug [overflow-wrap:anywhere]">{d.name}</span>
        <span className={`mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.7rem] tabular-nums ${on ? 'text-night/80' : 'text-muted'}`}>
          <span>{d.code}</span>
          <span aria-hidden="true">·</span>
          <span>{cr(d.credits)}</span>
          {d.special && (
            <span className={`eyebrow rounded-sm px-1.5 py-0.5 text-[0.58rem] ${on ? 'bg-night text-orange' : 'bg-night text-white'}`}>{d.special}</span>
          )}
        </span>
        {showPre && <Pre d={d} done={done} />}
      </span>
    </button>
  )
}

function Bar({ value, max, label, thin = false }: { value: number; max: number; label: string; thin?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={`overflow-hidden rounded-full bg-sand ${thin ? 'h-2' : 'h-3.5'}`}
    >
      <div className="h-full origin-left rounded-full bg-orange transition-transform duration-500 ease-out" style={{ transform: `scaleX(${max ? value / max : 0})` }} />
    </div>
  )
}

export function Grade() {
  const { done, toggle, setMany, clear, saveFailed } = useConcluidas(VALID)
  const [showPre, setShowPre] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const [q, setQ] = useState('')

  const doneOb = obrigatorias.filter((d) => done.has(d.code))
  const pct = Math.round((doneOb.length / obrigatorias.length) * 100)
  const crDone = sumCr(doneOb)
  const optDone = optativas.filter((d) => done.has(d.code))
  const nq = norm(q.trim())
  const optShown = optativas.filter((d) => !nq || norm(`${d.name} ${d.code}`).includes(nq))
  const resumo = `${doneOb.length} de ${obrigatorias.length} disciplinas obrigatórias concluídas, ${pct}%`

  return (
    <>
      <PageHeader
        eyebrow="Acompanhamento"
        title="Grade curricular"
        lead="Marque as disciplinas que você já concluiu e veja quanto do curso de Ciência da Computação já foi feito."
      />

      <div className="wrap py-[clamp(2rem,6vw,4rem)]">
        {/* Progresso: fica visível ao rolar em telas grandes o bastante */}
        <section aria-labelledby="prog-t" className="sticky-progress rounded-lg border-2 border-ink bg-surface p-[clamp(1rem,3vw,1.5rem)] shadow-[0_6px_0_0_var(--sand)]">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
            <h2 id="prog-t" className="display text-lg md:text-xl">Seu progresso no curso</h2>
            <p className="display text-[clamp(1.8rem,5vw,2.6rem)] leading-none tabular-nums text-ink" aria-hidden="true">{pct}%</p>
          </div>
          <div className="mt-3">
            <Bar value={doneOb.length} max={obrigatorias.length} label="Disciplinas obrigatórias concluídas" />
          </div>
          <p className="mt-3 text-[0.95rem] font-semibold tabular-nums text-ink">
            {doneOb.length} de {obrigatorias.length} disciplinas obrigatórias
          </p>
          <div className="mt-3 grid gap-x-6 gap-y-2 text-sm text-muted sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0">
              <Bar value={crDone} max={TOTAL_CR} label="Créditos obrigatórios concluídos" thin />
            </div>
            <p className="tabular-nums">{crDone} de {TOTAL_CR} créditos</p>
          </div>
          <p className="mt-2 text-sm text-muted tabular-nums">
            Optativas concluídas: {optDone.length} ({cr(sumCr(optDone))}), fora da porcentagem.
          </p>
          <p className="sr-only" role="status" aria-live="polite">{resumo}</p>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 font-medium text-ink">
            <input id="mostrar-pre" type="checkbox" checked={showPre} onChange={(e) => setShowPre(e.target.checked)} className="h-5 w-5 accent-[#F26F20]" />
            Mostrar pré-requisitos
          </label>

          {!confirmClear ? (
            <button
              type="button"
              disabled={done.size === 0}
              onClick={() => setConfirmClear(true)}
              className="inline-flex min-h-[44px] items-center rounded-md border border-line bg-surface px-4 text-sm font-semibold text-fg transition-[border-color,transform] duration-150 hover:border-ink active:scale-[0.97] disabled:opacity-50 disabled:hover:border-line"
            >
              Limpar marcações
            </button>
          ) : (
            <div role="alertdialog" aria-label="Confirmar limpeza das marcações" className="flex flex-wrap items-center gap-2 rounded-md border-2 border-ink bg-surface p-2 pl-3">
              <p className="text-sm font-medium text-ink">Desmarcar {done.size} {done.size === 1 ? 'disciplina' : 'disciplinas'}?</p>
              <button
                type="button"
                autoFocus
                onClick={() => { clear(); setConfirmClear(false) }}
                className="inline-flex min-h-[44px] items-center rounded-md bg-night px-4 text-sm font-semibold text-white transition-transform active:scale-[0.97] on-dark"
              >
                Sim, limpar
              </button>
              <button type="button" onClick={() => setConfirmClear(false)} className="inline-flex min-h-[44px] items-center rounded-md border border-line px-4 text-sm font-semibold text-fg active:scale-[0.97]">
                Cancelar
              </button>
            </div>
          )}
        </div>

        <p className="mt-3 max-w-[70ch] text-sm text-muted">
          {saveFailed
            ? 'Este navegador bloqueou o armazenamento: suas marcações valem só nesta visita e não serão lembradas.'
            : 'Suas marcações ficam salvas só neste navegador e neste aparelho. Não há conta nem envio de dados.'}
        </p>

        <section aria-labelledby="ob-t" className="mt-10">
          <h2 id="ob-t" className="display text-2xl md:text-3xl">Disciplinas obrigatórias</h2>
          <p className="mt-2 max-w-[70ch] text-muted">
            Por período sugerido. Estágio e Trabalho de Conclusão de Curso também contam como obrigatórios.
          </p>
          <div className="mt-6 grid grid-cols-[repeat(auto-fill,minmax(min(100%,16rem),1fr))] items-start gap-4">
            {periodos.map(({ p, items }) => {
              const codes = items.map((d) => d.code)
              const n = items.filter((d) => done.has(d.code)).length
              const all = n === items.length
              return (
                <section key={p} aria-labelledby={`per-${p}`} className="min-w-0 rounded-lg border border-line bg-surface-2 p-3">
                  <div className="flex items-start justify-between gap-2 px-1">
                    <div>
                      <h3 id={`per-${p}`} className="display text-lg">{p}º período</h3>
                      <p className="eyebrow mt-1 text-[0.64rem] tabular-nums text-muted">{n} de {items.length} concluídas</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMany(codes, !all)}
                      className="-mr-1 inline-flex min-h-[44px] items-center whitespace-nowrap px-2 text-sm font-semibold text-accent-text underline decoration-2 underline-offset-4"
                    >
                      {all ? 'Desmarcar' : 'Marcar todas'}
                    </button>
                  </div>
                  <ul className="mt-1 grid gap-2">
                    {items.map((d) => (
                      <li key={d.code}>
                        <DisciplinaBtn d={d} done={done} onToggle={toggle} showPre={showPre} />
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </div>
        </section>

        <section aria-labelledby="op-t" className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div className="min-w-0">
              <h2 id="op-t" className="display text-2xl md:text-3xl">Optativas</h2>
              <p className="mt-2 max-w-[70ch] text-muted">
                Marque as que você já cursou. O currículo não informa quantas optativas são exigidas, por isso elas ficam fora da porcentagem.
              </p>
            </div>
            <p className="eyebrow tabular-nums text-muted">{optDone.length} de {optativas.length} marcadas</p>
          </div>

          <div className="mt-5 max-w-md">
            <label htmlFor="busca-opt" className="eyebrow mb-2 block text-muted">Buscar optativa</label>
            <div className="relative">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="busca-opt"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nome ou código"
                className="min-h-[46px] w-full rounded-md border border-line bg-surface py-2 pl-10 pr-3 text-fg placeholder:text-muted"
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted" role="status" aria-live="polite">{optShown.length} de {optativas.length} optativas</p>

          <ul className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(min(100%,17rem),1fr))] gap-2">
            {optShown.map((d) => (
              <li key={d.code}>
                <DisciplinaBtn d={d} done={done} onToggle={toggle} showPre={showPre} />
              </li>
            ))}
          </ul>
          {optShown.length === 0 && <p className="mt-4 rounded-md border border-dashed border-line bg-surface p-6 text-center text-muted">Nenhuma optativa encontrada. Tente outra palavra.</p>}
        </section>

        <aside aria-label="Origem dos dados" className="on-dark mt-14 flex items-start gap-4 rounded-lg bg-night p-5 text-white">
          <Icon name="file" size={26} className="mt-0.5 shrink-0 text-orange" />
          <div className="min-w-0 text-sm">
            <p className="eyebrow text-[0.68rem] text-orange">Fonte</p>
            <p className="mt-1 font-mono text-white">UFES · Currículo de Cursos · {curriculoSource.course}</p>
            <p className="mt-1 text-white/75">
              Versão {curriculoSource.version}, documento emitido em {curriculoSource.issuedAt}. Esta página é uma ajuda de acompanhamento e não substitui o histórico acadêmico nem a orientação do Colegiado.
              As horas de atividades complementares não entram na porcentagem: veja a <a className="underline underline-offset-4 hover:text-orange" href="#complementares">lista de atividades complementares</a>.
            </p>
          </div>
        </aside>
      </div>
    </>
  )
}
