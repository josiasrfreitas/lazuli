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

## Contratos e recebimentos

Os 220 alunos alocados possuem contratos anuais separados, distribuídos por 205 pagadores. Os
termos comerciais começam de seis a oito meses antes da referência e continuam além do semestre;
a janela comercial não é a janela de matrícula. Mensalidades nominais variam de R$ 200 a R$ 250,
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
vencimento e saldo calculado pelas regras financeiras. As três coortes de início de contrato e a
variação da data de recebimento produzem crescimento inicial e oscilação mensal. O histórico
de contratos começa de seis a oito meses antes da referência; os primeiros recebimentos podem
anteceder esse início em até sete dias. Esse recorte não representa um ciclo anual completo de
sazonalidade; meses anteriores ao primeiro fato financeiro têm zero movimento neste cenário.

Pagamentos e ajustes passam pelas regras financeiras existentes, sem
fabricar saldos ou juros diretamente no banco. Irmãos compartilham pagador, conservando contratos
por beneficiário.

## Limites e próximas verticais

Suspensos e inativos representam o estado atual cadastral. Este seed não inventa matrículas de
semestres anteriores nem cancelamentos contratuais sem operação de domínio implementada. Planos
de estágio, avaliações e competências devem ganhar cenários quando suas respectivas
verticais estiverem implementadas. A ausência desses dados não representa conclusão dessas áreas.

As expectativas de distribuição, unicidade, contatos, conflitos de horário e datas estão nos testes
unitários de seed do pacote `db`. O teste financeiro de integração cobre os contratos, pagadores
compartilhados, pagamentos futuros ausentes, saldo parcial e juros de atrasos quitados. Esses
checks devem permanecer na CI; a validação local desta mudança fica limitada às ferramentas
autorizadas na sessão e ao browser após uma execução coordenada no banco isolado.
