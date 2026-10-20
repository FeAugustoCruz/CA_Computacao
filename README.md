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

## Pendências conhecidas

- **Logotipo:** o emblema oficial fica em `src/assets/logo-ca.png` e é usado no cabeçalho e no rodapé (`LogoMark` em `src/components/Logo.tsx`). O ícone da aba (favicon) é uma versão 64×64 da mesma imagem, embutida em `index.html`. Para trocar a logo, substitua o PNG e gere o favicon de novo.
- **Formulário de contato:** valida os campos, mas só envia de verdade se existir um endpoint. Defina `VITE_CONTACT_ENDPOINT` (ex.: Formspree) no build. Sem isso, a página avisa que nada foi enviado e oferece copiar a mensagem.
- **CMS / área administrativa:** não existe. `src/services/content.ts` é o ponto de troca: substitua pelas chamadas ao CMS ou banco escolhido (Supabase, Sanity, Strapi...). Edição online precisa da autenticação e das permissões desse serviço.
- **Atividades complementares:** o relatório é de 2020 e corta alguns enunciados no fim da linha (marcados com "…"). Confirme texto e valores com o Colegiado.
- **Rotas:** usam hash (`#sobre`, `#contato`). Para URLs limpas, troque `src/lib/route.ts` por React Router.
