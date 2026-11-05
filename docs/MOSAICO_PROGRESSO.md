# Mosaico — implantação por etapas

Atualizado em 05/11/2026. Solicitação: aplicar a proposta 02 aprovada, com temas claro e escuro, ao Design Mantora e ao Escritório.

## Etapa 1 — Design Mantora

- Base correta: `main`, commit `371a81055dfb114def68d1ab40f456afcbf39522` (inclui login, estúdio, modelos, peças e APIs atuais).
- Interface Mosaico: Abacaxi hospedada no projeto, paleta Mantora, navegação e quatro ferramentas nas mesmas rotas.
- Tema claro/escuro em todas as telas, lembrado em `mantora:appearance:v1`; alternância atualiza somente a aparência, sem remontar editores.
- Autenticação, APIs, bibliotecas de templates, exportação, modelos, callbacks e chaves de rascunho permanecem sem modificações.
- Verificado: TypeScript; 56 testes existentes; build de produção. A primeira execução do build mostrou um aviso do Next.js já instalado; a repetição concluiu sem alteração de dependências.
- QA visual automatizada local: o adaptador de preview recebeu argumentos incompatíveis com Next.js. Não foi alterado o comando de desenvolvimento do projeto para contornar essa limitação.

## Etapa 2 — Escritório Mantora

- Trabalhar no app atual de `motor-de-conteudo`, em `app/servidor/public/`.
- Não substituir pelo protótipo de `main` nem pelo app antigo de `claude/hopeful-hawking-cqgn4e`.
- Aplicar a camada visual e um seletor de tema independente do módulo de autenticação/dados.

## Retomada

Confira o último commit e o PR Mosaico antes de continuar. Não sobrescreva os avanços feitos por outras conversas. Arquivos de autenticação, servidor, banco e templates gerados não fazem parte desta alteração visual.
