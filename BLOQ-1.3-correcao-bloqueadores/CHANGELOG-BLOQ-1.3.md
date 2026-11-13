BLOQ 1.3 — Correção da movimentação simultânea dos bloqueadores

- Corrigida a seleção de destinos dos três bloqueadores.
- Como os três bloqueadores são deslocados simultaneamente, as casas que eles ocupavam inicialmente agora podem ser escolhidas como destinos por outro bloqueador da mesma cor.
- Cada bloqueador deve terminar em uma casa diferente.
- A posição final continua impedindo que bloqueadores da mesma cor fiquem lado a lado, inclusive na diagonal.
- Casas ocupadas por peças que não fazem parte do trio continuam indisponíveis.
- A validação considera a posição final conjunta dos três bloqueadores antes de confirmar a jogada.

Observação: esta atualização corrige a regra no código; ainda requer teste de execução no navegador e validação de partidas reais.
