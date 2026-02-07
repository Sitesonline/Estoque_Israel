# Sistema simples de estoque

Este repositório entrega um site estático (HTML/CSS/JavaScript) com integração
pronta para Google Sheets via Google Apps Script. A interface permite:

- Cadastro de produtos com data e fornecedor.
- Registro de entradas e saídas com datas.
- Resumo diário, semanal e mensal de movimentações.
- Filtro por nome e fornecedor.
- Edição de produtos a qualquer momento.
- Informar o fornecedor que mais forneceu no mês.

## Estrutura de arquivos

- `index.html`: Interface principal.
- `styles.css`: Estilos do site.
- `app.js`: Lógica de cadastro, filtros e sincronização.
- `apps_script/Code.gs`: Script para conectar no Google Sheets.

## Configuração do Google Sheets (recomendado)

1. Crie uma planilha no Google Sheets.
2. Abra **Extensões → Apps Script** e cole o conteúdo de
   [`apps_script/Code.gs`](apps_script/Code.gs).
3. Publique como **Web App**:
   - Executar como: **você mesmo**.
   - Quem tem acesso: **qualquer pessoa**.
4. Copie a URL gerada.
5. Abra `app.js` e cole a URL no campo `SHEETS_ENDPOINT`.
6. Hospede os arquivos (ou abra `index.html` localmente) e teste.

> Caso você ainda não configure o Google Sheets, o sistema funciona em modo
> local usando `localStorage`.

## Estrutura das planilhas

O Apps Script cria duas abas automaticamente:

### Aba `Produtos`
| id | name | supplier | stock | createdAt | lastEntry | lastExit |
|----|------|----------|-------|-----------|-----------|----------|

### Aba `Movimentacoes`
| id | productId | type | quantity | date |
|----|-----------|------|----------|------|

## Observações

- Os cálculos de entradas/saídas diárias, semanais e mensais são feitos no
  frontend, com base nas movimentações sincronizadas.
- Para atender necessidades específicas, você pode expandir o Apps Script para
  relatórios adicionais dentro da planilha.
