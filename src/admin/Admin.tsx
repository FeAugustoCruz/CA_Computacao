import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Icon } from '../components/Icon'
import { LogoMark } from '../components/Logo'
import { Button } from '../components/ui'
import { horarios as embutidos } from '../content/horarios'
import { fmtDataHora } from '../lib/horarios'
import { buscarPublicados, cabecalhos, maisRecente, supabaseConfig } from '../lib/remoto'
import { useTheme } from '../lib/useTheme'
import type { HorariosData } from '../types'
import { FONTES, processar, type Resultado } from './processar'

interface Sessao {
  token: string
  email: string
  expira: number
}
const CHAVE = 'ca-admin-sessao'

function lerSessao(): Sessao | null {
  try {
    const s = JSON.parse(sessionStorage.getItem(CHAVE) ?? 'null') as Sessao | null
    return s && s.expira > Date.now() ? s : null
  } catch {
    return null
  }
}

const campo = 'min-h-[44px] w-full rounded-md border border-line bg-surface px-3 text-fg focus-visible:border-ink'

function Mensagem({ tom, children }: { tom: 'erro' | 'ok' | 'info'; children: ReactNode }) {
  return (
    <div role={tom === 'erro' ? 'alert' : 'status'} className={`flex items-start gap-3 rounded-md border-2 p-4 text-[0.95rem] ${tom === 'erro' ? 'border-orange bg-orange/10' : 'border-line bg-surface-2'}`}>
      <Icon name={tom === 'ok' ? 'check' : tom === 'erro' ? 'warning' : 'info'} size={20} className="mt-0.5 shrink-0 text-accent-text" />
      <div className="min-w-0 [overflow-wrap:anywhere]">{children}</div>
    </div>
  )
}

export function Admin() {
  useTheme() // aplica o tema salvo/do sistema
  const [sessao, setSessao] = useState<Sessao | null>(lerSessao)
  const [atual, setAtual] = useState<HorariosData>(embutidos)
  const [arquivos, setArquivos] = useState<Record<string, File | undefined>>({})
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [publicado, setPublicado] = useState<string | null>(null)

  const sair = (motivo?: string) => {
    try {
      sessionStorage.removeItem(CHAVE)
    } catch {
      /* sem armazenamento: a sessão vale só nesta página */
    }
    setSessao(null)
    setResultado(null)
    if (motivo) setErro(motivo)
  }

  useEffect(() => {
    if (!sessao) return
    buscarPublicados().then((r) => r && setAtual((a) => maisRecente(a, r)))
  }, [sessao])

  async function entrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setOcupado('Entrando…')
    setErro(null)
    try {
      const res = await fetch(`${supabaseConfig.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { ...cabecalhos(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(f.get('email')).trim(), password: String(f.get('senha')) }),
      })
      if (!res.ok) {
        const host = new URL(supabaseConfig.url).host
        if (res.status === 400) throw new Error('E-mail ou senha incorretos.')
        if (res.status === 401 || res.status === 403) throw new Error('O servidor recusou a chave pública do site. Confira a variável SUPABASE_ANON_KEY (chave "anon public") e publique o site de novo.')
        if (res.status === 404) throw new Error(`O endereço ${host} não tem o serviço de login do Supabase. Confira a variável SUPABASE_URL: deve ser a "Project URL" do projeto (https://CODIGO.supabase.co). Depois de mudar a variável, publique o site de novo.`)
        throw new Error(`Não foi possível entrar (erro ${res.status}).`)
      }
      const j = (await res.json()) as { access_token: string; expires_in: number; user?: { email?: string } }
      const s: Sessao = { token: j.access_token, email: j.user?.email ?? String(f.get('email')), expira: Date.now() + (j.expires_in - 60) * 1000 }
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify(s))
      } catch {
        /* segue sem salvar */
      }
      setSessao(s)
    } catch (x) {
      setErro(x instanceof TypeError ? 'Sem conexão com o servidor. Tente de novo.' : (x as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  async function ler() {
    setOcupado('Lendo as planilhas…')
    setErro(null)
    setPublicado(null)
    try {
      const envios = FONTES.flatMap((s) => (arquivos[s.id] ? [{ id: s.id, arquivo: arquivos[s.id] as File }] : []))
      setResultado(await processar(envios, atual))
    } catch (x) {
      setErro(`Não consegui ler os arquivos: ${(x as Error).message}`)
    } finally {
      setOcupado(null)
    }
  }

  async function publicar() {
    if (!sessao || !resultado?.data) return
    setOcupado('Publicando…')
    setErro(null)
    try {
      const res = await fetch(`${supabaseConfig.url}/rest/v1/horarios_publicados?on_conflict=id`, {
        method: 'POST',
        headers: { ...cabecalhos(sessao.token), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: 1, data: resultado.data, updated_at: new Date().toISOString(), updated_by: sessao.email }),
      })
      if (res.status === 401) return sair('Sua sessão expirou. Entre de novo e publique outra vez.')
      if (res.status === 403) throw new Error('Seu e-mail não está na lista de administradores. Peça para cadastrarem (tabela "admins").')
      if (!res.ok) throw new Error(`O servidor recusou a publicação (erro ${res.status}).`)
      setAtual(resultado.data)
      setPublicado(fmtDataHora(new Date().toISOString()))
      setResultado(null)
      setArquivos({})
    } catch (x) {
      setErro(x instanceof TypeError ? 'Sem conexão com o servidor. Nada foi publicado.' : (x as Error).message)
    } finally {
      setOcupado(null)
    }
  }

  const escolhidos = FONTES.filter((s) => arquivos[s.id]).length

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="border-b-4 border-orange bg-night text-white">
        <div className="wrap flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-3">
            <LogoMark className="h-11 w-auto" />
            <div>
              <p className="display text-lg leading-none">Administração</p>
              <p className="eyebrow mt-1 text-[0.62rem] text-white/65">CA Computação · UFES Alegre</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {sessao && <span className="text-white/80 [overflow-wrap:anywhere]">{sessao.email}</span>}
            {sessao && (
              <button type="button" onClick={() => sair()} className="min-h-[44px] font-semibold underline underline-offset-4">
                Sair
              </button>
            )}
            <a href="./#horarios" className="inline-flex min-h-[44px] items-center font-semibold underline underline-offset-4">
              Ver o site
            </a>
          </div>
        </div>
      </header>

      <main className="wrap max-w-3xl py-[clamp(1.5rem,5vw,3rem)]">
        <h1 className="display text-[clamp(1.6rem,4.5vw,2.4rem)]">Atualizar horários das aulas</h1>

        {!supabaseConfig.ativo ? (
          <div className="mt-6">
            <Mensagem tom="info">
              <p className="font-semibold text-ink">O envio de planilhas ainda não foi configurado neste site.</p>
              <p className="mt-1">É preciso criar o projeto no Supabase e informar o endereço e a chave pública no build. O passo a passo está no README (seção &ldquo;Painel de administração&rdquo;).</p>
            </Mensagem>
          </div>
        ) : !sessao ? (
          <form onSubmit={entrar} className="mt-6 grid max-w-md gap-4 rounded-lg border-2 border-ink bg-surface p-5">
            <p className="text-muted">Acesso só para administradores do CA.</p>
            <div>
              <label htmlFor="email" className="eyebrow mb-1.5 block text-[0.66rem] text-muted">E-mail</label>
              <input id="email" name="email" type="email" required autoComplete="username" className={campo} />
            </div>
            <div>
              <label htmlFor="senha" className="eyebrow mb-1.5 block text-[0.66rem] text-muted">Senha</label>
              <input id="senha" name="senha" type="password" required autoComplete="current-password" className={campo} />
            </div>
            {erro && <Mensagem tom="erro">{erro}</Mensagem>}
            <Button type="submit" disabled={!!ocupado}>{ocupado ?? 'Entrar'}</Button>
          </form>
        ) : (
          <>
            <p className="mt-3 text-muted">
              Horários no ar: {atual.generatedAt ? `atualizados em ${fmtDataHora(atual.generatedAt)}` : 'ainda sem dados'}, com {atual.aulas.length} aulas.
              Envie só as planilhas que mudaram; as demais continuam como estão.
            </p>

            {publicado && (
              <div className="mt-5">
                <Mensagem tom="ok">Publicado em {publicado}. A página de horários mostra os novos dados ao ser aberta ou recarregada.</Mensagem>
              </div>
            )}

            <section aria-labelledby="env-t" className="mt-6 rounded-lg border-2 border-ink bg-surface p-5">
              <h2 id="env-t" className="display text-xl">1. Escolha as planilhas</h2>
              <p className="mt-1 text-sm text-muted">Formatos aceitos: .xlsx (Excel ou Google Planilhas: Arquivo &gt; Fazer download &gt; Microsoft Excel) e .csv.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {FONTES.map((s) => (
                  <div key={s.id} className="min-w-0">
                    <label htmlFor={`f-${s.id}`} className="eyebrow mb-1.5 block text-[0.66rem] text-muted">{s.group}</label>
                    <input
                      id={`f-${s.id}`}
                      type="file"
                      accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        setArquivos((a) => ({ ...a, [s.id]: e.target.files?.[0] }))
                        setResultado(null)
                      }}
                      className={`${campo} py-2 text-sm`}
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <Button disabled={escolhidos === 0 || !!ocupado} onClick={ler}>{ocupado === 'Lendo as planilhas…' ? ocupado : 'Ler planilhas'}</Button>
              </div>
            </section>

            {erro && (
              <div className="mt-5">
                <Mensagem tom="erro">{erro}</Mensagem>
              </div>
            )}

            {resultado && (
              <section aria-labelledby="res-t" className="mt-6 rounded-lg border-2 border-ink bg-surface p-5">
                <h2 id="res-t" className="display text-xl">2. Confira e publique</h2>
                {resultado.erros.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {resultado.erros.map((x) => (
                      <li key={x}><Mensagem tom="erro">{x}</Mensagem></li>
                    ))}
                  </ul>
                )}
                {resultado.data ? (
                  <>
                    <ul className="mt-4 grid gap-3">
                      {resultado.fontes.map((f) => (
                        <li key={f.id} className="rounded-md border border-line bg-surface-2 p-3 text-sm">
                          <p className="display text-base text-ink">{f.label}</p>
                          <p className="mt-1 text-muted [overflow-wrap:anywhere]">{f.fileName} · {f.sheets} {f.sheets === 1 ? 'aba' : 'abas'}</p>
                          <p className="mt-1 tabular-nums">
                            <strong>{f.doCurso}</strong> aulas do curso, <strong>{f.aRevisar}</strong> a confirmar, {f.descartadas} leituras de outros cursos descartadas.
                          </p>
                          {f.warnings.map((w) => (
                            <p key={w} className="mt-1 text-accent-text [overflow-wrap:anywhere]">{w}</p>
                          ))}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-sm text-muted">
                      Depois de publicar, o site terá {resultado.data.aulas.length} aulas ({atual.aulas.length} hoje). Aulas &ldquo;a confirmar&rdquo; aparecem marcadas para os visitantes.
                    </p>
                    <div className="mt-4">
                      <Button disabled={!!ocupado} onClick={publicar}>{ocupado === 'Publicando…' ? ocupado : 'Publicar no site'}</Button>
                    </div>
                  </>
                ) : (
                  <p className="mt-3 text-muted">Nada a publicar. Corrija o que está acima e leia as planilhas de novo.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
