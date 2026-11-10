# Documentação do BotecoRate

Versão documental 2026.11.10.1. Esta é a entrada da documentação mantida por Rafael Ferreira e Emanuel Franco. O conjunto foi consolidado em cinco guias, cada um com uma versão Markdown e uma versão Word com o mesmo conteúdo. Os Markdown são a fonte da edição; os Word são gerados a partir deles.

## Escolha do guia

| Guia | Conteúdo | Markdown | Word |
| --- | --- | --- | --- |
| Visão geral | Navegação da documentação, situação e manutenção | [Abrir Markdown](README.md) | [Abrir Word](README.docx) |
| Regras de negócio | Contas, donos, CNPJ, convites, administração, lixeira e experiência | [Abrir Markdown](REGRAS_DE_NEGOCIO.md) | [Abrir Word](REGRAS_DE_NEGOCIO.docx) |
| Banco e arquitetura | SQLite 10, tabelas/views, RTDB, sincronização e segurança | [Abrir Markdown](BANCO_E_ARQUITETURA.md) | [Abrir Word](BANCO_E_ARQUITETURA.docx) |
| Desenvolvimento e testes | Instalação, Firebase, inspetor, backup, Jest, Maestro e dois celulares | [Abrir Markdown](DESENVOLVIMENTO_E_TESTES.md) | [Abrir Word](DESENVOLVIMENTO_E_TESTES.docx) |
| Histórico e decisões | Evolução, referências do professor, decisões superadas e pendências | [Abrir Markdown](HISTORICO_E_DECISOES.md) | [Abrir Word](HISTORICO_E_DECISOES.docx) |

## Situação do projeto

BotecoRate é um aplicativo Expo/React Native para Android e iOS. Usa SQLite no aparelho e sincronização direta de registros com o Firebase Realtime Database pelo SDK modular, seguindo a organização do exemplo combinado do professor. As contas online usam Firebase Authentication com e-mail e senha; contas locais são restritas à consulta. O banco atual é `botecorate.db`, esquema versão 10.

| Frente | Situação registrada |
| --- | --- |
| Banco, fila e sincronização | Implementados com versões, histórico, conflitos e isolamento por conta |
| Administração e moderação | Implementadas com justificativas e auditoria |
| Validação de donos e CNPJ | Aprovação administrativa, pedidos adicionais em lote e seleção no cadastro implementados |
| Copropriedade e transferência | Convites, dono substituído e consenso implementados |
| Custódia administrativa | Implementada com abertura/encerramento justificados |
| Lixeira | Consulta paginada, filtros e restauração online implementados |
| Expurgo definitivo | Manual e automático após 30 dias ainda pendentes |
| Endereço e fotos | Endereço separado, ViaCEP/manual e Base64 no RTDB implementados |
| Históricos e interface | Busca, filtros, páginas, erro vermelho e gesto de atualização implementados |
| Testes | 135 testes Jest aprovados na execução com emulador; Maestro preparado sem execução em dispositivo |
| Validação física | Rodada anterior em dois Android concluída nos casos disponíveis; regressões recentes e iOS ainda necessários |

Correios com integração direta, limpeza das réplicas após hard delete e demais evoluções estão no guia de decisões. Implementado descreve a entrega no código e sua evidência; não substitui o teste físico de cada fluxo.

## Como manter este conjunto

Edite o guia que trata do assunto, atualize sua situação sem deixar propostas antigas como se fossem regras vigentes e registre decisões relevantes no histórico. Use o mesmo identificador de versão na revisão conjunta. Depois gere e confira os Word:

```powershell
python -m pip install -r scripts/requirements-docs.txt
python scripts/build-docs.py
python scripts/build-docs.py --check
```

Os comandos são executados de BotecoRate. O verificador compara a fonte Markdown e o conteúdo dos arquivos Word e detecta uma versão desatualizada. Inclua ambos no commit. Mantenha tabelas e comandos legíveis e revise as páginas quando houver mudança de layout.

Evite abrir um novo documento para cada correção. Regras ficam no guia de negócio; estrutura e protocolo no de banco; comandos e roteiros no de desenvolvimento; evolução no histórico. O mapa dos documentos anteriores está no histórico. A cópia integral anterior foi preservada em `.backups/documentacao-antes-consolidacao-*.zip`, fora do versionamento.

As versões Word mantêm os mesmos rótulos e destinos de referência da fonte. Links Markdown são relativos à pasta `docs`; no Word podem ser abertos junto aos arquivos do mesmo diretório. Títulos, paginação e cabeçalho/rodapé compõem apenas a apresentação.

## Antes da próxima alteração

Confira o código atual e as pendências; preserve filas e dados dos aparelhos; atualize documentação e testes proporcionais à mudança. Credenciais administrativas e arquivos de ambiente ficam privados. Gerar documentação não altera esquema, conteúdo do banco ou regras remotas.
