# BLOQ — pacote de reformulação 1.1

## Direção de produto
- Mantida a modalidade original sem peões.
- Mantidos tabuleiro 8×8, peças principais e três bloqueadores por jogador.
- Posicionamento ajustado para "jogo de estratégia inspirado no xadrez", evitando sugerir que seja xadrez tradicional/FIDE.

## Alterações incluídas
- Textos da página inicial e metadados atualizados para explicar a proposta própria do BLOQ.
- Regras reescritas para explicitar a ausência de peões e a natureza independente da modalidade.
- Histórico local reordenado: partidas decididas primeiro; desempate por menor tempo e depois menor número de ações.
- Interface deixa de apresentar a média arbitrária de tempo + movimentos como medida de habilidade.
- Avaliação da IA ajustada com pressão posicional em direção ao rei adversário e maior conjunto de candidatos (18 em vez de 14).

## Limitações conhecidas / não declarar como concluído
- Não há integração CrazyGames SDK nesta versão.
- Não há ranking mundial nem multiplayer online.
- A IA continua sendo heurística; não foi validada em torneio ou benchmark.
- O build de produção não pôde ser executado neste ambiente porque o npm não conseguiu baixar dependências do registry (erro DNS EAI_AGAIN). Portanto, este pacote contém o código-fonte alterado, não um HTML compilado validado.
- Antes de submissão: instalar dependências, executar `npm ci`, `npm run build`, testar localmente em desktop/mobile e só então integrar o SDK CrazyGames conforme a documentação atual.

## Ajuste complementar — níveis da máquina
- Incluídos os níveis Fácil, Intermediário e Difícil no painel, visíveis no modo Contra a máquina.
- Fácil: seleciona um movimento legal aleatório, sem antecipar respostas.
- Intermediário: mantém a avaliação atual com análise das respostas possíveis.
- Difícil: amplia de 18 para 32 os movimentos candidatos avaliados antes da decisão.
- A seleção altera o comportamento da IA durante a partida; não exige reiniciar.
- Limitação: a diferença de força ainda precisa de testes práticos e calibração com partidas reais.
