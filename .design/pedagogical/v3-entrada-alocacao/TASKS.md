# V3 — Entrada e alocação

Issue: https://github.com/josiasrfreitas/lazuli/issues/168

Parte do épico #156. Execução autorizada pelo pedido de implementar autonomamente as verticais, criar seus issues, commitar incrementalmente e entregar um PR por vertical. Esta issue consolida o recorte V3 e substitui, para esta entrega, a espera por workshop do rascunho do épico.

## Resultado

A administração acompanha interessados, registra estágio indicado e disponibilidade válida, encontra turmas compatíveis, agenda aulas experimentais ou introdutórias e efetiva matrícula sem confundir presença com vínculo acadêmico.

## Critérios de aceite

- Cadastro mínimo do interessado: nome e pelo menos telefone ou e-mail; observações opcionais, vínculo opcional a aluno existente. Não exigir CPF nem criar matrícula no cadastro.
- Registrar modalidade regular/PPT, presencial/online, estágio indicado externamente, faixas semanais de disponibilidade e data de validade explícita. Editar/renovar com autoria e data. Disponibilidade vencida não altera matrícula existente; bloqueia novas alocações que dependam dela até atualização.
- Listagem pesquisável, paginada, com interessados aguardando alocação, convertidos e arquivados. Mostrar disponibilidade vencida. Sem ranking automático ou promessa de reserva.
- Encontrar turmas ativas no semestre da entrada por estágio/modalidade/formato e cobertura de todos os horários recorrentes. Mostrar vagas/capacidade informativas, conforme operação vigente da V1. Sem alocação automática.
- Experimental: participação em encontro real de turma existente; data/horário/professor vêm do encontro, inclusive substituição e cancelamento. Convidado não ocupa uma matrícula e não altera frequência acadêmica.
- Introdutória: encontro próprio com professor em atuação, data, horário e formato; impedir sobreposição com turmas, substituições e outras introdutórias em ambas as direções. Aparecer na semana docente.
- Agendar, cancelar com motivo, remarcar preservando a anterior, registrar compareceu/faltou após o início e observações/material orientado. Sem cobrança automática nem catálogo/estoque.
- Matrícula posterior é ação explícita, independente do comparecimento. Escolher aluno existente ou criar o cadastro necessário, preservando regras de responsável para menores. Reutilizar matrícula/progresso de V1, sem duplicar aluno ou matrícula em retry. Registrar interessado convertido e ligação ao vínculo em transação.
- Apenas ADMIN/SYSTEM_ADMIN gerenciam a operação nesta entrega; não ampliar papéis ainda não habilitados. PII permanece no banco.
- Validar fluxos reais no browser em desktop e largura estreita, incluindo persistência, erros, teclado e ausência de overflow. Manter evidências na pasta da vertical.

## Decisões de execução

Disponibilidade usa faixas por dia da semana, sem granularidade artificial de grade, e validade escolhida pelo operador. Capacidade permanece informativa como na V1 atual; convidados são apresentados separadamente. Remarcação é cancelamento com nova ocorrência ligada à anterior. Arquivamento retira da fila sem apagar histórico. Nivelamento continua externo. Acesso docente próprio, QR, frequência e planejamento de conteúdo pertencem às verticais posteriores.

## Entregas incrementais no mesmo PR

1. Interessados, disponibilidade e busca de turmas.
2. Aulas de entrada e integração com agenda docente.
3. Conversão em matrícula, experiência integrada e evidência de browser.

Checks locais limitados aos hooks de commit/push por orientação do usuário; suites completas ficam para CI.

## Direção visual

Referência: operação de Professores (orientação do usuário em 10/10/2026), com tabela operacional, detalhe próprio e formulários compactos. A UI atual de Turmas não é referência de qualidade; seu refinamento deve seguir Professores.

## Contratos a proteger

- Disponibilidade: cada horário da turma deve caber numa faixa do interessado; expiração impede alocação até renovação. Defeito plausível: aceitar apenas um dia compatível de uma turma com dois encontros. A expectativa vem da disponibilidade informada, não do algoritmo.
- Agenda: nenhuma introdutória se sobrepõe a compromisso docente. Defeito plausível: substituição posterior invadir a introdutória já marcada.
- Conversão: um retry devolve o mesmo vínculo; presença nunca cria matrícula. Defeito plausível: queda de conexão duplicar aluno e matrícula.

## Progresso

- [ ] Interessados, disponibilidade e turmas compatíveis.
- [ ] Aulas de entrada e conflitos bidirecionais.
- [ ] Conversão, interface e browser.
