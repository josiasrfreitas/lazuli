# Lazuli Overview

**Sprint:** `SP-001`  
**Data do planejamento:** 18/06/2026  
**Escopo:** MVP do sistema de gestão da escola

## Objetivo do sistema

O sistema concentra a operação diária da escola em três frentes:
 
- alunos, responsáveis, turmas, calendário e matrícula;
- chamada dos professores pelo celular, com controle de frequência por semestre;
- recebíveis, pagamentos registrados, inadimplência e relatórios básicos.

A meta do MVP é reduzir retrabalho na rotina que hoje depende de Legacy, planilhas, papel, Cora e
Portal Portal. O Legacy continua em paralelo no piloto. O sistema novo começa como apoio operacional e
passa a concentrar os dados quando a escola validar o fluxo.

O maior ganho esperado fica na chamada. O professor marca presença pelo celular. A coordenação enxerga
se alguma turma ficou sem chamada. Quando o envio ao Portal passar no teste técnico, o sistema envia as
presenças confirmadas ao portal durante a madrugada. Se o Portal exigir código de segurança ou outro
bloqueio humano, o MVP muda para envio assistido: alguém acompanha o envio e o sistema reduz a
digitação manual.

## Quem usa no MVP

| Perfil | Como entra no MVP | O que faz |
|---|---|---|
| Administração / coordenação | Acesso completo | Alunos, turmas, matrícula, calendário, chamadas, Portal, recebíveis e relatórios |
| Professor | Acesso pelo celular | Vê suas turmas, marca chamada, corrige chamada do dia e consulta histórico |

Os perfis separados de secretaria e financeiro ficam para depois. No MVP, usuários de administração
assumem essas rotinas dentro do sistema.

## Rotina principal

1. A escola importa a base inicial de alunos a partir de uma exportação do Legacy.
2. A administração confere alunos, responsáveis, turmas, estágios e matrículas.
3. O sistema gera sessões de aula a partir do calendário e do horário das turmas.
4. O professor abre a turma do dia no celular, marca faltas e confirma a chamada.
5. A administração acompanha turmas sem chamada, alunos com frequência baixa e pendências de Portal.
6. O sistema tenta enviar ao Portal as chamadas confirmadas, caso o teste do portal permita automação.
7. A administração registra mensalidades, pagamentos e inadimplência no painel de recebíveis.
8. A escola exporta relatórios simples para conferência interna e contabilidade.

## Áreas do sistema

| Área | O que o sistema fará |
|---|---|
| Login e acesso | Permite entrada por conta Google da escola, com link mágico como alternativa. Mostra menus por perfil. |
| Alunos | Guarda contato, documento, endereço, responsável, status, turma atual, frequência, financeiro e observações. |
| Responsáveis | Registra um responsável estruturado para menores, com telefone, e-mail, documento e endereço quando houver. |
| Turmas | Registra modalidade, horário, professor, capacidade, estágio, status e nome usado no Portal. |
| Calendário | Marca feriados, recessos e dias sem aula. Cancela sessões futuras nesses dias. |
| Matrícula | Liga aluno a turma, entrada, saída e estágio pedagógico. Permite avançar aluno de estágio em turma personalizada. |
| Chamada | Professor marca `Presente` ou `Falta` no celular e confirma a sessão. O sistema não salva rascunho no servidor antes da confirmação. |
| Reposição | Coordenação agenda visitante em outra turma. O professor vê o visitante no topo da chamada. |
| Frequência | Calcula percentual por semestre: presenças divididas por aulas confirmadas. Reposição não aumenta o percentual. |
| Portal | Envia chamadas confirmadas para o Portal Portal se o teste técnico permitir. Mostra falhas e permite reenvio. |
| Recebíveis | Registra contratos, parcelas, pagamentos manuais, inadimplência e extrato por aluno. |
| Relatórios | Gera CSV de inadimplência, CSV mensal para contabilidade, PDF de turma e resumo de frequência por aluno. |

## O que entra no MVP

- Acesso da equipe, carga inicial do Legacy e gestão básica de alunos.
- Turmas, calendário, sessões de aula, matrículas e histórico operacional.
- Chamada mobile, reposição, frequência semestral e alertas abaixo de 75%.
- Painel administrativo com acompanhamento de alunos, sessões, Portal e recebíveis.
- Recebíveis manuais, inadimplência, relatórios simples e envio ao Portal condicionado ao teste do portal.

## Pontos a fechar antes da implantação

Alguns detalhes operacionais ainda definem como o MVP deve ser configurado para a rotina real da
escola. Eles não mudam a direção do sistema, mas influenciam importação, automação, regras e relatórios.

- No Portal, o teste precisa confirmar se o login compartilhado exige 2FA ou código externo, e se o portal
  localiza turmas e alunos pelo mesmo padrão usado pela escola.
- A carga inicial depende da exportação real disponível no Legacy. Esse arquivo define o formato do
  script de implantação e o nível de conferência manual necessário.
- Frequência e reposição precisam seguir a regra operacional da escola, especialmente para falta
  justificada, cálculo dos 75% e impacto de reposições no percentual.
- Em recebíveis, o MVP parte de registro manual. A configuração deve refletir a regra atual de multa,
  juros e a prioridade usada pela escola para organizar cobranças.
- Os relatórios e perfis de acesso devem acompanhar o uso real do piloto: arquivos já pedidos pela
  contabilidade, consultas da coordenação e pessoas que precisam entrar desde o primeiro dia.

## Mockups conceituais

As imagens abaixo mostram uma direção de produto, não a interface final. O nome visual, a paleta, o
estilo dos cards e a composição das telas podem mudar após revisão de usabilidade, responsividade e
identidade da escola.

### Login

![Login conceitual](../../../tmp/mock/screenshots/02-login.png)

### Dashboard da administração

![Dashboard da administração](../../../tmp/mock/screenshots/03-admin-dashboard.png)

### Lista de alunos

![Lista de alunos](../../../tmp/mock/screenshots/04-students-list.png)

### Perfil do aluno

![Perfil do aluno](../../../tmp/mock/screenshots/05-student-profile.png)

### Lista de turmas

![Lista de turmas](../../../tmp/mock/screenshots/06-classes-list.png)

### Recebíveis

![Recebíveis](../../../tmp/mock/screenshots/07-receivables.png)

### Tela inicial do professor no celular

![Tela inicial do professor](../../../tmp/mock/screenshots/08-teacher-home-mobile.png)

### Chamada do professor no celular

![Chamada do professor](../../../tmp/mock/screenshots/09-teacher-attendance-mobile.png)

### Histórico do professor no celular

![Histórico do professor](../../../tmp/mock/screenshots/10-teacher-history-mobile.png)

## Leitura dos mockups

Os mockups devem ser lidos como uma proposta de fluxo, não como a tela final. O mais importante nesta
etapa é comparar a proposta com a rotina real da escola.

Vale observar se cada tela mostra as informações certas no momento certo, se os papéis estão corretos e
se alguma regra operacional foi simplificada demais.

Também é útil separar o que precisa estar no primeiro piloto do que pode esperar. Essa leitura ajuda a
ajustar escopo, prioridade e detalhes de implantação antes da construção.
