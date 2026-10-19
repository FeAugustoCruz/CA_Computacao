"""Gera src/content/curriculo.ts a partir do PDF 'Currículo de Cursos' da UFES.
Uso: python3 scripts/gen-curriculo.py caminho/do/curriculo.pdf
Requer o utilitário pdftotext (poppler)."""
import re, subprocess, sys, json

pdf = sys.argv[1]
txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True, check=True).stdout.splitlines()

DISC = re.compile(r'^\s*([A-Z]{3}\d{5})\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(OB|OP)\s*$')
PRE = re.compile(r'^\s*Disciplina:\s*([A-Z]{3}\d{5})\b')
PER = re.compile(r'^\s*PERÍODO:\s*(\d+|\*)')
SKIP = ('CURRÍCULO DE CURSOS', 'UNIVERSIDADE FEDERAL', 'Currículo de Cursos')
KEYWORDS = ('Disciplina:', 'Não possui', 'Período Vencido', 'Créditos Mínimos', 'PERÍODO', 'DISCIPLINAS', '02 -', '03 -')

# Erros de digitação do PDF corrigidos na transcrição
FIX = {
    'Computção Móvel': 'Computação Móvel',
    'Análise e Projeto de Algorítmos': 'Análise e Projeto de Algoritmos',
    'Introdução a Plataformas de streaming de Dados:': 'Introdução a Plataformas de Streaming de Dados',
}

items, cur, period, expect_cont = [], None, None, False
for raw in txt:
    line = raw.rstrip()
    if not line.strip() or any(s in line for s in SKIP):
        continue
    m = PER.match(line)
    if m:
        period = None if m.group(1) == '*' else int(m.group(1)); expect_cont = False; continue
    m = DISC.match(line)
    if m:
        code, name, cr, t, e, l, kind = m.groups()
        cur = dict(code=code, name=re.sub(r'\s+', ' ', name).strip(), credits=int(cr), kind=kind, period=period, prereqs=[])
        items.append(cur); expect_cont = True; continue
    if cur is None:
        continue
    m = PRE.match(line)
    if m:
        cur['prereqs'].append(m.group(1)); expect_cont = False; continue
    s = line.strip()
    if s.startswith('Período Vencido'):
        cur['minPeriod'] = int(re.search(r'(\d+)', s).group(1)); expect_cont = False; continue
    if s.startswith('Créditos Mínimos'):
        cur['minCredits'] = int(re.search(r'(\d+)', s).group(1)); expect_cont = False; continue
    if expect_cont and not s.startswith(KEYWORDS):
        cur['name'] = re.sub(r'\s+', ' ', cur['name'] + ' ' + s); expect_cont = False; continue
    expect_cont = False

for it in items:
    it['name'] = FIX.get(it['name'], it['name'])
    if it['code'] == 'COM11062': it['special'] = 'Estágio'
    if it['code'] in ('COM10793', 'COM11063'): it['special'] = 'TCC'

codes = {i['code'] for i in items}
missing = [(i['code'], p) for i in items for p in i['prereqs'] if p not in codes]
assert len(codes) == len(items), 'códigos duplicados'
assert not missing, f'pré-requisitos sem disciplina: {missing}'

def row(i):
    return '  ' + json.dumps(i, ensure_ascii=False, separators=(', ', ': ')) + ','
out = """import type { Disciplina } from '../types'

/**
 * Fonte: UFES, Currículo de Cursos, Ciência da Computação - Bacharelado - Alegre.
 * Versão 2009 (corrente), documento emitido em 18/02/2021 (arquivo curriculo_curso_cc_2020-2.pdf).
 * Gerado por scripts/gen-curriculo.py. Pré-requisitos como listados no PDF.
 * Três títulos tinham erro de digitação no PDF e foram corrigidos aqui:
 * "Computção Móvel", "Análise e Projeto de Algorítmos" e "Introdução a Plataformas de streaming de Dados:".
 */
export const curriculoSource = {
  course: 'Ciência da Computação · Bacharelado · Alegre',
  version: '2009 (corrente)',
  issuedAt: '18/02/2021',
}

export const disciplinas: Disciplina[] = [
""" + '\n'.join(row(i) for i in items) + '\n]\n'
open('src/content/curriculo.ts', 'w', encoding='utf8').write(out)

ob = [i for i in items if i['kind'] == 'OB']; op = [i for i in items if i['kind'] == 'OP']
print('total', len(items), '| obrigatórias', len(ob), '(créditos', sum(i['credits'] for i in ob), ') | optativas', len(op), '(créditos', sum(i['credits'] for i in op), ')')
for p in range(1, 9):
    g = [i for i in ob if i['period'] == p]; print('período', p, len(g), [i['code'] for i in g])
print('sem período entre obrigatórias:', [i['code'] for i in ob if i['period'] is None])
print('especiais:', [(i['code'], i['name'], i.get('minPeriod'), i.get('minCredits'), i['prereqs']) for i in items if i.get('special')])
print('sem prereq:', sum(1 for i in items if not i['prereqs']), '| com 2+ prereqs:', [(i['code'], i['prereqs']) for i in items if len(i['prereqs']) >= 2][:6])
