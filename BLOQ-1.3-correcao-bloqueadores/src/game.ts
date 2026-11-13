export type Color = 'white' | 'black';
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'blocker';
export type Board = (Piece | null)[];

export interface Piece {
  id: string;
  color: Color;
  type: PieceType;
  moved: boolean;
}

export interface Move {
  from: number;
  to: number;
}

export interface HistoryEntry extends Move {
  color: Color;
  round: number;
  notation: string;
  kind: 'move' | 'blocker';
}

export interface GameResult {
  kind: 'checkmate' | 'stalemate' | 'fifty-move';
  winner: Color | null;
}

export interface GameState {
  id: string;
  board: Board;
  turn: Color;
  normalMoves: number;
  movements: number;
  turnsPlayed: Record<Color, number>;
  blockerDue: Record<Color, boolean>;
  halfMovesWithoutCapture: number;
  history: HistoryEntry[];
  lastMove: Move | null;
  result: GameResult | null;
}

const backRank: PieceType[] = [
  'rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook',
];

// B pieces sit in front of both rooks and the king; all others mirror their back-rank piece.
const frontRank: PieceType[] = [
  'blocker', 'knight', 'bishop', 'queen', 'blocker', 'bishop', 'knight', 'blocker',
];

const knightSteps = [
  [-2, -1], [-2, 1], [-1, -2], [-1, 2],
  [1, -2], [1, 2], [2, -1], [2, 1],
];
const straightSteps = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const diagonalSteps = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const allDirections = [...straightSteps, ...diagonalSteps];

const values: Record<PieceType, number> = {
  king: 0,
  queen: 9,
  rook: 5,
  bishop: 3.4,
  knight: 3.2,
  blocker: 0,
};

const rowOf = (square: number) => Math.floor(square / 8);
const colOf = (square: number) => square % 8;
const inside = (row: number, col: number) => row >= 0 && row < 8 && col >= 0 && col < 8;
export const opposite = (color: Color): Color => color === 'white' ? 'black' : 'white';
export const squareName = (square: number) =>
  `${String.fromCharCode(97 + colOf(square))}${8 - rowOf(square)}`;

export function createGame(): GameState {
  const board: Board = Array(64).fill(null);
  const counts: Record<string, number> = {};

  const placeRank = (row: number, color: Color, rank: PieceType[]) => {
    rank.forEach((type, col) => {
      const key = `${color}-${type}`;
      counts[key] = (counts[key] || 0) + 1;
      board[row * 8 + col] = {
        id: `${key}-${counts[key]}`,
        color,
        type,
        moved: false,
      };
    });
  };

  placeRank(0, 'black', backRank);
  placeRank(1, 'black', frontRank);
  placeRank(6, 'white', frontRank);
  placeRank(7, 'white', backRank);

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    board,
    turn: 'white',
    normalMoves: 0,
    movements: 0,
    turnsPlayed: { white: 0, black: 0 },
    blockerDue: { white: true, black: true },
    halfMovesWithoutCapture: 0,
    history: [],
    lastMove: null,
    result: null,
  };
}

export function isSquareAttacked(board: Board, target: number, byColor: Color): boolean {
  const targetRow = rowOf(target);
  const targetCol = colOf(target);

  for (let from = 0; from < 64; from += 1) {
    const piece = board[from];
    if (!piece || piece.color !== byColor || piece.type === 'blocker') continue;

    const rowDistance = targetRow - rowOf(from);
    const colDistance = targetCol - colOf(from);
    const absRow = Math.abs(rowDistance);
    const absCol = Math.abs(colDistance);

    if (piece.type === 'knight') {
      if ((absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2)) return true;
      continue;
    }

    if (piece.type === 'king') {
      if (Math.max(absRow, absCol) === 1) return true;
      continue;
    }

    const straight = (rowDistance === 0 && absCol > 0) || (colDistance === 0 && absRow > 0);
    const diagonal = absRow === absCol && absRow > 0;
    const canAttack = piece.type === 'queen' && (straight || diagonal)
      || piece.type === 'rook' && straight
      || piece.type === 'bishop' && diagonal;
    if (!canAttack) continue;

    const rowStep = Math.sign(rowDistance);
    const colStep = Math.sign(colDistance);
    let row = rowOf(from) + rowStep;
    let col = colOf(from) + colStep;
    let blocked = false;

    while (row !== targetRow || col !== targetCol) {
      if (board[row * 8 + col]) {
        blocked = true;
        break;
      }
      row += rowStep;
      col += colStep;
    }

    if (!blocked) return true;
  }

  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const kingSquare = board.findIndex((piece) => piece?.color === color && piece.type === 'king');
  return kingSquare < 0 || isSquareAttacked(board, kingSquare, opposite(color));
}

function pseudoTargets(board: Board, from: number): number[] {
  const piece = board[from];
  if (!piece || piece.type === 'blocker') return [];

  const row = rowOf(from);
  const col = colOf(from);
  const targets: number[] = [];

  const addStep = (nextRow: number, nextCol: number) => {
    if (!inside(nextRow, nextCol)) return;
    const to = nextRow * 8 + nextCol;
    const occupant = board[to];
    if (!occupant || (occupant.color !== piece.color
      && occupant.type !== 'blocker' && occupant.type !== 'king')) targets.push(to);
  };

  if (piece.type === 'knight') {
    knightSteps.forEach(([dr, dc]) => addStep(row + dr, col + dc));
  } else if (piece.type === 'king') {
    allDirections.forEach(([dr, dc]) => addStep(row + dr, col + dc));

    if (!piece.moved && !isInCheck(board, piece.color)) {
      for (const rookCol of [0, 7]) {
        const rook = board[row * 8 + rookCol];
        if (!rook || rook.type !== 'rook' || rook.color !== piece.color || rook.moved) continue;

        const step = rookCol < col ? -1 : 1;
        let clear = true;
        for (let nextCol = col + step; nextCol !== rookCol; nextCol += step) {
          if (board[row * 8 + nextCol]) {
            clear = false;
            break;
          }
        }
        if (!clear) continue;

        const through = row * 8 + col + step;
        const passingBoard = board.slice();
        passingBoard[from] = null;
        passingBoard[through] = piece;
        if (!isInCheck(passingBoard, piece.color)) targets.push(row * 8 + col + step * 2);
      }
    }
  } else {
    const directions = piece.type === 'queen' ? allDirections
      : piece.type === 'rook' ? straightSteps : diagonalSteps;

    for (const [dr, dc] of directions) {
      let nextRow = row + dr;
      let nextCol = col + dc;
      while (inside(nextRow, nextCol)) {
        const to = nextRow * 8 + nextCol;
        const occupant = board[to];
        if (occupant) {
          if (occupant.color !== piece.color
            && occupant.type !== 'blocker' && occupant.type !== 'king') targets.push(to);
          break;
        }
        targets.push(to);
        nextRow += dr;
        nextCol += dc;
      }
    }
  }

  return targets;
}

export function applyChessMoveBoard(board: Board, from: number, to: number): Board {
  const next = board.slice();
  const piece = board[from];
  if (!piece) return next;

  next[from] = null;
  next[to] = { ...piece, moved: true };

  if (piece.type === 'king' && Math.abs(colOf(to) - colOf(from)) === 2) {
    const kingSide = colOf(to) > colOf(from);
    const rookFrom = rowOf(from) * 8 + (kingSide ? 7 : 0);
    const rookTo = rowOf(from) * 8 + (kingSide ? 5 : 3);
    const rook = board[rookFrom];
    next[rookFrom] = null;
    next[rookTo] = rook ? { ...rook, moved: true } : null;
  }

  return next;
}

export function getLegalMoves(board: Board, from: number): number[] {
  const piece = board[from];
  if (!piece || piece.type === 'blocker') return [];

  return pseudoTargets(board, from).filter((to) =>
    !isInCheck(applyChessMoveBoard(board, from, to), piece.color));
}

export function getAllLegalMoves(board: Board, color: Color): Move[] {
  const moves: Move[] = [];
  for (let from = 0; from < 64; from += 1) {
    if (board[from]?.color !== color || board[from]?.type === 'blocker') continue;
    getLegalMoves(board, from).forEach((to) => moves.push({ from, to }));
  }
  return moves;
}

export function isBlockerPhase(game: GameState): boolean {
  return !game.result && game.blockerDue[game.turn]
    && !isInCheck(game.board, 'white') && !isInCheck(game.board, 'black');
}

const adjacent = (first: number, second: number) =>
  Math.abs(rowOf(first) - rowOf(second)) <= 1
  && Math.abs(colOf(first) - colOf(second)) <= 1;

function boardAfterBlockers(board: Board, moves: Move[]): Board {
  const next = board.slice();
  moves.forEach(({ from }) => { next[from] = null; });
  moves.forEach(({ from, to }) => {
    const piece = board[from]!;
    next[to] = { ...piece, moved: true };
  });
  return next;
}

export function isValidBlockerBatch(game: GameState, moves: Move[]): boolean {
  if (!isBlockerPhase(game) || moves.length !== 3) return false;

  const sources = game.board.flatMap((piece, square) =>
    piece?.type === 'blocker' && piece.color === game.turn ? [square] : []);
  if (sources.length !== 3 || new Set(moves.map((move) => move.from)).size !== 3
    || sources.some((square) => !moves.some((move) => move.from === square))) return false;

  const destinations = moves.map((move) => move.to);
  const sourceSet = new Set(sources);
  // The three blockers move simultaneously: their original squares are free
  // destinations, provided no two blockers choose the same final square.
  if (new Set(destinations).size !== 3) return false;
  for (const { from, to } of moves) {
    if (!Number.isInteger(to) || to < 0 || to > 63 || to === from) return false;
    const occupant = game.board[to];
    if (occupant && !(sourceSet.has(to) && occupant.type === 'blocker'
      && occupant.color === game.turn)) return false;
  }

  // All three moves belong to one color; opposing blockers may be adjacent.
  for (let first = 0; first < moves.length; first += 1) {
    for (let second = first + 1; second < moves.length; second += 1) {
      if (adjacent(moves[first].to, moves[second].to)) return false;
    }
  }

  // Only the final position matters: the three blockers change places at once.
  const board = boardAfterBlockers(game.board, moves);
  return !isInCheck(board, 'white') && !isInCheck(board, 'black');
}

export function getBlockerTargets(game: GameState, draft: Move[], from: number): number[] {
  const piece = game.board[from];
  if (!isBlockerPhase(game) || !piece || piece.type !== 'blocker'
    || piece.color !== game.turn) return [];

  const otherMoves = draft.filter((move) => move.from !== from);
  if (otherMoves.length > 2) return [];
  const targets: number[] = [];

  const ownBlockerSquares = new Set(game.board.flatMap((occupant, square) =>
    occupant?.type === 'blocker' && occupant.color === game.turn ? [square] : []));
  for (let to = 0; to < 64; to += 1) {
    const occupant = game.board[to];
    // A square currently occupied by one of our three blockers becomes free
    // because all three are relocated as a single simultaneous batch.
    if (occupant && !ownBlockerSquares.has(to)) continue;
    if (to === from || otherMoves.some((move) => move.to === to)) continue;
    if (otherMoves.some((move) => adjacent(to, move.to))) continue;

    if (otherMoves.length === 2
      && !isValidBlockerBatch(game, [...otherMoves, { from, to }])) continue;
    targets.push(to);
  }

  return targets;
}

export function findBlockerBatch(game: GameState, preferCenter = false): Move[] | null {
  if (!isBlockerPhase(game)) return null;
  const sources = game.board.flatMap((piece, square) =>
    piece?.type === 'blocker' && piece.color === game.turn ? [square] : []);
  if (sources.length !== 3) return null;

  const search = (draft: Move[]): Move[] | null => {
    if (draft.length === 3) return draft;
    const from = sources[draft.length];
    const targets = getBlockerTargets(game, draft, from);
    if (preferCenter) {
      targets.sort((a, b) => {
        const score = (square: number) => 4 - Math.abs(3.5 - rowOf(square))
          - Math.abs(3.5 - colOf(square)) + (game.turn === 'black' ? rowOf(square) : 7 - rowOf(square)) * 0.15;
        return score(b) - score(a);
      });
    }

    for (const to of targets) {
      const answer = search([...draft, { from, to }]);
      if (answer) return answer;
    }
    return null;
  };

  return search([]);
}

function resolveEnd(game: GameState): GameState {
  if (game.halfMovesWithoutCapture >= 100) {
    return { ...game, result: { kind: 'fifty-move', winner: null } };
  }

  // A scheduled B relocation can open new moves, so check stalemate afterwards.
  if (isBlockerPhase(game)) {
    if (findBlockerBatch(game)) return game;

    // An impossible simultaneous placement must not leave the match unplayable.
    return resolveEnd({
      ...game,
      blockerDue: { ...game.blockerDue, [game.turn]: false },
    });
  }
  if (getAllLegalMoves(game.board, game.turn).length > 0) return game;

  return {
    ...game,
    result: isInCheck(game.board, game.turn)
      ? { kind: 'checkmate', winner: opposite(game.turn) }
      : { kind: 'stalemate', winner: null },
  };
}

export function skipUnavailableBlockers(game: GameState): GameState {
  if (!isBlockerPhase(game) || findBlockerBatch(game)) return game;
  return resolveEnd({ ...game, blockerDue: { ...game.blockerDue, [game.turn]: false } });
}

export function movePiece(game: GameState, from: number, to: number): GameState {
  const piece = game.board[from];
  if (game.result || isBlockerPhase(game) || !piece || piece.color !== game.turn
    || !getLegalMoves(game.board, from).includes(to)) return game;

  const capture = game.board[to];
  const board = applyChessMoveBoard(game.board, from, to);
  const nextTurn = opposite(game.turn);
  const turnsPlayed = { ...game.turnsPlayed, [game.turn]: game.turnsPlayed[game.turn] + 1 };
  const blockerDue = { ...game.blockerDue };
  if (turnsPlayed[game.turn] % 5 === 0) blockerDue[game.turn] = true;

  const castle = piece.type === 'king' && Math.abs(colOf(from) - colOf(to)) === 2;
  const symbol: Record<Exclude<PieceType, 'blocker'>, string> = {
    king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N',
  };
  const notation = `${castle ? colOf(to) > colOf(from) ? 'O-O' : 'O-O-O'
    : `${symbol[piece.type as Exclude<PieceType, 'blocker'>]} ${squareName(from)}${capture ? 'x' : '-'}${squareName(to)}`}`
    + (isInCheck(board, nextTurn) ? '+' : '');

  const next: GameState = {
    ...game,
    board,
    turn: nextTurn,
    normalMoves: game.normalMoves + 1,
    movements: game.movements + 1,
    turnsPlayed,
    blockerDue,
    halfMovesWithoutCapture: capture ? 0 : game.halfMovesWithoutCapture + 1,
    lastMove: { from, to },
    history: [...game.history, {
      from, to, color: game.turn, round: Math.floor(game.normalMoves / 2) + 1,
      notation, kind: 'move',
    }],
  };

  return resolveEnd(next);
}

export function moveBlockers(game: GameState, moves: Move[]): GameState {
  if (!isValidBlockerBatch(game, moves)) return game;

  const board = boardAfterBlockers(game.board, moves);
  const next: GameState = {
    ...game,
    board,
    movements: game.movements + 3,
    blockerDue: { ...game.blockerDue, [game.turn]: false },
    lastMove: moves[moves.length - 1],
    history: [...game.history, ...moves.map(({ from, to }) => ({
      from, to, color: game.turn, round: Math.floor(game.normalMoves / 2) + 1,
      notation: `B ${squareName(from)}-${squareName(to)}`, kind: 'blocker' as const,
    }))],
  };

  return resolveEnd(next);
}

function evaluate(board: Board): number {
  let score = 0;
  board.forEach((piece, square) => {
    if (!piece || piece.type === 'blocker') return;
    const sign = piece.color === 'black' ? 1 : -1;
    const centrality = 3.5 - (Math.abs(3.5 - rowOf(square))
      + Math.abs(3.5 - colOf(square))) / 2;
    const enemyKing = board.findIndex((candidate) =>
      candidate?.type === 'king' && candidate.color !== piece.color);
    const kingDistance = enemyKing < 0 ? 7
      : Math.abs(rowOf(enemyKing) - rowOf(square))
        + Math.abs(colOf(enemyKing) - colOf(square));
    const kingPressure = piece.type === 'queen' || piece.type === 'rook'
      || piece.type === 'bishop' || piece.type === 'knight'
      ? Math.max(0, 7 - kingDistance) * 0.025 : 0;
    const advancement = piece.color === 'black' ? rowOf(square) : 7 - rowOf(square);
    score += sign * (values[piece.type]
      + (piece.type === 'king' ? 0 : centrality * 0.11 + advancement * 0.03 + kingPressure));
  });
  return score;
}

export type AIDifficulty = 'easy' | 'medium' | 'hard';

export function chooseAIMove(game: GameState, difficulty: AIDifficulty = 'medium'): Move | null {
  const moves = getAllLegalMoves(game.board, 'black');
  if (!moves.length) return null;

  if (difficulty === 'easy') {
    // Nível introdutório: escolhe entre movimentos legais sem cálculo de respostas.
    return moves[Math.floor(Math.random() * moves.length)];
  }

  const candidates = moves.map((move) => {
    const piece = game.board[move.from]!;
    const captured = game.board[move.to];
    const board = applyChessMoveBoard(game.board, move.from, move.to);
    let score = evaluate(board) + Math.random() * 0.12;
    if (isInCheck(board, 'white')) score += 0.6;
    if (captured) score += values[captured.type] * 0.25;
    if (isSquareAttacked(board, move.to, 'white')) score -= values[piece.type] * 0.55;
    return { move, board, score };
  }).sort((a, b) => b.score - a.score).slice(0, difficulty === 'hard' ? 32 : 18);

  let best = candidates[0].move;
  let bestScore = -Infinity;

  for (const candidate of candidates) {
    const replies = getAllLegalMoves(candidate.board, 'white');
    let score: number;
    if (!replies.length) {
      score = isInCheck(candidate.board, 'white') ? 10000 : -100;
    } else {
      let worstReply = Infinity;
      for (const reply of replies) {
        const response = applyChessMoveBoard(candidate.board, reply.from, reply.to);
        const replyScore = evaluate(response) - (isInCheck(response, 'black') ? 0.5 : 0);
        if (replyScore < worstReply) worstReply = replyScore;
      }
      score = candidate.score * 0.3 + worstReply * 0.7;
    }
    if (score > bestScore) {
      bestScore = score;
      best = candidate.move;
    }
  }

  return best;
}

export function chooseAIBlockerBatch(game: GameState): Move[] | null {
  return game.turn === 'black' ? findBlockerBatch(game, true) : null;
}