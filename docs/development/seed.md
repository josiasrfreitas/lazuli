# Escola de desenvolvimento

O comando público `pnpm seed` reconstrói o banco e o bucket isolados do workspace conforme a
[decisão 0024](../decisions/0024-rebuild-development-data-through-one-seed.md). Não preserva
validações manuais. A execução precisa ser coordenada com quem estiver validando aquele workspace.
Os loaders internos não são comandos incrementais de atualização.

Este cenário sustenta a operação cotidiana de uma escola de inglês de aproximadamente 250 alunos.
Todos os nomes e contatos são sintéticos. A data de referência é o dia civil da escola em
`America/Sao_Paulo`; vencimentos, semestre, entradas, visitas e pagamentos acompanham essa data.

| População                                 | Quantidade | Situação                                                              |
| ----------------------------------------- | ---------: | --------------------------------------------------------------------- |
| Alunos alocados em classes regulares      |        188 | Uma matrícula e um estágio vigente por aluno                          |
| Alunos alocados em classes personalizadas |         32 | Estágios individuais, sem estágio compartilhado da classe             |
| Alunos ativos aguardando alocação         |         10 | Cadastro e candidato de entrada vinculados; sem matrícula ou contrato |
| Alunos suspensos                          |         10 | Sem alocação ou contrato vigentes                                     |
| Alunos inativos                           |         10 | Sem alocação ou contrato vigentes                                     |
| Interessados adicionais                   |         12 | Entidades de entrada separadas; não integram os 250 alunos            |

Dos 250 alunos, 172 são menores de idade e possuem responsável. Quinze pares de irmãos novos
compartilham o mesmo registro de responsável e o mesmo pagador. Cada irmão conserva seu próprio
cadastro, matrícula, contrato e histórico de pagamentos. Os contatos dos responsáveis e pagadores
não substituem a identidade dos alunos.

As 16 classes e os 160 alunos do cenário anterior continuam primeiro na sequência, conservando
suas chaves e identificadores derivados. As seis classes adicionais completam 22 classes com média
de dez alunos: 19 regulares e três personalizadas. A ocupação varia de quatro a 14; as capacidades
são 16 no regular e 12 no personalizado. Sete docentes possuem perfis e horários sem sobreposição;
crianças estudam à tarde e os grupos adultos à noite. Há capacidade para entradas e reposições.
A S2A, regular adulta, nasce online; as outras 21 turmas são presenciais. Seus horários, alunos e
identificadores são preservados. Ela não participa das visitas de entrada sintéticas, que continuam
usando as turmas presenciais já definidas; contratos, notas e planos mantêm os mesmos fatos.

## Calendário, entrada e frequência

O semestre segue a metade civil do ano. Feriados nacionais de data fixa são dias de fechamento,
sem sessões ou frequência. Este recorte não pretende reproduzir recessos, feriados móveis ou
feriados municipais de uma escola específica.

Entradas são distribuídas entre o início do semestre, duas semanas depois e cinco semanas depois.
Quando o seed roda antes dessas datas, a entrada é limitada ao dia atual. Cada matrícula possui uma
ação de entrada aplicada. A frequência inclui apenas sessões anteriores a hoje e na janela da
matrícula; não há presenças anteriores à entrada ou lançamentos em sessões futuras. Sessões passadas
possuem confirmação e docente responsável congelado. O horário de registro é 23h59 de São Paulo,
após o encerramento das classes noturnas.

A maioria tem frequência próxima de 92%; 13 alunos alocados têm perfil de frequência próximo de
50%, permitindo identificar situações que exigem acompanhamento. Até cinco reposições ligam
alunos de E1A, que estuda segunda e quarta à tarde, a sessões de E1B, terça e quinta à noite.
Três ficam agendadas e até duas são realizadas, conforme existam sessões elegíveis. Nenhuma
reposição antecede sua ausência ou conflita com o horário regular do aluno.

Dez alunos PPT podem mostrar um estágio anterior concluído e um vigente. O estágio anterior ocupa
os primeiros 60 dias da matrícula e termina no dia anterior à progressão. O histórico só é criado
quando a progressão já ocorreu na data de referência; no início do semestre aparece apenas o
estágio vigente. Classes regulares mantêm o estágio compartilhado.

A entrada contém dez interessados novos em espera, dois arquivados, dez alunos já cadastrados
aguardando alocação e seis entradas convertidas vinculadas à matrícula existente. Visitas
experimentais usam sessões reais das classes; introduções do personalizado usam horários livres
na sexta-feira. As experimentais futuras são distribuídas por semanas para preservar capacidade.
Se o semestre não oferece uma sessão elegível, o candidato fica sem visita. Disponibilidades
expiradas aparecem nos arquivados. Introduções evitam os dias de fechamento.

## Leads comerciais

Os mesmos 28 candidatos possuem dados comerciais: 20 em espera, dois arquivados e seis convertidos.
Os 12 interessados adicionais continuam separados dos alunos; dez dos candidatos em espera já têm
cadastro de aluno aguardando alocação. Cada candidato conserva sua chave e seu identificador.

Três interessados em espera (`prospect-3`, `prospect-5` e `prospect-9`) representam cadastro rápido:
modalidade, formato, estágio e disponibilidade ainda são desconhecidos. Não possuem horários nem
visitas. Os demais conservam a definição pedagógica e os tipos de visita anteriores, sujeitos à
existência de sessões elegíveis no semestre.

Todos possuem origem comercial, responsável interno vinculado ao administrador de desenvolvimento
e de um a três contatos passados com autoria. As origens incluem Instagram, indicação de aluno,
site, WhatsApp e visita à escola. Quatro prospects têm o responsável como pessoa de contato; alunos
com responsável também usam seu nome no contato comercial, conservando a identidade do aluno.
Telefones e e-mails existentes são preservados.

Na fila em espera, seis próximas ações estão vencidas há três dias, seis vencem hoje, quatro ficam
para cinco dias depois e quatro candidatos não possuem próximo passo. Arquivados e convertidos
não possuem próxima ação nem integram a fila ativa. O último contato dos arquivados registra o
encerramento; o dos convertidos registra o acordo antes da entrada. Os contatos ocorrem após a
criação do candidato e antes da referência atual; os convertidos também têm histórico anterior à
matrícula. Candidato e histórico comercial são criados juntos, sem atualização parcial do banco
que estiver em uso.

## Contratos e recebimentos

Os 220 alunos alocados possuem contratos anuais separados, distribuídos por 205 pagadores. Os
acordos se distribuem por nove meses, de oito meses antes da referência até o mês atual, com
44, 32, 28, 24, 26, 22, 18, 16 e dez contratos. A vigência começa no primeiro vencimento, pelo
menos sete dias após o acordo, e dura 12 meses; a janela comercial não é a janela de matrícula. Mensalidades nominais variam de R$ 200 a R$ 250,
com dias de vencimento entre 5 e 25 e desconto por pontualidade definido nos ajustes financeiros.
Nenhuma parcela futura recebe pagamento.

| Perfil            | Contratos | Recebimentos                                                             |
| ----------------- | --------: | ------------------------------------------------------------------------ |
| Pontual           |       187 | Parcelas já vencidas quitadas com desconto                               |
| Parcial           |        11 | Última parcela vencida paga pela metade, sem desconto de quitação        |
| Atrasado          |        11 | De duas a cinco parcelas vencidas em aberto                              |
| Atraso já quitado |        11 | Pagamentos até dez dias depois, com juros calculados pela API financeira |

Isso produz 198 contratos adimplentes e 22 inadimplentes. Preço e dia de vencimento variam entre
coortes para que parciais e atrasados não fiquem todos no mesmo valor ou dia. A profundidade do
atraso distribui saldo pelas faixas de até 30, 31–60, 61–90 e mais de 90 dias.

Os métodos variam por contrato e parcela, com predominância de PIX e presença de cartão,
transferência e dinheiro. A seleção usa uma proporção-base de 60% PIX, 20% cartão, 10% transferência
e 10% dinheiro; o total efetivamente recebido por método acompanha as parcelas pagas, preços,
parciais e períodos escolhidos. O método não determina o perfil de adimplência. Pagamentos pontuais
ocorrem de um a sete dias antes do vencimento, com antecedência de cinco dias em julho e sete em
dezembro. Vencimentos no começo do mês podem, assim, produzir recebimentos no mês anterior.

Os gráficos usam fatos existentes: recebimento pela data do pagamento, cobrança pela data do
vencimento e saldo calculado pelas regras financeiras. As nove coortes de fechamento e a
variação da data de recebimento produzem crescimento inicial e oscilação mensal. O histórico
de contratos começa oito meses antes da referência; pagamentos antecipados sempre ocorrem após
o acordo. Dez contratos são fechados no mês atual, podendo ter vigência futura. Esse recorte não representa um ciclo anual completo de
sazonalidade; meses anteriores ao primeiro fato financeiro têm zero movimento neste cenário.

Pagamentos e ajustes passam pelas regras financeiras existentes, sem
fabricar saldos ou juros diretamente no banco. Irmãos compartilham pagador, conservando contratos
por beneficiário.

## Avaliações e progressão

Cada passagem de estágio do cenário recebe uma avaliação identificada pelo aluno, estágio e data
de início. O progresso referencia essa avaliação; suas notas não pertencem ao vínculo operacional
da classe. O loader não associa registros manuais ou inventa transferências e retornos.

Os 220 estágios atuais distribuem os perfis pretendidos em 66 incompletos, 88 suficientes, 44 com
dificuldades e 22 em recuperação. Essa distribuição descreve o perfil, não garante dois blocos já
lançados: as datas e a presença do aluno prevalecem. Entradas recentes e estágios PPT iniciados
após uma progressão podem ainda não ter notas ou ter apenas o primeiro bloco.

As competências oral, listening, escrita e participação recebem notas individuais entre zero e 100. Há pontos fortes diferentes, melhora entre blocos, pequenas quedas e médias próximas do corte,
incluindo 60. Dificuldades se concentram em oral, listening e escrita; participação também pode
exigir apoio. Alguns alunos apresentam duas competências insuficientes. As médias são separadas;
nenhuma média geral compensa uma competência abaixo de 60.

No estágio atual, o primeiro bloco ocorre a partir de 28 dias e o segundo a partir de 63 dias,
com variações individuais. A data efetiva é uma sessão em que o aluno esteve presente, dentro da
passagem pelo estágio e anterior ao dia atual. Recuperações vêm depois dos dois blocos da própria
competência, preservam os originais, têm motivo e substituem apenas aquela média. Entre os perfis
de recuperação atuais, 14 têm recuperação planejada suficiente e oito ainda insuficiente; a nota
só aparece quando a sessão correspondente já ocorreu.

Nos dez históricos PPT, os dois blocos e eventuais recuperações cabem nos 60 dias antes da
progressão. Três históricos passam por recuperação; todos têm desempenho suficiente confirmado
pela coordenação antes de avançar. As transições são E1→E2 ou C1→C2; o loader rejeita um avanço
para o mesmo estágio.

A maioria das avaliações atuais fica aguardando confirmação. Pequenas coortes com todas as
evidências disponíveis mostram decisões explícitas de aprovação ou repetição, registradas pela
coordenação no dia posterior à última avaliação. Incompletos nunca recebem decisão. Aprovação não
altera a matrícula nem avança automaticamente o estágio. Registros e confirmações têm horários
coerentes com o dia civil de São Paulo e não são lançados no futuro.

O loader integra o único `pnpm seed`; não cria um comando de atualização parcial. Aplicar estes
cenários exige uma reconstrução coordenada do banco isolado depois que a exploração atual tiver
terminado. A implementação do loader não modifica o banco em uso.

## Ocorrências e intervenções

O cenário V10 acrescenta até 38 ocorrências de 22 alunos: 12 pontuais, quatro pares relacionados
sem intervenção e seis intervenções com três ocorrências motivadoras cada. Os relatos cobrem
material, atividade de casa, participação, combinados de convivência, aprendizagem e organização
da rotina. Descrevem situações observáveis e o apoio oferecido, sem rótulos ou diagnósticos.

Cada relato usa uma aula passada com presença confirmada, dentro da matrícula, e o docente
responsável congelado nessa aula. A administração cria e atribui as intervenções; o professor
responsável registra os acompanhamentos. Duas intervenções ficam abertas, duas em andamento,
uma concluída e uma reaberta em andamento. Uma aberta e uma em andamento têm prazo vencido;
o acompanhamento de prática oral ainda não possui prazo definido. A concluída possui resultado e data; na reaberta, a conclusão anterior e seu resultado permanecem
nos acompanhamentos, seguidos do motivo da reabertura. O resultado atual da reaberta é nulo.

Datas respeitam a sequência de aulas, relatos, atribuição e observações posteriores. No começo
do semestre, cenários sem aulas ou tempo suficiente são omitidos, sem fabricar histórico.
Relações usam o par de UUIDs em ordem lexical, e acompanhamentos pertencem a uma ocorrência ou
uma intervenção. Os eventos correspondentes aparecem no log de atividades com autoria e data.

O loader participa da reconstrução completa pelo `pnpm seed`, conforme ADR0024. Cada cenário
é carregado em uma transação. A proteção interna contra duplicidade é um detalhe do loader;
o comando oficial recria a base e substitui também os registros manuais de validação.

## Planejamento de estágio

V9 acrescenta 51 planos atuais: 19 compartilhados por turma regular e 32 individuais PPT.
No regular, 12 roteiros estão detalhados até o fim do semestre, cinco estão parciais e dois apenas
iniciados. No PPT, são 18 detalhados, dez parciais e quatro iniciados. Completude aqui descreve
o roteiro planejado; não comprova conteúdo realizado nem aprovação. Os dez estágios PPT já
avançados também conservam planos históricos enxutos, com prazos anteriores ao avanço real.
Na reconstrução de 11/10/2026, são 61 planos, 984 atividades ativas e três retiradas do roteiro.
No começo do semestre, o número de históricos acompanha os avanços que já puderam ocorrer.
Alunos sem matrícula não recebem planos ou estágios artificiais.

Os roteiros somam aproximadamente mil atividades de conteúdo, revisão, avaliação e prática,
variando entre turmas e alunos. Cerca de 40% não têm páginas; avaliações, revisões e atividades
orais ou lúdicas são válidas assim. Referências de livro, unidades e páginas são sintéticas,
sem pretender reproduzir o sumário oficial dos materiais. Datas usam dias habituais da turma,
evitam fechamentos cadastrados, feriados nacionais fixos e o recesso sintético de 20/12 a 10/01.
Fora do semestre existente, datas PPT são intenções; nenhuma aula ou presença é fabricada.

Oito planos individuais têm travessia explícita de semestre: seis prazos longos até fevereiro
do próximo ano e duas extensões após o semestre atual. Na referência de outubro, os oito
atravessam também o ano. Quatro outros planos têm prazo vencido a revisar, quando há pelo menos
duas semanas reais de estágio; no início do período não se inventa atraso. Os demais prazos
variam conforme início e data atual; perto do fim do semestre também podem atravessar períodos.
Prazo vencido não identifica atividade não realizada e não muda a data efetiva do estágio.

Cada plano possui snapshot inicial v1 com autoria. Quatro planos regulares e oito PPT têm
revisões adicionais; dois PPT recebem duas mudanças, totalizando até 14 revisões além das iniciais.
As alterações ficam 21 e 35 dias após o início, sempre antes do dia atual; sem tempo suficiente,
a revisão é omitida. Em 11/10/2026 há 13 revisões adicionais e 74 snapshots no total: um estágio
iniciado em 04/10 ainda não chegou à primeira revisão prevista em 25/10. Criação usa autoria sintética da administração, primeira revisão do docente
da turma e segunda da administração. Os snapshots guardam o estado completo após cada mudança,
em ordem de data, criação e ID: substituição por revisão sem página, ajuste de prazo/objetivo,
remoção preservada logicamente e repetição intencional de uma referência. Itens removidos mantêm
ID e versão anterior; nunca são apagados do histórico. Criação e cada revisão aparecem no Log.

O vínculo individual é carregado pelo progresso no estágio, sem alterar suas datas, notas ou
frequência. O baseline ainda não inventa transferências ou pausas PPT para demonstrar continuidade;
esses cenários operacionais dependem de fixtures autorizadas. O loader integra exclusivamente
o `pnpm seed`, conforme ADR0024, sem workflow de aplicação parcial.

## Registro e baixa da aula

V4 seleciona as quatro últimas aulas passadas de cada turma, até 88 encontros. Na reconstrução
de 11/10/2026 foram carregadas 87 baixas (75 regulares, 12 PPT), 89 versões, uma aula cancelada
e uma aula sem presentes. As duas correções de conteúdo couberam no recorte; a correção de
presença foi omitida pelas dependências existentes. Na configuração
atual, um encontro regular é cancelado e outro termina sem presentes; os demais recebem conteúdo
realizado. Aulas antigas conservam frequência confirmada sem baixa de conteúdo, distinção visível
na operação. O recorte não cria registros futuros nem transforma automaticamente presença em
conteúdo realizado.

No regular há um relato compartilhado por aula com presentes. No PPT, cada presente tem seu
relato e o estágio vigente naquela data; ausentes não recebem conteúdo individual. Os relatos
variam entre conteúdo com referência e páginas, revisão, verificação de aprendizagem e atividade
oral ou lúdica sem página. Uma verificação não lança nota nem aprova o estágio. Referências são
sintéticas, independentes dos títulos e das páginas do roteiro. Até duas comparações regulares e
duas individuais mostram conteúdo planejado que deu lugar a revisão. Só há comparação quando
existia uma atividade de conteúdo planejada para aquela data.

O snapshot congela a versão do plano existente até o fim do encontro e suas atividades daquela
data, usando a mesma leitura temporal da API. Um plano sem atividade na data tem lista vazia;
um plano ainda não criado na época não é retroativamente associado. Correções preservam essa
intenção inicial e não reescrevem planos, notas ou progressões.

Há até duas substituições passadas, uma regular e uma PPT, cadastradas sinteticamente no dia
anterior. O professor deve estar em atuação e livre de conflitos com aulas, outras substituições
e introduções; a disponibilidade é verificada pelas regras existentes. O titular congelado e
o docente que ministrou a aula permanecem fatos distintos. A chamada e a baixa são atribuídas
ao docente efetivo. Somente nas aulas deste recorte, os horários sintéticos de frequência passam
para cinco minutos após o término e a baixa para dez minutos após, no dia civil de São Paulo.

Três aulas podem ter correção: uma regular e uma PPT recebem complemento do relato pelo docente
no mesmo dia; outra PPT tem presença corrigida pela administração às 15h do dia seguinte. Nesse
caso, o conteúdo do aluno fica na primeira versão, enquanto a versão atual o mostra ausente sem
conteúdo realizado. Motivo, autoria e horário ficam nas revisões, nos metadados de frequência
alterada e no Log. Datas insuficientes ou dependências impedem o cenário, sem fabricar evidência.

Cancelamento, ausência total e troca de presença exigem sessão segura: nenhuma nota naquela data,
ocorrência ou acompanhamento dependente, visita ou reposição afetada. Para cancelamento/ausência
total, evitam-se também turmas com narrativas de ocorrências dos seus alunos. A cancelada conserva
motivo e autoria, fica sem chamada ativa e sem baixa; IDs das linhas sintéticas retiradas são
preservados por exclusão lógica. A aula sem presentes conserva as faltas e uma observação, sem
conteúdo inventado. Esses casos são escolhidos depois dos loaders dependentes, dentro da mesma
reconstrução oficial, protegendo os fatos que eles já carregaram. Integração apenas pelo `pnpm seed`.

## Presença informada pelo aluno

V5 acrescenta até seis encontros passados com baixas V4 existentes, sete janelas e 31 declarações:
MWYB com seis envios, PPT-E1 com seis, F1A com cinco, S2A com cinco, MWBA com quatro e PPT-C2 com
cinco. A seleção respeita as matrículas na data e exige pelo menos um presente confirmado pelo
docente sem declaração. Os resultados da chamada, seus autores, conteúdos, notas e demais fatos
não são alterados. Se o semestre ainda não oferece aulas com participantes suficientes, o cenário
é omitido; as quantidades acima são limites pretendidos, não uma autorização para fabricar presença.

Na MWYB, os irmãos de sobrenome Martins Andrade enviam esse nome parcial e escolhem seus próprios
registros. Outros envios alternam nome completo com correspondência exata e identificação parcial
com escolha explícita. O seed não renomeia alunos para criar homônimos integrais; esse caso pertence
às fixtures isoladas de teste. Na PPT-E1, a seleção prioriza a aula com substituto já registrado
pela V4 e atribui a abertura ao docente que efetivamente ministrou o encontro.

A F1A mostra uma janela de dez minutos que expira antes da chamada, convivendo com presença manual.
Quando há um ausente naquele encontro, um dos envios fica associado à falta já confirmada: a
declaração permanece evidência para conferência e não transforma o resultado final. O cenário
não registra tentativas recusadas nem inventa uma causa para a divergência. A MWBA abre a coleta
perto do fim, limita a validade ao término do encontro e encerra manualmente antes disso. Na PPT-C2,
um novo link substitui o anterior; dois envios ficam na primeira janela e três na segunda, sem
duplicar aluno ou sobrescrever evidências. Todas as outras janelas recebem o fechamento da chamada
já existente. Validades usam dez, vinte ou trinta minutos, com abertura no dia civil de São Paulo,
dentro da janela permitida e antes das baixas. Nenhum QR fica artificialmente aberto.

Os envios presenciais possuem latitude, longitude, precisão e captura cinco segundos antes do
envio. Uma grade de coordenadas explicitamente sintética varia distância e precisão; não representa
endereço da escola, medição real nem regra de bloqueio por raio. Parte das janelas tem referência
sintética do docente; a F1A demonstra referência ausente. Na S2A online, todas as localizações do
aluno e da referência docente são nulas. Falha ou recusa de localização continua sendo um caminho
para presença manual, sem falsa declaração persistida nem motivo inventado.

Tokens aleatórios de 32 bytes são gerados apenas para calcular seus hashes SHA256; o token bruto
não é armazenado, retornado ou impresso, e não há link utilizável documentado. Janelas e declarações
mantêm IDs derivados estáveis; os hashes mudam em cada reconstrução. O Log recebe abertura e
fechamento de até sete janelas, com autoria e data, sem evento global por declaração ou localização.

O loader roda depois da V4 e antes do Log no único `pnpm seed`. O encontro pendente foi omitido:
os encontros recentes já possuem baixa, e retirar uma delas exigiria preparar exceções em outros
loaders antes das avaliações, ocorrências, visitas e reposições. O seed preserva esses históricos;
a coleta antes da confirmação é validada pelo fluxo real e pelas fixtures isoladas da V5. Não há
aplicação parcial nem alteração do banco durante a edição destes arquivos.

## Log de atividades

O bootstrap termina com uma linha do tempo baseada nos fatos que acabou de carregar: entradas
aplicadas, cadastros sem matrícula, turmas, contratos, candidatos e contatos comerciais, conversões
e decisões pedagógicas. Para manter o volume legível, inclui até três aulas confirmadas por turma,
16 grupos recentes de notas por bloco ou recuperação e oito recebimentos por mês, com até dois
por método. As descrições usam os nomes e as datas dos registros, com títulos e áreas do catálogo
de atividades.

Autores registrados nos fatos são preservados. Cadastros de alunos sem matrícula, turmas,
docentes e semestre usam a autoria sintética do administrador que constrói o cenário; isso não
acrescenta inferência de autoria à operação de produção. Esses cadastros conservam o `createdAt`
do bootstrap; não simulam um histórico anterior de criação. Dias sem aula refletem seu autor e momento de cadastro, mesmo quando o
fechamento planejado ainda vai ocorrer. Contratos, matrículas e pagamentos usam suas datas civis
de acordo, entrada e recebimento, com horário sintético às 15h de São Paulo. Eventos com instante
futuro ou dia posterior à referência são excluídos. Chaves de deduplicação impedem eventos repetidos
do mesmo fato; o loader participa apenas da reconstrução coordenada do seed.

## Limites e próximas verticais

Suspensos e inativos representam o estado atual cadastral. Este seed não inventa matrículas de
semestres anteriores nem cancelamentos contratuais sem operação de domínio implementada.
Planejamento não preenche automaticamente a execução de conteúdo em aula. A frequência histórica
anterior ao recorte V4 não recebe relato fabricado apenas para parecer uma baixa completa.

A distribuição dos fechamentos e os efeitos nos totais estão detalhados em
[Fechamentos comerciais](../../.design/pedagogical/analytics/SEED-CLOSINGS.md).

As expectativas de distribuição, unicidade, contatos, conflitos de horário e datas estão nos testes
unitários de seed do pacote `db`. O teste financeiro de integração cobre os contratos, pagadores
compartilhados, pagamentos futuros ausentes, saldo parcial e juros de atrasos quitados. Esses
checks devem permanecer na CI; a validação local desta mudança fica limitada às ferramentas
autorizadas na sessão e ao browser após uma execução coordenada no banco isolado.
