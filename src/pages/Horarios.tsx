import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { Chips, EmptyState, PageHeader } from '../components/ui'
import { corLocal, horarios, paginasOficiais } from '../content/horarios'
import {
  DIAS,
  FILTROS_VAZIOS,
  PERIODOS,
  agrupar,
  chaveGrupo,
  contar,
  dispor,
  escala,
  estadoDados,
  faixa,
  filtrar,
  filtrosAtivos,
  fmtDataHora,
  localLabel,
  nomesPreReq,
  opcoes,
  periodoLabel,
  yDe,
  type Escala,
  type Filtros,
  type GrupoDisciplina,
} from '../lib/horarios'
import type { Aula, HorariosFonte } from '../types'

type Vista = 'tabela' | 'grade'

/* ------------------------------------------------------------------ utilidades */

/** true quando a janela tem pelo menos `px` de largura (a grade mostra todos os dias lado a lado). */
function useMinWidth(px: number): boolean {
  const query = `(min-width:${px}px)`
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => true,
  )
}

const MOTIVO_REVISAR = 'Esta aula foi associada ao curso só pelo nome, ou o código da planilha difere do currículo. Confirme na planilha oficial.'

function Etiqueta({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span title={title} className="eyebrow inline-flex items-center gap-1 whitespace-nowrap rounded-sm border border-orange bg-orange/15 px-1.5 py-0.5 text-[0.6rem] text-accent-text">
      {children}
    </span>
  )
}

function Aviso({ tom = 'aviso', titulo, children }: { tom?: 'aviso' | 'info'; titulo: string; children?: ReactNode }) {
  return (
    <div role="status" className={`flex items-start gap-3 rounded-md border-2 p-4 ${tom === 'aviso' ? 'border-orange bg-orange/10' : 'border-line bg-surface-2'}`}>
      <Icon name={tom === 'aviso' ? 'warning' : 'info'} size={22} className="mt-0.5 shrink-0 text-accent-text" />
      <div className="min-w-0 text-[0.95rem] text-fg">
        <p className="font-semibold text-ink">{titulo}</p>
        {children && <div className="mt-1 [overflow-wrap:anywhere]">{children}</div>}
      </div>
    </div>
  )
}

const campo = 'min-h-[44px] w-full rounded-md border border-line bg-surface px-3 text-fg focus-visible:border-ink'

function Campo({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="eyebrow mb-1.5 block text-[0.66rem] text-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

/* -------------------------------------------------------------------- filtros */

function PainelFiltros({ f, set, opts, ativos }: { f: Filtros; set: (p: Partial<Filtros>) => void; opts: ReturnType<typeof opcoes>; ativos: number }) {
  return (
    <form role="search" aria-label="Filtrar aulas" onSubmit={(e) => e.preventDefault()} className="rounded-lg border-2 border-ink bg-surface p-[clamp(1rem,3vw,1.5rem)]">
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <Campo id="f-q" label="Disciplina ou código">
            <div className="relative">
              <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input id="f-q" type="search" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Ex.: Banco de Dados ou COM10129" autoComplete="off" className={`${campo} pl-10`} />
            </div>
          </Campo>
        </div>
        <Campo id="f-dia" label="Dia da semana">
          <select id="f-dia" value={f.dia} onChange={(e) => set({ dia: Number(e.target.value) })} className={campo}>
            <option value={0}>Todos</option>
            {opts.dias.map((d) => (
              <option key={d} value={d}>{DIAS[d].longo}</option>
            ))}
          </select>
        </Campo>
        <Campo id="f-local" label="Prédio ou laboratório">
          <select id="f-local" value={f.local} onChange={(e) => set({ local: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {opts.locais.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </Campo>
        <Campo id="f-de" label="Começa a partir de">
          <select id="f-de" value={f.de} onChange={(e) => set({ de: e.target.value })} className={campo}>
            <option value="">Qualquer horário</option>
            {opts.horas.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </Campo>
        <Campo id="f-ate" label="Termina até">
          <select id="f-ate" value={f.ate} onChange={(e) => set({ ate: e.target.value })} className={campo}>
            <option value="">Qualquer horário</option>
            {opts.horas.map((h) => (
              <option key={h} value={h}>{h}</option>
            ))}
          </select>
        </Campo>
        <Campo id="f-periodo" label="Período do currículo">
          <select id="f-periodo" value={f.periodo} onChange={(e) => set({ periodo: e.target.value })} className={campo}>
            <option value="">Todos</option>
            {PERIODOS.map((p) => (
              <option key={p} value={String(p)}>{p}º período</option>
            ))}
            <option value="op">Optativas</option>
          </select>
        </Campo>
        {opts.turmas.length > 0 && (
          <Campo id="f-turma" label="Turma">
            <select id="f-turma" value={f.turma} onChange={(e) => set({ turma: e.target.value })} className={campo}>
              <option value="">Todas</option>
              {opts.turmas.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Campo>
        )}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <label className="inline-flex min-h-[44px] cursor-pointer items-center gap-3 font-medium text-ink">
          <input type="checkbox" checked={f.ocultarRevisar} onChange={(e) => set({ ocultarRevisar: e.target.checked })} className="h-5 w-5 accent-[#F26F20]" />
          Ocultar aulas a confirmar
        </label>
        <button
          type="button"
          disabled={ativos === 0}
          onClick={() => set({ ...FILTROS_VAZIOS })}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-semibold text-fg transition-[border-color,transform] duration-150 hover:border-ink active:scale-[0.97] disabled:opacity-50 disabled:hover:border-line"
        >
          <Icon name="close" size={16} />
          Limpar filtros{ativos > 0 ? ` (${ativos})` : ''}
        </button>
      </div>
    </form>
  )
}

/* --------------------------------------------------------------------- tabela */

function Ocorrencia({ a }: { a: Aula }) {
  return (
    <>
      <td className="px-3 py-2 align-top tabular-nums">{a.turma ?? <span className="text-muted">—</span>}</td>
      <td className="px-3 py-2 align-top">{DIAS[a.day].longo}</td>
      <td className="whitespace-nowrap px-3 py-2 align-top font-mono text-[0.85rem] tabular-nums">{faixa(a)}</td>
      <td className="px-3 py-2 align-top">
        <span className="[overflow-wrap:anywhere]">{localLabel(a)}</span>
        {(a.status === 'revisar' || a.issues.length > 0) && (
          <span className="mt-1 flex flex-wrap gap-1">
            {a.status === 'revisar' && <Etiqueta title={MOTIVO_REVISAR}>A confirmar</Etiqueta>}
            {a.issues.length > 0 && <Etiqueta title={a.issues.map((i) => i.text).join(' ')}>Aviso</Etiqueta>}
          </span>
        )}
      </td>
    </>
  )
}

function Tabela({ grupos, onAbrir }: { grupos: GrupoDisciplina[]; onAbrir: (key: string) => void }) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-line md:block">
      <table className="w-full min-w-[46rem] border-collapse text-left text-[0.92rem]">
        <caption className="sr-only">Disciplinas do curso com dia, horário e local de cada aula</caption>
        <thead className="bg-surface-2 text-[0.7rem]">
          <tr className="eyebrow text-muted">
            <th scope="col" className="px-3 py-2.5">Disciplina</th>
            <th scope="col" className="px-3 py-2.5">Código</th>
            <th scope="col" className="px-3 py-2.5">Turma</th>
            <th scope="col" className="px-3 py-2.5">Dia</th>
            <th scope="col" className="px-3 py-2.5">Horário</th>
            <th scope="col" className="px-3 py-2.5">Local</th>
          </tr>
        </thead>
        {grupos.map((g) => (
          <tbody key={g.key} className="border-t border-line">
            {g.aulas.map((a, i) => (
              <tr key={a.id} className={i > 0 ? 'border-t border-line/50' : ''}>
                {i === 0 && (
                  <>
                    <th scope="row" rowSpan={g.aulas.length} className="max-w-[20rem] bg-surface px-3 py-2 text-left align-top font-semibold">
                      <button type="button" onClick={() => onAbrir(g.key)} className="text-left font-semibold text-ink underline decoration-orange decoration-2 underline-offset-4 hover:text-accent-text">
                        {g.name}
                      </button>
                      {periodoLabel(g.info) && <span className="eyebrow mt-1 block text-[0.62rem] font-normal text-muted">{periodoLabel(g.info)}</span>}
                    </th>
                    <td rowSpan={g.aulas.length} className="bg-surface px-3 py-2 align-top font-mono text-[0.8rem] tabular-nums">
                      {g.code ?? <span className="text-muted">—</span>}
                    </td>
                  </>
                )}
                <Ocorrencia a={a} />
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  )
}

function Cartoes({ grupos, onAbrir }: { grupos: GrupoDisciplina[]; onAbrir: (key: string) => void }) {
  return (
    <ul className="grid gap-3 md:hidden">
      {grupos.map((g) => (
        <li key={g.key} className="rounded-lg border border-line bg-surface p-3">
          <button type="button" onClick={() => onAbrir(g.key)} className="block min-h-[44px] w-full text-left">
            <span className="block font-semibold leading-snug text-ink [overflow-wrap:anywhere]">{g.name}</span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[0.72rem] tabular-nums text-muted">
              {g.code && <span>{g.code}</span>}
              {periodoLabel(g.info) && <span className="eyebrow text-[0.6rem]">{periodoLabel(g.info)}</span>}
            </span>
          </button>
          <ul className="mt-2 grid gap-2">
            {g.aulas.map((a) => (
              <li key={a.id} className="rounded-md bg-surface-2 px-3 py-2 text-sm">
                <p className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="font-semibold text-ink">{DIAS[a.day].longo}</span>
                  <span className="font-mono tabular-nums">{faixa(a)}</span>
                </p>
                <p className="mt-0.5 text-fg [overflow-wrap:anywhere]">
                  {localLabel(a)}
                  {a.turma ? ` · turma ${a.turma}` : ''}
                </p>
                {(a.status === 'revisar' || a.issues.length > 0) && (
                  <p className="mt-1 flex flex-wrap gap-1">
                    {a.status === 'revisar' && <Etiqueta title={MOTIVO_REVISAR}>A confirmar</Etiqueta>}
                    {a.issues.length > 0 && <Etiqueta>Aviso</Etiqueta>}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------------------- grade */

const PX_MIN = 1.35

function ColunaDia({ aulas, esc, onAbrir, chaveDe }: { aulas: Aula[]; esc: Escala; onAbrir: (key: string) => void; chaveDe: (a: Aula) => string }) {
  const blocos = dispor(aulas)
  return (
    <div className="relative border-l border-line" style={{ height: esc.altura }}>
      {esc.trechos.filter((t) => t.vazio).map((t) => (
        <div key={t.y} aria-hidden="true" className="absolute inset-x-0 opacity-60" style={{ top: t.y, height: t.h, backgroundImage: 'repeating-linear-gradient(135deg, transparent 0 6px, var(--line) 6px 7px)' }} />
      ))}
      {esc.marcas.map((m) => (
        <div key={m.min} aria-hidden="true" className="absolute inset-x-0 border-t border-line/60" style={{ top: m.y }} />
      ))}
      {blocos.map((b) => {
        const top = yDe(esc, b.ini)
        const h = Math.max(yDe(esc, b.fim) - top, 28)
        const a = b.aula
        return (
          <button
            key={a.id}
            type="button"
            onClick={() => onAbrir(chaveDe(a))}
            title={`${a.name} · ${faixa(a)} · ${localLabel(a)}`}
            className={`absolute overflow-hidden rounded-[5px] ${b.cols >= 3 ? 'p-1 text-[0.62rem]' : 'p-1.5 text-[0.72rem]'} text-left leading-tight shadow-sm outline-offset-2 transition-transform duration-100 hover:z-10 hover:scale-[1.02] active:scale-[0.98] ${corLocal(a.local.group)} ${a.status === 'revisar' ? 'ring-2 ring-inset ring-dashed ring-white/70' : ''}`}
            style={{ top: top + 1, height: h - 2, left: `calc(${(b.col / b.cols) * 100}% + 2px)`, width: `calc(${100 / b.cols}% - 4px)` }}
          >
            <span className="block font-bold [overflow-wrap:anywhere]">{a.name}</span>
            <span className="mt-0.5 block font-mono tabular-nums opacity-90">{faixa(a)}</span>
            <span className="block opacity-90 [overflow-wrap:anywhere]">{localLabel(a)}</span>
            {(a.ref ?? a.code) && <span className="block font-mono opacity-80">{a.ref ?? a.code}{a.turma ? ` · ${a.turma}` : ''}</span>}
          </button>
        )
      })}
    </div>
  )
}

function GradeSemanal({ aulas, chaveDe, onAbrir }: { aulas: Aula[]; chaveDe: (a: Aula) => string; onAbrir: (key: string) => void }) {
  const larga = useMinWidth(880)
  const dias = useMemo(() => Array.from(new Set(aulas.map((a) => a.day))).sort((a, b) => a - b), [aulas])
  const hoje = ((new Date().getDay() + 6) % 7) + 1
  const [sel, setSel] = useState(hoje)
  const dia = dias.find((d) => d === sel) ?? dias[0]
  const visiveis = larga ? aulas : aulas.filter((a) => a.day === dia)
  const colunas = larga ? dias : [dia]
  const esc = useMemo(() => escala(visiveis, PX_MIN), [visiveis])

  if (aulas.length === 0) return null
  return (
    <div>
      {!larga && (
        <div className="mb-4">
          <Chips
            label="Dia da semana"
            value={String(dia)}
            onChange={(v) => setSel(Number(v))}
            options={dias.map((d) => ({ value: String(d), label: DIAS[d].curto }))}
          />
          <p className="mt-2 text-sm font-semibold text-ink">{DIAS[dia].longo}</p>
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <div className="grid min-w-0" style={{ gridTemplateColumns: `3.25rem repeat(${colunas.length}, minmax(0, 1fr))` }}>
          <div className="border-b border-line bg-surface-2" />
          {colunas.map((d) => (
            <div key={d} className="eyebrow border-b border-l border-line bg-surface-2 px-2 py-2.5 text-center text-[0.7rem] text-ink">
              {larga ? DIAS[d].longo : DIAS[d].curto}
            </div>
          ))}
          <div className="relative" style={{ height: esc.altura }} aria-hidden="true">
            {esc.marcas.map((m) => (
              <span key={m.min} className="absolute right-1.5 -translate-y-1/2 font-mono text-[0.66rem] tabular-nums text-muted" style={{ top: Math.max(m.y, 7) }}>
                {m.label}
              </span>
            ))}
          </div>
          {colunas.map((d) => (
            <ColunaDia key={d} aulas={visiveis.filter((a) => a.day === d)} esc={esc} onAbrir={onAbrir} chaveDe={chaveDe} />
          ))}
        </div>
      </div>
      <Legenda aulas={aulas} />
    </div>
  )
}

function Legenda({ aulas }: { aulas: Aula[] }) {
  const grupos = Array.from(new Set(aulas.map((a) => a.local.group))).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  return (
    <ul aria-label="Legenda de cores" className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-fg">
      {grupos.map((g) => (
        <li key={g} className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={`inline-block h-4 w-4 rounded-[4px] ${corLocal(g)}`} />
          {g}
        </li>
      ))}
      <li className="inline-flex items-center gap-2 text-muted">
        <span aria-hidden="true" className="inline-block h-4 w-4 rounded-[4px] bg-graphite ring-2 ring-inset ring-dashed ring-white/70" />
        Tracejado: aula a confirmar
      </li>
    </ul>
  )
}

/* -------------------------------------------------------------------- detalhes */

function Detalhe({ grupo, onFechar }: { grupo: GrupoDisciplina; onFechar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => {
      if (d?.open) d.close()
    }
  }, [])
  const info = grupo.info
  const pre = info ? nomesPreReq(info) : []
  return (
    <dialog
      ref={ref}
      aria-labelledby="detalhe-t"
      onClose={onFechar}
      onClick={(e) => {
        if (e.target === ref.current) onFechar()
      }}
      className="m-auto max-h-[88vh] w-[min(100%-1.5rem,44rem)] overflow-auto rounded-lg border-2 border-ink bg-surface p-0 text-fg backdrop:bg-night/70"
    >
      <div className="p-[clamp(1rem,3vw,1.75rem)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="eyebrow text-accent-text">{periodoLabel(info) || 'Disciplina'}</p>
            <h2 id="detalhe-t" className="display mt-1 text-[clamp(1.4rem,4vw,2rem)] [overflow-wrap:anywhere]">{grupo.name}</h2>
            <p className="mt-1 font-mono text-sm tabular-nums text-muted">
              {grupo.code ?? 'Sem código na planilha'}
              {info ? ` · ${info.credits} ${info.credits === 1 ? 'crédito' : 'créditos'}` : ''}
            </p>
          </div>
          <button type="button" onClick={() => ref.current?.close()} aria-label="Fechar detalhes" className="-mr-2 -mt-2 grid h-11 w-11 shrink-0 place-items-center rounded-md text-ink hover:bg-surface-2">
            <Icon name="close" size={22} />
          </button>
        </div>

        {pre.length > 0 && (
          <p className="mt-3 text-sm">
            <span className="eyebrow mr-2 text-[0.64rem] text-muted">Pré-requisitos</span>
            {pre.join(', ')}
          </p>
        )}
        {grupo.aRevisar > 0 && (
          <div className="mt-4">
            <Aviso titulo="Há aulas a confirmar">{MOTIVO_REVISAR}</Aviso>
          </div>
        )}

        <h3 className="display mt-6 text-lg">Todas as aulas ({grupo.aulas.length})</h3>
        <ul className="mt-3 grid gap-3">
          {grupo.aulas.map((a) => (
            <li key={a.id} className="rounded-md border border-line bg-surface-2 p-3 text-sm">
              <p className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-semibold text-ink">{DIAS[a.day].longo}</span>
                <span className="font-mono tabular-nums">{faixa(a)}</span>
              </p>
              <p className="mt-0.5 [overflow-wrap:anywhere]">
                {localLabel(a)}
                {a.turma ? ` · turma ${a.turma}` : ''}
              </p>
              {a.extra.length > 0 && <p className="mt-1 text-muted [overflow-wrap:anywhere]">{a.extra.join(' · ')}</p>}
              {a.status === 'revisar' && <p className="mt-1"><Etiqueta title={MOTIVO_REVISAR}>A confirmar</Etiqueta></p>}
              {a.issues.map((i) => (
                <p key={i.text} className="mt-1 flex items-start gap-1.5 text-fg">
                  <Icon name="warning" size={15} className="mt-0.5 shrink-0 text-accent-text" />
                  <span className="[overflow-wrap:anywhere]">{i.text}</span>
                </p>
              ))}
              <p className="mt-1 text-[0.72rem] text-muted">
                Planilha: {a.source.sheet}
                {a.source.cell ? `, célula ${a.source.cell}` : ''}
              </p>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => ref.current?.close()} className="inline-flex min-h-[46px] items-center rounded-md border-2 border-ink px-5 font-semibold text-ink hover:bg-ink hover:text-bg">
            Fechar
          </button>
        </div>
      </div>
    </dialog>
  )
}

/* --------------------------------------------------------------------- fontes */

const STATUS_FONTE: Record<HorariosFonte['status'], string> = {
  ok: 'Atualizada',
  desatualizada: 'Cópia antiga',
  falhou: 'Falhou',
  'nao-encontrada': 'Planilha não encontrada',
}

function Fontes() {
  const fontes = horarios.sources
  return (
    <section aria-labelledby="fontes-t" className="mt-12">
      <h2 id="fontes-t" className="display text-2xl">De onde vêm os dados</h2>
      <p className="mt-2 max-w-[70ch] text-muted">
        Os horários são lidos das planilhas oficiais da UFES Alegre, uma vez por dia, e guardados no site. Eles não são atualizados em tempo real: confira sempre na página oficial antes de decidir algo importante.
      </p>
      <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
        {paginasOficiais.map((p) => (
          <li key={p.href}>
            <a href={p.href} target="_blank" rel="noopener noreferrer" className="link-inline">{p.label}</a>
          </li>
        ))}
      </ul>
      {fontes.length > 0 && (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {fontes.map((s) => (
            <div key={s.id} className="rounded-lg border border-line bg-surface p-4 text-sm">
              <p className="flex flex-wrap items-center justify-between gap-2">
                <span className="display text-base text-ink">{s.label}</span>
                <Etiqueta>{STATUS_FONTE[s.status]}</Etiqueta>
              </p>
              <p className="mt-2 text-muted tabular-nums">
                {s.doCurso} {s.doCurso === 1 ? 'aula' : 'aulas'} do curso{s.aRevisar > 0 ? `, ${s.aRevisar} a confirmar` : ''} · {s.lidas} lidas
              </p>
              {s.fetchedAt && <p className="text-muted">Coletada em {fmtDataHora(s.fetchedAt)}</p>}
              {s.sheetUpdatedText && <p className="text-muted [overflow-wrap:anywhere]">Planilha: {s.sheetUpdatedText}</p>}
              {s.error && <p className="mt-1 text-accent-text [overflow-wrap:anywhere]">{s.error}</p>}
              {s.warnings.map((w) => (
                <p key={w} className="mt-1 text-muted [overflow-wrap:anywhere]">{w}</p>
              ))}
              {s.fileUrl && (
                <a href={s.fileUrl} target="_blank" rel="noopener noreferrer" className="link-inline mt-2 inline-block">Abrir planilha original</a>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

/* --------------------------------------------------------------------- página */

export function Horarios() {
  const [f, setF] = useState<Filtros>(FILTROS_VAZIOS)
  const [vista, setVista] = useState<Vista>('tabela')
  const [aberta, setAberta] = useState<string | null>(null)
  const set = (p: Partial<Filtros>) => setF((cur) => ({ ...cur, ...p }))

  const estado = useMemo(() => estadoDados(horarios, Date.now()), [])
  const opts = useMemo(() => opcoes(horarios.aulas), [])
  const todos = useMemo(() => agrupar(horarios.aulas), [])
  const filtradas = useMemo(() => filtrar(horarios.aulas, f), [f])
  const grupos = useMemo(() => agrupar(filtradas), [filtradas])
  const total = contar(filtradas)
  const ativos = filtrosAtivos(f)
  const grupoAberto = aberta ? (todos.find((g) => g.key === aberta) ?? grupos.find((g) => g.key === aberta) ?? null) : null
  const quando = fmtDataHora(horarios.generatedAt)
  const aConfirmar = filtradas.filter((a) => a.status === 'revisar').length

  return (
    <>
      <PageHeader
        eyebrow="Consulta"
        title="Horários das aulas"
        lead="As disciplinas de Ciência da Computação com dia, horário e local, reunidas das planilhas oficiais da UFES Alegre em um só lugar."
      />

      <div className="wrap py-[clamp(2rem,6vw,4rem)]">
        <div className="grid gap-3">
          {estado.vazio ? (
            <Aviso tom="info" titulo="Ainda não há horários coletados">
              A coleta automática das planilhas ainda não rodou para este site. Enquanto isso, consulte as páginas oficiais: {paginasOficiais.map((p, i) => (
                <span key={p.href}>
                  {i > 0 ? ' e ' : ''}
                  <a href={p.href} target="_blank" rel="noopener noreferrer" className="link-inline">{p.href.endsWith('salas') ? 'salas' : 'laboratórios'}</a>
                </span>
              ))}.
            </Aviso>
          ) : (
            <p className="text-sm text-muted">
              Dados coletados das planilhas oficiais em <strong className="font-semibold text-ink">{quando}</strong>. A coleta é diária, não em tempo real.
            </p>
          )}
          {estado.antigo && (
            <Aviso titulo="Os dados podem estar desatualizados">
              A última coleta bem-sucedida foi há {estado.dias} dias. Confira as páginas oficiais antes de se basear nestes horários.
            </Aviso>
          )}
          {estado.falhou && !estado.vazio && (
            <Aviso titulo="A última atualização falhou">
              {horarios.lastAttempt?.message ?? 'Não foi possível atualizar.'} Estes são os últimos dados válidos{quando ? `, de ${quando}` : ''}.
            </Aviso>
          )}
          {!estado.falhou && estado.fontesComProblema > 0 && (
            <Aviso titulo="Parte das planilhas não foi atualizada">
              {estado.fontesComProblema} {estado.fontesComProblema === 1 ? 'fonte teve' : 'fontes tiveram'} problema na última coleta; veja os detalhes em &ldquo;De onde vêm os dados&rdquo;.
            </Aviso>
          )}
        </div>

        {estado.vazio ? (
          <div className="mt-6">
            <EmptyState title="Nenhuma aula para mostrar">Assim que a primeira coleta terminar, a tabela e a grade semanal aparecem aqui automaticamente.</EmptyState>
          </div>
        ) : (
          <>
            <div className="mt-6">
              <PainelFiltros f={f} set={set} opts={opts} ativos={ativos} />
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <p role="status" aria-live="polite" className="font-semibold tabular-nums text-ink">
                {total.aulas} {total.aulas === 1 ? 'aula' : 'aulas'} em {total.disciplinas} {total.disciplinas === 1 ? 'disciplina' : 'disciplinas'}
                {aConfirmar > 0 && <span className="font-normal text-muted"> · {aConfirmar} a confirmar</span>}
              </p>
              <Chips<Vista>
                label="Forma de exibição"
                value={vista}
                onChange={setVista}
                options={[
                  { value: 'tabela', label: 'Tabela' },
                  { value: 'grade', label: 'Grade semanal' },
                ]}
              />
            </div>

            <div className="mt-4">
              {filtradas.length === 0 ? (
                <EmptyState title="Nenhuma aula encontrada">Tente tirar algum filtro ou pesquisar por outro nome ou código.</EmptyState>
              ) : vista === 'tabela' ? (
                <>
                  <Tabela grupos={grupos} onAbrir={setAberta} />
                  <Cartoes grupos={grupos} onAbrir={setAberta} />
                </>
              ) : (
                <GradeSemanal aulas={filtradas} chaveDe={chaveGrupo} onAbrir={setAberta} />
              )}
            </div>
          </>
        )}

        <Fontes />
      </div>

      {grupoAberto && <Detalhe grupo={grupoAberto} onFechar={() => setAberta(null)} />}
    </>
  )
}
