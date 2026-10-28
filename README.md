# Site do CA de Ciência da Computação · UFES Alegre

React 18 + TypeScript + Tailwind CSS 3, empacotado com Vite em um único `index.html`.

## Rodar

```bash
npm install
npm run dev        # desenvolvimento
npm run build      # gera dist/index.html (tudo embutido, pronto para hospedar)
```

## Onde editar o conteúdo

Tudo fica em `src/content/`. Enquanto a lista de integrantes estiver vazia, o site mostra cartões com campos `[Inserir ...]`. Ao cadastrar o primeiro integrante real, eles somem sozinhos.

| Arquivo | O que controla |
| --- | --- |
| `site.ts` | e-mail, Instagram, localização, horário de atendimento |
| `about.ts` | textos da página Sobre (história, missão etc.) |
| `members.ts` | integrantes da gestão |
| `documents.ts` | documentos (sem modelos de propósito: só entra arquivo real) |
| `curriculo.ts` | disciplinas da Grade curricular (107: 47 obrigatórias e 60 optativas), geradas do PDF do currículo da UFES por `scripts/gen-curriculo.py` |
| `complementares.ts` | atividades complementares, transcritas do PDF da UFES (04/03/2020) |

## Páginas

Início, Sobre, Integrantes, Grade curricular, Documentos, Complementares e Contato. As páginas de Notícias, Eventos e Projetos foram removidas.

## Grade curricular

As marcações de disciplinas concluídas ficam no `localStorage` do navegador (chave `ca-grade-concluidas-v1`): não há conta nem servidor, então cada pessoa vê só o próprio progresso e ele não passa de um aparelho para outro. A porcentagem considera as 47 obrigatórias (inclui Estágio e TCC I e II). Optativas são contadas à parte porque o PDF não informa quantas são exigidas. Para atualizar a matriz: `python3 scripts/gen-curriculo.py novo-curriculo.pdf`.

## Horários das aulas

A página **Horários** junta, numa só tela, as aulas de Ciência da Computação lidas das planilhas oficiais da UFES Alegre: salas (Prédio Central e Ciclo Básico) e laboratórios (Chi-Chiu e Reuni). Há tabela, grade semanal, filtros e detalhes de cada disciplina.

- **Coleta:** `scripts/horarios/` baixa as planilhas, interpreta sem depender de posições fixas de célula e grava `src/data/horarios.json`. Prédio Central e Ciclo Básico são lidos direto das planilhas publicadas no Google Sheets (links em `scripts/horarios/config.mjs`); se o link falhar, a coleta procura a planilha na página oficial. Rode `npm run horarios:update` (precisa de acesso ao site da UFES) e `npm test` para os testes.
- **Quais disciplinas aparecem:** só as do currículo em `src/content/curriculo.ts` (107 disciplinas, gerado do PDF oficial). O código tem prioridade; aulas reconhecidas só pelo nome ficam marcadas como **a confirmar**.
- **Atualização automática:** o workflow `.github/workflows/horarios.yml` roda todo dia às 06:00 (Brasília), grava o JSON na `main` se algo mudou e dispara o deploy. Também dá para rodá-lo à mão na aba Actions. Se uma coleta falhar, os últimos dados válidos continuam no ar e o site avisa.
- **Não é tempo real:** a página informa a data da última coleta e avisa quando os dados estão antigos ou a atualização falhou.
- **Como as planilhas são lidas:** cada aba é uma sala, com uma linha por hora e os dias nas colunas. As aulas de Computação trazem o código e a turma, como `Programação II (COM10082 - CC1)`. O `CC1` é o que comprova que a aula é do curso, porque o código da disciplina é o mesmo em todos os cursos; aulas com turma de outro curso (SI1, AG1, BL1...) e código ou nome parecido ficam como **a confirmar**.
- **Dados iniciais:** `src/data/horarios.json` foi gerado das planilhas do Prédio Central e do Ciclo Básico (2026/2). Os laboratórios Chi-Chiu e Reuni entram na primeira execução do workflow, pois ainda não tenho o link direto de suas planilhas.

## Painel de administração (envio de planilhas)

Em `admin.html` (ex.: `https://SEU-SITE/admin.html`) os administradores entram com e-mail e senha, enviam as planilhas `.xlsx` ou `.csv` das salas e laboratórios, conferem o resumo (aulas do curso, a confirmar, descartadas) e publicam. A página **Horários** passa a mostrar os novos dados na próxima vez que for aberta, sem novo deploy.

Como funciona: a planilha é lida no próprio navegador, com o mesmo leitor da coleta automática (`scripts/horarios`); só o resultado vai para o Supabase (login + uma tabela). O site público lê essa tabela e usa o conjunto **mais recente** entre ela e o `horarios.json` embutido; se o Supabase estiver fora do ar, o site continua com o embutido. Planilhas que não rendem nenhuma aula do curso são recusadas e não apagam os dados atuais.

**Configuração (uma vez):**

1. Crie um projeto gratuito em [supabase.com](https://supabase.com).
2. Em *SQL Editor*, rode o arquivo `supabase/schema.sql` e, no fim dele, cadastre o e-mail de cada administrador na tabela `admins`.
3. Em *Authentication > Users*, crie um usuário (e-mail e senha) para cada administrador. Em *Authentication > Sign In / Providers*, desligue "Allow new users to sign up". Só quem está em `admins` consegue publicar, mesmo que alguém crie conta.
4. Em *Project Settings > API*, copie a **Project URL** e a chave **anon public**. Nunca use a chave `service_role`.
5. No GitHub: *Settings > Secrets and variables > Actions > Variables*, crie `SUPABASE_URL` e `SUPABASE_ANON_KEY` com esses dois valores (a chave anon é pública por desenho; quem protege a gravação são as regras do banco).
6. Rode o *Deploy* (push na `main` ou *Actions > Deploy > Run workflow*). Para testar localmente, crie um `.env.local` com `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.

**Atenção:** a coleta automática diária (`horarios.yml`) continua ativa. Como o site usa o dado mais recente, uma coleta bem-sucedida feita depois do envio manual passa a valer no lugar dele. Se preferir só o envio manual, desative o workflow *Atualizar horários* em *Actions*.

## Pendências conhecidas

- **Logotipo:** o emblema oficial fica em `src/assets/logo-ca.png` e é usado no cabeçalho e no rodapé (`LogoMark` em `src/components/Logo.tsx`). O ícone da aba (favicon) é uma versão 64×64 da mesma imagem, embutida em `index.html`. Para trocar a logo, substitua o PNG e gere o favicon de novo.
- **Formulário de contato:** valida os campos, mas só envia de verdade se existir um endpoint. Defina `VITE_CONTACT_ENDPOINT` (ex.: Formspree) no build. Sem isso, a página avisa que nada foi enviado e oferece copiar a mensagem.
- **CMS / área administrativa:** não existe. `src/services/content.ts` é o ponto de troca: substitua pelas chamadas ao CMS ou banco escolhido (Supabase, Sanity, Strapi...). Edição online precisa da autenticação e das permissões desse serviço.
- **Atividades complementares:** o relatório é de 2020 e corta alguns enunciados no fim da linha (marcados com "…"). Confirme texto e valores com o Colegiado.
- **Rotas:** usam hash (`#sobre`, `#contato`). Para URLs limpas, troque `src/lib/route.ts` por React Router.
