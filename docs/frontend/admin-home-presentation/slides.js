window.HOME_PRESENTATION = {
  "title": "Lazuli · Estados da página inicial",
  "date": "2026-10-23",
  "sourceCommit": "e4d7219e",
  "viewport": "1440 × 1000",
  "screenCount": 45,
  "essential": [
    "few_pending",
    "mixed_priorities",
    "coverage_now",
    "entry_tomorrow_vs_coverage_six_days",
    "placement_wait_old",
    "quiet",
    "first_use",
    "detail_populated",
    "month_previous",
    "without_finance",
    "loading_all",
    "error_home_stale",
    "kpi_debt"
  ],
  "slides": [
    {
      "slug": "few_pending",
      "title": "Poucas pendências",
      "trigger": "Três alunos sem turma; dia sem compromissos restantes.",
      "emphasis": "Uma frente clara, com uma prévia dos casos. Nenhuma área é reservada para pendências inexistentes.",
      "action": "Definir turmas",
      "chapter": "A página se adapta",
      "image": "screens/few_pending.webp",
      "essential": true,
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "mixed_priorities",
      "title": "Várias naturezas ao mesmo tempo",
      "trigger": "Aula hoje, entrada amanhã, registros de ontem e pedidos em espera.",
      "emphasis": "A aula de hoje lidera; as demais frentes mantêm seu motivo de atenção. Não há soma global de pendências.",
      "action": "Definir professor",
      "chapter": "A página se adapta",
      "image": "screens/mixed_priorities.webp",
      "essential": true,
      "observed": {
        "heading": "Defina quem conduz a próxima aula",
        "state": "today",
        "tone": "warning"
      }
    },
    {
      "slug": "quiet",
      "title": "Sem pendências e sem agenda",
      "trigger": "Nenhuma fila atual ou compromisso restante; escola em atividade.",
      "emphasis": "A triagem fica em uma linha. A página se dedica ao movimento da escola.",
      "action": "Explorar indicadores",
      "chapter": "A página se adapta",
      "image": "screens/quiet.webp",
      "essential": true,
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "quiet_agenda",
      "title": "Sem pendências, com agenda",
      "trigger": "Nenhuma fila pedagógica; ainda há um compromisso no dia.",
      "emphasis": "Os indicadores e o histórico da escola sobem. A agenda acompanha os dados, sem premiar a ausência de problemas.",
      "action": "Abrir agenda",
      "chapter": "A página se adapta",
      "image": "screens/quiet_agenda.webp",
      "essential": false,
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "history_only",
      "title": "Só restam registros antigos",
      "trigger": "Nenhuma pendência recente; 618 aulas e 25 atendimentos anteriores aos últimos sete dias.",
      "emphasis": "O histórico mantém um acesso compacto. O volume antigo não disputa o destaque do trabalho atual.",
      "action": "Abrir histórico de registros",
      "chapter": "A página se adapta",
      "image": "screens/history_only.webp",
      "essential": false,
      "note": "O número grande representa encontros antigos; não é uma contagem de alunos nem uma medida de urgência.",
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "contracts_only",
      "title": "Só há trabalho contratual",
      "trigger": "Nove primeiros contratos a preparar, sem pendências pedagógicas.",
      "emphasis": "O trabalho contratual continua acessível no resumo de gestão; não ocupa o destaque pedagógico.",
      "action": "Preparar contratos",
      "chapter": "A página se adapta",
      "image": "screens/contracts_only.webp",
      "essential": false,
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "overlap",
      "title": "O mesmo aluno em duas frentes",
      "trigger": "Dez alunos sem turma e dez primeiros contratos para as mesmas pessoas.",
      "emphasis": "Duas filas independentes. A página não afirma que existem vinte pessoas com pendências.",
      "action": "Definir turmas / preparar contratos",
      "chapter": "A página se adapta",
      "image": "screens/overlap.webp",
      "essential": false,
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "first_use",
      "title": "Primeiro acesso de uma escola vazia",
      "trigger": "Sem alunos, turmas movimentadas, contratos, histórico ou agenda.",
      "emphasis": "Uma orientação concreta para começar. O cadastro pode avançar sem turma e contrato.",
      "action": "Começar pelos alunos",
      "chapter": "A página se adapta",
      "image": "screens/first_use.webp",
      "essential": true,
      "observed": {
        "heading": "Vamos dar vida à sua escola.",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "zero_activity",
      "title": "Escola existente, mês sem movimento",
      "trigger": "Há 230 alunos ativos, mas nenhum movimento nos indicadores do período.",
      "emphasis": "Zero atividade não é confundido com escola nova. Os indicadores explicam o período, sem crescimento inventado.",
      "action": "Explorar turmas ou trocar o mês",
      "chapter": "A página se adapta",
      "image": "screens/zero_activity.webp",
      "essential": false,
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "coverage_now",
      "title": "Aula em andamento sem professor",
      "trigger": "Aula de hoje, 14h–15h, sem professor às 14h30.",
      "emphasis": "Ação imediata em vermelho e horário da turma.",
      "action": "Definir professor",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/coverage_now.webp",
      "essential": true,
      "observed": {
        "heading": "A aula começou sem professor definido",
        "state": "ongoing",
        "tone": "destructive"
      }
    },
    {
      "slug": "coverage_today",
      "title": "Aula ainda hoje",
      "trigger": "Aula de hoje, 18h–19h, sem professor às 14h30.",
      "emphasis": "Prioridade de hoje em amarelo, distinta da aula já iniciada.",
      "action": "Definir professor",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/coverage_today.webp",
      "essential": false,
      "observed": {
        "heading": "Defina quem conduz a próxima aula",
        "state": "today",
        "tone": "warning"
      }
    },
    {
      "slug": "coverage_tomorrow",
      "title": "Aula amanhã",
      "trigger": "Aula sem professor amanhã às 9h.",
      "emphasis": "Próxima aula e prazo de um dia explícitos.",
      "action": "Definir professor",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/coverage_tomorrow.webp",
      "essential": false,
      "observed": {
        "heading": "Defina quem conduz a próxima aula",
        "state": "soon",
        "tone": "warning"
      }
    },
    {
      "slug": "coverage_week",
      "title": "Aula em seis dias",
      "trigger": "Aula sem professor daqui a seis dias às 9h.",
      "emphasis": "Agenda futura sem cor de urgência imediata.",
      "action": "Definir professor",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/coverage_week.webp",
      "essential": false,
      "observed": {
        "heading": "Defina quem conduz a próxima aula",
        "state": "scheduled",
        "tone": "neutral"
      }
    },
    {
      "slug": "entry_overdue",
      "title": "Data de entrada já passou",
      "trigger": "A entrada de um aluno em turma estava prevista para ontem; há aula sem professor amanhã.",
      "emphasis": "Revisão de data lidera, em vermelho, antes da aula de amanhã.",
      "action": "Revisar datas de entrada",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/entry_overdue.webp",
      "essential": false,
      "observed": {
        "heading": "Revise as datas de entrada",
        "state": "date-passed",
        "tone": "destructive"
      }
    },
    {
      "slug": "entry_today",
      "title": "Entrada prevista hoje",
      "trigger": "A entrada de um aluno em turma está prevista para hoje.",
      "emphasis": "Confirmação da entrada no dia certo, com data de entrada visível.",
      "action": "Confirmar entradas em turma",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/entry_today.webp",
      "essential": false,
      "observed": {
        "heading": "Prepare a entrada dos alunos",
        "state": "today",
        "tone": "warning"
      }
    },
    {
      "slug": "entry_tomorrow_vs_coverage_six_days",
      "title": "Entrada amanhã supera aula em seis dias",
      "trigger": "Entrada prevista amanhã; aula sem professor daqui a seis dias.",
      "emphasis": "A proximidade da entrada supera a categoria fixa de cobertura.",
      "action": "Confirmar entradas em turma",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/entry_tomorrow_vs_coverage_six_days.webp",
      "essential": true,
      "observed": {
        "heading": "Prepare a entrada dos alunos",
        "state": "soon",
        "tone": "warning"
      }
    },
    {
      "slug": "semester_planning",
      "title": "Planejamento do semestre",
      "trigger": "Primeira entrada prevista daqui a 14 dias.",
      "emphasis": "Continuidade visível sem urgência artificial.",
      "action": "Confirmar entradas em turma",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/semester_planning.webp",
      "essential": false,
      "observed": {
        "heading": "Prepare a entrada dos alunos",
        "state": "plan",
        "tone": "neutral"
      }
    },
    {
      "slug": "placement_wait_old",
      "title": "Nivelamento em espera prolongada",
      "trigger": "Prova recebida há oito dias; aula sem professor daqui a cinco dias.",
      "emphasis": "Espera conhecida ganha destaque, sem alegar SLA contratual.",
      "action": "Corrigir nivelamentos",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/placement_wait_old.webp",
      "essential": true,
      "note": "Sete dias é o limiar local de atenção da home. Não representa SLA ou prazo contratado.",
      "observed": {
        "heading": "Defina o estágio de entrada",
        "state": "waiting",
        "tone": "warning"
      }
    },
    {
      "slug": "placement_wait_recent",
      "title": "Nivelamento recebido recentemente",
      "trigger": "Prova recebida há dois dias, sem outro trabalho pendente.",
      "emphasis": "Encaminhamento visível e neutro, sem prazo inventado.",
      "action": "Corrigir nivelamentos",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/placement_wait_recent.webp",
      "essential": false,
      "observed": {
        "heading": "Defina o estágio de entrada",
        "state": "waiting",
        "tone": "neutral"
      }
    },
    {
      "slug": "allocation_wait_old",
      "title": "Pedido de turma em espera prolongada",
      "trigger": "Pedido de turma recebido há dez dias.",
      "emphasis": "Tempo de espera conhecido em destaque amarelo.",
      "action": "Encontrar uma turma",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/allocation_wait_old.webp",
      "essential": false,
      "note": "Sete dias é o limiar local de atenção da home. Não representa SLA ou prazo contratado.",
      "observed": {
        "heading": "Dê andamento à espera por turma",
        "state": "waiting",
        "tone": "warning"
      }
    },
    {
      "slug": "allocation_wait_known",
      "title": "Pedido de turma em espera de cinco dias",
      "trigger": "Pedido de turma recebido há cinco dias.",
      "emphasis": "Tempo de espera explícito com tom neutro.",
      "action": "Encontrar uma turma",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/allocation_wait_known.webp",
      "essential": false,
      "observed": {
        "heading": "Dê andamento à espera por turma",
        "state": "waiting",
        "tone": "neutral"
      }
    },
    {
      "slug": "records_yesterday",
      "title": "Registros de ontem por concluir",
      "trigger": "Duas aulas e um atendimento de ontem sem registro.",
      "emphasis": "Registros de dia anterior sobem na triagem; frentes seguem separadas.",
      "action": "Conferir registros de aula",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/records_yesterday.webp",
      "essential": false,
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "records_today",
      "title": "Registros de hoje por concluir",
      "trigger": "Duas aulas e um atendimento encerrados hoje sem registro.",
      "emphasis": "Acompanhamento atual sem falsa urgência de ontem.",
      "action": "Conferir registros de aula",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/records_today.webp",
      "essential": false,
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "appointments_only",
      "title": "Atendimento aguardando registro",
      "trigger": "Um atendimento terminou ontem e ainda não tem resultado registrado.",
      "emphasis": "O destaque se adapta ao atendimento, com chamada própria para registrar o resultado.",
      "action": "Registrar atendimentos",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/appointments_only.webp",
      "essential": false,
      "observed": {
        "heading": "Conclua os atendimentos realizados",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "students_no_deadline",
      "title": "Alunos aguardando turma, sem prazo conhecido",
      "trigger": "Um aluno ativo sem matrícula atual ou futura; nenhum marco temporal informado.",
      "emphasis": "Tarefa alcançável sem rótulo de hoje ou atraso.",
      "action": "Definir turmas",
      "chapter": "Prioridades pedagógicas",
      "image": "screens/students_no_deadline.webp",
      "essential": false,
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "detail_populated",
      "title": "Uma frente aberta",
      "trigger": "Vinte e oito aulas recentes por registrar; doze por página.",
      "emphasis": "Cada encontro tem turma, contexto, data e acesso ao registro. A administração acompanha a conclusão com o professor.",
      "action": "Abrir um encontro",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_populated.webp",
      "essential": true,
      "note": "A tabela aparece depois de escolher uma frente. A visão geral mantém a triagem por prioridade e natureza.",
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "recent"
        }
      }
    },
    {
      "slug": "detail_page_two",
      "title": "Mais casos na mesma frente",
      "trigger": "O usuário avança para a segunda página dos 28 encontros.",
      "emphasis": "O volume fica no detalhe. A posição e o total permanecem explícitos.",
      "action": "Continuar pelos próximos encontros",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_page_two.webp",
      "essential": false,
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 2,
          "period": "recent"
        }
      }
    },
    {
      "slug": "detail_history",
      "title": "Histórico separado do trabalho recente",
      "trigger": "O usuário escolhe os registros anteriores aos últimos sete dias.",
      "emphasis": "O histórico tem período próprio; a página volta ao início e mantém a mesma estrutura de consulta.",
      "action": "Consultar registros anteriores",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_history.webp",
      "essential": false,
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "detail_loading",
      "title": "Abrindo uma frente",
      "trigger": "O usuário abre os registros de aula; os casos ainda estão carregando.",
      "emphasis": "O contexto da frente e os controles de período já estão presentes. As linhas antecipam a tabela.",
      "action": "Aguardar os casos",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_loading.webp",
      "essential": false,
      "note": "Captura estática do carregamento. A duração e a qualidade da animação precisam ser avaliadas na aplicação.",
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "recent"
        }
      }
    },
    {
      "slug": "detail_empty",
      "title": "A frente foi resolvida",
      "trigger": "A consulta da primeira página retorna sem casos.",
      "emphasis": "A frente informa que está em dia e permite voltar à visão geral.",
      "action": "Voltar à visão da escola",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_empty.webp",
      "essential": false,
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "detail_empty_page",
      "title": "A página ficou vazia",
      "trigger": "Os registros mudaram depois da paginação e não há casos na segunda página.",
      "emphasis": "A mensagem explica a mudança e orienta a voltar uma página. Não transforma a fila inteira em concluída.",
      "action": "Voltar uma página",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_empty_page.webp",
      "essential": false,
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 2,
          "period": "recent"
        }
      }
    },
    {
      "slug": "detail_error",
      "title": "Falha ao abrir os casos",
      "trigger": "A consulta dos casos falha.",
      "emphasis": "O título e o período da frente permanecem. A tabela oferece nova tentativa.",
      "action": "Tentar novamente",
      "chapter": "Da triagem à ação",
      "image": "screens/detail_error.webp",
      "essential": false,
      "observed": {
        "heading": "Aulas por registrar",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "month_previous",
      "title": "Indicadores de um mês encerrado",
      "trigger": "O usuário consulta o mês anterior.",
      "emphasis": "O período escolhido fica na URL. Os indicadores mudam de mês; as pendências continuam representando a situação atual.",
      "action": "Explorar o mês ou abrir uma pendência",
      "chapter": "Período, acesso e volume",
      "image": "screens/month_previous.webp",
      "essential": true,
      "note": "As séries e os valores são ilustrativos. A pendência e o saldo em atraso continuam atuais, mesmo ao consultar outro mês.",
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "filter_loading",
      "title": "Troca do mês em andamento",
      "trigger": "O usuário muda o período dos indicadores; as consultas mensais ainda estão carregando.",
      "emphasis": "A triagem atual continua disponível. Apenas os indicadores e o financeiro aguardam o novo período.",
      "action": "Continuar a triagem enquanto os dados carregam",
      "chapter": "Período, acesso e volume",
      "image": "screens/filter_loading.webp",
      "essential": false,
      "note": "Captura estática do carregamento. A duração e a qualidade da animação precisam ser avaliadas na aplicação.",
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "chart_values",
      "title": "Os valores por trás do gráfico",
      "trigger": "O usuário escolhe Ver valores na evolução da escola.",
      "emphasis": "A mesma série fica disponível em tabela, com mês, alunos e matrículas.",
      "action": "Consultar os números ou voltar ao gráfico",
      "chapter": "Período, acesso e volume",
      "image": "screens/chart_values.webp",
      "essential": false,
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "input": {
          "kind": "lessons",
          "page": 1,
          "period": "history"
        }
      }
    },
    {
      "slug": "without_finance",
      "title": "Sem acesso ao financeiro",
      "trigger": "A visualização administrativa recebe a permissão financeira desativada.",
      "emphasis": "Indicadores pedagógicos e da escola permanecem. Não aparece coluna vazia nem conteúdo financeiro.",
      "action": "Corrigir nivelamentos ou definir turmas",
      "chapter": "Período, acesso e volume",
      "image": "screens/without_finance.webp",
      "essential": true,
      "note": "Permissão simulada na interface. Hoje, os dois perfis administrativos disponíveis têm acesso financeiro; este cenário não comprova uma sessão real sem essa permissão.",
      "observed": {
        "heading": "Defina o estágio de entrada",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "busy_agenda",
      "title": "Agenda cheia",
      "trigger": "Doze compromissos entre aulas, atendimentos, nivelamentos e experimentais.",
      "emphasis": "A prévia tem altura limitada e acesso ao conjunto completo. Ela não estica a página indefinidamente.",
      "action": "Ver os 12 compromissos",
      "chapter": "Período, acesso e volume",
      "image": "screens/busy_agenda.webp",
      "essential": false,
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "high_volume",
      "title": "Volume alto e nomes extensos",
      "trigger": "Mais de mil casos em diferentes frentes e mais de mil compromissos.",
      "emphasis": "Números em pt-BR, nomes com quebra de linha e prioridades separadas por natureza. O volume não define gravidade.",
      "action": "Abrir a frente relevante",
      "chapter": "Período, acesso e volume",
      "image": "screens/high_volume.webp",
      "essential": false,
      "note": "Cenário de estresse visual com contagens extremas. Não é uma projeção do volume real da escola.",
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "loading_all",
      "title": "Carregamento inicial",
      "trigger": "A escola e o resumo financeiro ainda não responderam.",
      "emphasis": "Skeletons antecipam destaque, casos, agenda e indicadores; não anunciam urgência antes dos dados.",
      "action": "Aguardar conteúdo",
      "chapter": "Carregamento e recuperação",
      "image": "screens/loading_all.webp",
      "essential": true,
      "note": "Captura estática do carregamento. A duração e a qualidade da animação precisam ser avaliadas na aplicação.",
      "observed": {
        "heading": "Prioridades pedagógicas",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "loading_finance",
      "title": "Escola pronta, financeiro carregando",
      "trigger": "A consulta pedagógica terminou antes da consulta financeira.",
      "emphasis": "As ações pedagógicas já estão disponíveis. Apenas o resumo financeiro mantém o carregamento.",
      "action": "Atuar nas pendências disponíveis",
      "chapter": "Carregamento e recuperação",
      "image": "screens/loading_finance.webp",
      "essential": false,
      "note": "Captura estática do carregamento. A duração e a qualidade da animação precisam ser avaliadas na aplicação.",
      "observed": {
        "heading": "Encontre a turma de cada aluno",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "loading_school",
      "title": "Financeiro pronto, escola carregando",
      "trigger": "O resumo financeiro respondeu antes dos dados da escola.",
      "emphasis": "O financeiro pode ser lido enquanto as posições da triagem e dos indicadores aguardam dados.",
      "action": "Aguardar prioridades pedagógicas",
      "chapter": "Carregamento e recuperação",
      "image": "screens/loading_school.webp",
      "essential": false,
      "note": "Captura estática do carregamento. A duração e a qualidade da animação precisam ser avaliadas na aplicação.",
      "observed": {
        "heading": "Prioridades pedagógicas",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "error_home_initial",
      "title": "Falha no primeiro carregamento da escola",
      "trigger": "A consulta da escola falha antes de existir uma resposta válida.",
      "emphasis": "Mensagem de recuperação sem fingir que não há pendências; o financeiro independente permanece disponível.",
      "action": "Tentar novamente",
      "chapter": "Carregamento e recuperação",
      "image": "screens/error_home_initial.webp",
      "essential": false,
      "observed": {
        "heading": "Movimento da escola",
        "state": null,
        "tone": null
      }
    },
    {
      "slug": "error_home_stale",
      "title": "Falha ao atualizar a escola",
      "trigger": "Já havia uma visão carregada, mas a atualização falhou.",
      "emphasis": "Um aviso informa a falha e preserva os alunos, a agenda e as pendências da última resposta.",
      "action": "Tentar novamente; consultar a última visão",
      "chapter": "Carregamento e recuperação",
      "image": "screens/error_home_stale.webp",
      "essential": true,
      "observed": {
        "heading": "Defina o estágio de entrada",
        "state": "organize",
        "tone": "neutral"
      }
    },
    {
      "slug": "error_finance_initial",
      "title": "Financeiro indisponível",
      "trigger": "A consulta financeira falha sem dados anteriores; a escola carregou.",
      "emphasis": "O aviso fica no resumo financeiro. Pendências pedagógicas e tarefas contratuais conhecidas continuam acessíveis.",
      "action": "Tentar novamente / preparar contratos",
      "chapter": "Carregamento e recuperação",
      "image": "screens/error_finance_initial.webp",
      "essential": false,
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "error_finance_stale",
      "title": "Falha ao atualizar o financeiro",
      "trigger": "A consulta financeira falha depois de já ter carregado valores.",
      "emphasis": "O aviso acompanha os últimos valores e mantém as tarefas contratuais, sem paralisar a triagem.",
      "action": "Tentar novamente",
      "chapter": "Carregamento e recuperação",
      "image": "screens/error_finance_stale.webp",
      "essential": false,
      "observed": {
        "heading": "Acompanhe os registros de aula",
        "state": "record",
        "tone": "neutral"
      }
    },
    {
      "slug": "priority_rules",
      "title": "O que determina a prioridade",
      "chapter": "Critérios e limites",
      "kind": "rules",
      "essential": false,
      "trigger": "A posição depende do horário, da data e do tempo de espera conhecido.",
      "emphasis": "O volume descreve a frente; ele não aumenta sua gravidade.",
      "action": "Revisar se os critérios correspondem à rotina da escola."
    },
    {
      "slug": "kpi_debt",
      "title": "O que ainda precisa ser revisitado",
      "chapter": "Critérios e limites",
      "kind": "debt",
      "essential": true,
      "trigger": "A entrega usa indicadores e regras locais da página inicial.",
      "emphasis": "O modelo canônico de KPIs é um débito explicitamente aceito para esta entrega.",
      "action": "Definir conceitos, responsáveis e contrato comum antes de reutilizar em outras telas."
    }
  ]
};
