import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import {
  ArrowRight, ArrowUpRight, BookOpen, Bot, Check, ChevronRight,
  Crown, Moon, RotateCcw, RotateCw, Sun, Trophy, Users, X,
} from 'lucide-react';
import {
  chooseAIBlockerBatch, chooseAIMove, createGame, getBlockerTargets,
  getLegalMoves, isBlockerPhase, isInCheck, isValidBlockerBatch,
  moveBlockers, movePiece, skipUnavailableBlockers, squareName,
  type AIDifficulty, type Color, type GameState, type Move, type Piece, type PieceType,
} from './game';
import { ChessPieceArt } from './ChessPieces';

type Mode = 'computer' | 'local';
type Theme = 'dark' | 'light';
type Modal = 'rules' | 'ranking' | 'confirm' | 'result' | null;

interface RankingEntry {
  id: string;
  date: string;
  mode: Mode;
  winner: Color | null;
  seconds: number;
  movements: number;
}

const pieceNames: Record<PieceType, string> = {
  king: 'rei', queen: 'rainha', rook: 'torre', bishop: 'bispo',
  knight: 'cavalo', blocker: 'bloqueador B',
};
const formatTime = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

function readTheme(): Theme {
  try { return localStorage.getItem('bloq-theme') === 'light' ? 'light' : 'dark'; }
  catch { return 'dark'; }
}

function readRanking(): RankingEntry[] {
  try {
    const stored = JSON.parse(localStorage.getItem('bloq-ranking') || '[]');
    return Array.isArray(stored) ? stored.filter((entry) =>
      typeof entry?.seconds === 'number' && typeof entry?.movements === 'number') : [];
  } catch { return []; }
}

function BlockerArt({ color }: { color: Color }) {
  const light = color === 'white';
  const suffix = light ? 'ivory' : 'onyx';
  return (
    <svg className="blocker-art" viewBox="0 0 100 120" aria-hidden="true">
      <defs>
        <linearGradient id={`base-${suffix}`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor={light ? '#fffdf2' : '#5d6664'} />
          <stop offset="0.43" stopColor={light ? '#ddd9cb' : '#303c3b'} />
          <stop offset="1" stopColor={light ? '#989b91' : '#101a1b'} />
        </linearGradient>
        <linearGradient id={`letter-${suffix}`} x1="0" y1="0" x2="1" y2="0.9">
          <stop stopColor={light ? '#fffefa' : '#808b85'} />
          <stop offset="0.42" stopColor={light ? '#f1e9d2' : '#37443f'} />
          <stop offset="1" stopColor={light ? '#b7ab8f' : '#0f1a19'} />
        </linearGradient>
        <linearGradient id={`top-${suffix}`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor={light ? '#fffef4' : '#69736e'} />
          <stop offset="1" stopColor={light ? '#bebbae' : '#1b2928'} />
        </linearGradient>
      </defs>
      <ellipse cx="51" cy="109" rx="39" ry="10" fill="#07110e" opacity=".28" />
      <path d="M14 96c0-7 16-13 36-13s36 6 36 13v6c0 7-16 12-36 12s-36-5-36-12z"
        fill={`url(#base-${suffix})`} stroke={light ? '#bbb9aa' : '#131d1c'} strokeWidth="1.5" />
      <ellipse cx="50" cy="96" rx="36" ry="11" fill={`url(#top-${suffix})`}
        stroke={light ? '#fff9e8' : '#64706b'} strokeWidth="1.5" />
      <path d="M27 85c0-5 10-9 23-9s23 4 23 9v8c0 5-10 8-23 8s-23-3-23-8z"
        fill={`url(#base-${suffix})`} />
      <ellipse cx="50" cy="85" rx="23" ry="8" fill={`url(#top-${suffix})`} />
      <text x="53" y="78" textAnchor="middle" fontFamily="Georgia, serif" fontSize="75"
        fontWeight="bold" fill={light ? '#817c6d' : '#0a1313'} stroke={light ? '#a49c89' : '#071211'}
        strokeWidth="3" paintOrder="stroke">B</text>
      <text x="49" y="74" textAnchor="middle" fontFamily="Georgia, serif" fontSize="75"
        fontWeight="bold" fill={`url(#letter-${suffix})`}
        stroke={light ? '#fdf9ea' : '#68746b'} strokeWidth="1.3" paintOrder="stroke">B</text>
      <path d="M27 95c9 7 35 8 47 1" fill="none" stroke={light ? '#fffef5' : '#78837a'}
        strokeWidth="1.5" opacity=".6" />
    </svg>
  );
}

function PieceArt({ piece }: { piece: Piece }) {
  if (piece.type === 'blocker') return <BlockerArt color={piece.color} />;
  return <ChessPieceArt type={piece.type} color={piece.color} />;
}

function PlayerStrip({ color, name, active, checked }: {
  color: Color; name: string; active: boolean; checked: boolean;
}) {
  return (
    <div className={`player-strip ${active ? 'player-active' : ''}`}>
      <div className={`player-avatar avatar-${color}`}>
        <ChessPieceArt type="knight" color={color} />
      </div>
      <div className="player-details">
        <span>{color === 'white' ? 'PE\u00c7AS CLARAS' : 'PE\u00c7AS ESCURAS'}</span>
        <strong>{name}</strong>
      </div>
      <span className={`player-state ${checked ? 'state-check' : ''}`}>
        <span className="state-dot" />{checked ? 'Em xeque' : active ? 'Jogando' : 'Aguardando'}
      </span>
    </div>
  );
}

function ModalShell({ children, onClose, wide = false }: {
  children: ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      exit={{ opacity: 0 }} onMouseDown={onClose}>
      <motion.div className={`modal-panel ${wide ? 'modal-wide' : ''}`}
        role="dialog" aria-modal="true"
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ type: 'spring', damping: 27, stiffness: 290 }}
        onMouseDown={(event) => event.stopPropagation()}>
        <button className="modal-close" aria-label="Fechar" onClick={onClose}><X size={19} /></button>
        {children}
      </motion.div>
    </motion.div>
  );
}

export default function App() {
  const [game, setGame] = useState<GameState>(createGame);
  const [mode, setMode] = useState<Mode>('computer');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [selected, setSelected] = useState<number | null>(null);
  const [draftBlockers, setDraftBlockers] = useState<Move[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);
  const [rankings, setRankings] = useState<RankingEntry[]>(readRanking);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const recordedGame = useRef<string | null>(null);

  const blockerPhase = isBlockerPhase(game);
  const computerThinking = mode === 'computer' && game.turn === 'black' && !game.result;
  const inCheck = isInCheck(game.board, game.turn);
  const legalTargets = useMemo(() => {
    if (selected === null) return [];
    return blockerPhase ? getBlockerTargets(game, draftBlockers, selected)
      : getLegalMoves(game.board, selected);
  }, [game, selected, blockerPhase, draftBlockers]);
  const readyToMoveBlockers = blockerPhase && isValidBlockerBatch(game, draftBlockers);

  const round = Math.floor(game.normalMoves / 2) + 1;
  const shiftsRemaining = 3 - draftBlockers.length;
  const turnsInCycle = game.turnsPlayed[game.turn] % 5;
  const roundsUntilShift = game.blockerDue[game.turn] ? 0 : 5 - turnsInCycle;

  useEffect(() => {
    try { localStorage.setItem('bloq-theme', theme); } catch { /* Storage may be unavailable. */ }
  }, [theme]);

  useEffect(() => {
    if (startedAt === null || game.result) return;
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [startedAt, game.result]);

  useEffect(() => {
    if (!game.result || recordedGame.current === game.id) return;
    recordedGame.current = game.id;
    const seconds = startedAt === null ? 0 : Math.floor((Date.now() - startedAt) / 1000);
    setElapsed(seconds);
    const entry: RankingEntry = {
      id: game.id, date: new Date().toLocaleDateString('pt-BR'), mode,
      winner: game.result.winner, seconds, movements: game.movements,
    };
    setRankings((current) => {
      const updated = [...current, entry].sort((a, b) =>
        Number(b.winner !== null) - Number(a.winner !== null)
        || a.seconds - b.seconds || a.movements - b.movements).slice(0, 30);
      try { localStorage.setItem('bloq-ranking', JSON.stringify(updated)); } catch { /* Local only. */ }
      return updated;
    });
    setModal('result');
  }, [game.id, game.result, game.movements, mode, startedAt]);

  useEffect(() => {
    if (!computerThinking) return;
    const timeout = window.setTimeout(() => {
      setGame((current) => {
        if (current.turn !== 'black' || current.result) return current;
        if (isBlockerPhase(current)) {
          const batch = chooseAIBlockerBatch(current);
          return batch ? moveBlockers(current, batch) : skipUnavailableBlockers(current);
        }
        const choice = chooseAIMove(current, difficulty);
        return choice ? movePiece(current, choice.from, choice.to) : current;
      });
    }, blockerPhase ? 390 : 670);
    return () => window.clearTimeout(timeout);
  }, [computerThinking, game, blockerPhase, difficulty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setModal(null); setSelected(null); }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const startNewGame = (newMode: Mode = mode) => {
    setMode(newMode);
    setGame(createGame());
    setSelected(null);
    setDraftBlockers([]);
    setElapsed(0);
    setStartedAt(null);
    setFlipped(false);
    setPendingMode(null);
    setModal(null);
  };

  const requestNewGame = (newMode: Mode = mode) => {
    if (newMode === mode && game.movements === 0 && draftBlockers.length === 0 && !game.result) return;
    if (game.movements > 0 && !game.result) {
      setPendingMode(newMode);
      setModal('confirm');
    } else startNewGame(newMode);
  };

  const handleSquareClick = (square: number) => {
    if (game.result || computerThinking || modal) return;
    if (selected !== null && legalTargets.includes(square)) {
      if (blockerPhase) {
        setDraftBlockers((current) => [...current.filter((move) => move.from !== selected),
          { from: selected, to: square }]);
      } else {
        if (startedAt === null) setStartedAt(Date.now());
        setGame((current) => movePiece(current, selected, square));
      }
      setSelected(null);
      return;
    }
    const piece = game.board[square];
    const canSelect = piece && piece.color === game.turn
      && (blockerPhase ? piece.type === 'blocker' : piece.type !== 'blocker');
    const staged = blockerPhase ? draftBlockers.find((move) => move.to === square) : null;
    setSelected(canSelect ? selected === square ? null : square : staged ? staged.from : null);
  };

  const confirmBlockerBatch = () => {
    if (!readyToMoveBlockers) return;
    if (startedAt === null) setStartedAt(Date.now());
    setGame((current) => moveBlockers(current, draftBlockers));
    setDraftBlockers([]);
    setSelected(null);
  };

  const displaySquares = Array.from({ length: 64 }, (_, index) => flipped ? 63 - index : index);
  const canInteract = !game.result && !computerThinking && !modal;

  let statusTitle: string;
  let statusText: string;
  if (game.result) {
    statusTitle = game.result.kind === 'checkmate' ? 'Xeque-mate.' : 'Partida encerrada.';
    statusText = game.result.winner
      ? `${game.result.winner === 'white' ? 'As claras' : 'As escuras'} venceram a partida.`
      : 'O tabuleiro terminou em empate.';
  } else if (computerThinking) {
    statusTitle = 'A m\u00e1quina pensa.';
    statusText = blockerPhase ? 'Ela est\u00e1 movendo os 3 bloqueadores juntos.'
      : 'Calculando o pr\u00f3ximo movimento.';
  } else if (blockerPhase) {
    statusTitle = readyToMoveBlockers ? 'Troca pronta.' : 'Primeiro, os 3 B.';
    statusText = readyToMoveBlockers
      ? 'Confira os destinos e confirme. Os 3 B mudam juntos, sem causar xeque.'
      : selected !== null && legalTargets.length === 0
        ? 'Sem destino seguro para este B. Altere as escolhas anteriores ou use Limpar.'
      : draftBlockers.length === 0
        ? 'Clique em um B e depois em uma casa livre. Marque os 3 antes da jogada normal.'
        : `Marque ${shiftsRemaining === 1 ? 'mais 1 destino' : `mais ${shiftsRemaining} destinos`} livres. B da mesma cor n\u00e3o podem ficar lado a lado; a troca n\u00e3o pode causar xeque.`;
  } else if (inCheck) {
    statusTitle = 'O rei est\u00e1 em xeque.';
    statusText = 'Proteja seu rei com uma jogada legal. A troca dos B fica adiada.';
  } else {
    statusTitle = mode === 'computer' ? 'Sua vez de jogar.'
      : game.turn === 'white' ? 'Vez das claras.' : 'Vez das escuras.';
    statusText = game.normalMoves === 0
      ? 'Escolha uma pe\u00e7a para come\u00e7ar a partida.'
      : 'Selecione uma pe\u00e7a para ver seus movimentos.';
  }

  return (
    <div className={`app theme-${theme}`}>
      <div className="ambient-glow" aria-hidden="true" />
      <header className="topbar">
        <div className="brand" aria-label="BLOQ Chess Club">
          <span className="brand-emblem">B<span className="emblem-dot" /></span>
          <div className="brand-word">BLOQ<span>.</span><small>CHESS CLUB</small></div>
        </div>
        <div className="topbar-note"><span className="note-line" /> XADREZ EM OUTRO RITMO</div>
        <nav className="top-actions" aria-label="Menu principal">
          <button type="button" className="nav-link" onClick={() => setModal('rules')}>
            <BookOpen size={16} strokeWidth={1.8} /> <span>Como jogar</span>
          </button>
          <button type="button" className="nav-link" onClick={() => setModal('ranking')}>
            <Trophy size={16} strokeWidth={1.8} /> <span>Ranking</span>
          </button>
          <span className="nav-divider" />
          <button type="button" className="theme-toggle" aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
            title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <Sun size={19} strokeWidth={1.8} /> : <Moon size={19} strokeWidth={1.8} />}
          </button>
        </nav>
      </header>

      <main className="main-grid">
        <aside className="control-panel">
          <div className="intro-copy">
            <p className="eyebrow"><span /> ESTRATÉGIA INSPIRADA NO XADREZ</p>
            <h1>O poder de <em>mudar</em> o jogo.</h1>
            <p className="intro-description">Sem peões. Com três bloqueadores móveis. Uma nova lógica de estratégia.</p>
          </div>
          <div className="mode-section">
            <div className="section-heading"><span>MODO DE JOGO</span><span className="heading-index">01 / 02</span></div>
            <div className="mode-options" role="group" aria-label="Modo de jogo">
              <button type="button" className={`mode-option ${mode === 'computer' ? 'is-active' : ''}`}
                aria-pressed={mode === 'computer'} onClick={() => requestNewGame('computer')}>
                <span className="mode-icon"><Bot size={20} strokeWidth={1.7} /></span>
                <span className="mode-copy"><strong>Contra a m&aacute;quina</strong><small>Um desafio solo</small></span>
                {mode === 'computer' ? <Check className="mode-check" size={16} /> : <ChevronRight className="mode-chevron" size={17} />}
              </button>
              <button type="button" className={`mode-option ${mode === 'local' ? 'is-active' : ''}`}
                aria-pressed={mode === 'local'} onClick={() => requestNewGame('local')}>
                <span className="mode-icon"><Users size={20} strokeWidth={1.7} /></span>
                <span className="mode-copy"><strong>2 jogadores</strong><small>No mesmo dispositivo</small></span>
                {mode === 'local' ? <Check className="mode-check" size={16} /> : <ChevronRight className="mode-chevron" size={17} />}
              </button>
            </div>
          </div>
          {mode === 'computer' && <div className="difficulty-section">
            <div className="section-heading"><span>NÍVEL DA MÁQUINA</span><span className="heading-index">IA</span></div>
            <div className="difficulty-options" role="group" aria-label="Nível de dificuldade">
              {([['easy', 'Fácil'], ['medium', 'Intermediário'], ['hard', 'Difícil']] as const).map(([value, label]) => (
                <button key={value} type="button" className={`difficulty-option ${difficulty === value ? 'is-active' : ''}`}
                  aria-pressed={difficulty === value} onClick={() => setDifficulty(value)}>{label}</button>
              ))}
            </div>
            <p className="difficulty-hint">{difficulty === 'easy' ? 'A máquina faz jogadas legais sem antecipar respostas.' : difficulty === 'medium' ? 'A máquina avalia jogadas e possíveis respostas do adversário.' : 'A máquina analisa mais alternativas antes de decidir.'}</p>
          </div>}
          <div className="score-section">
            <div className="section-heading"><span>SUA PARTIDA</span><span className={`live-indicator ${startedAt !== null && !game.result ? 'is-live' : ''}`} /></div>
            <div className="clock-readout">{formatTime(elapsed)}<span>tempo de jogo</span></div>
            <div className="score-row"><span>Ações totais</span><strong>{String(game.movements).padStart(2, '0')}</strong></div>
            <div className="score-row"><span>Jogadas de peças</span><strong>{String(game.normalMoves).padStart(2, '0')}</strong></div>
          </div>
          <div className="control-footer">
            <button type="button" className="new-game-button" onClick={() => requestNewGame()}>
              <RotateCcw size={17} strokeWidth={1.9} /><span>Nova partida</span><ArrowUpRight size={17} strokeWidth={1.9} />
            </button>
            <p>Vitórias aparecem primeiro. Desempate pelo menor tempo.<br />Registro salvo neste navegador.</p>
          </div>
        </aside>

        <section className="board-column" aria-label="Tabuleiro de xadrez BLOQ">
          <div className="board-meta"><span>{game.result ? 'PARTIDA ENCERRADA' : 'PARTIDA EM ANDAMENTO'}</span><span>RODADA {String(round).padStart(2, '0')} <span className="meta-diamond" /></span></div>
          <PlayerStrip color="black" name={mode === 'computer' ? 'M\u00e1quina' : 'Jogador 2'}
            active={game.turn === 'black' && !game.result} checked={game.turn === 'black' && inCheck && !game.result} />
          <div className="board-perspective">
            <div className="board-frame">
              <LayoutGroup id="bloq-board">
                <div className="board-grid" role="grid" aria-label="Tabuleiro de 8 por 8 casas">
                  {displaySquares.map((square, visualIndex) => {
                    const piece = game.board[square];
                    const legal = legalTargets.includes(square) && canInteract;
                    const isSelected = selected === square;
                    const isLast = game.lastMove?.from === square || game.lastMove?.to === square;
                    const checkedKing = inCheck && piece?.type === 'king' && piece.color === game.turn && !game.result;
                    const lightSquare = (Math.floor(square / 8) + square % 8) % 2 === 0;
                    const stagedIndex = blockerPhase ? draftBlockers.findIndex((move) => move.to === square) : -1;
                    const stagedSource = blockerPhase && draftBlockers.some((move) => move.from === square);
                    const canSelectPiece = canInteract && piece?.color === game.turn
                      && (blockerPhase ? piece.type === 'blocker' : piece.type !== 'blocker');
                    const label = `Casa ${squareName(square)}, ${piece ? `${pieceNames[piece.type]} ${piece.color === 'white' ? 'claro' : 'escuro'}` : 'vazia'}${stagedIndex >= 0 ? ', destino provis\u00f3rio de B' : ''}${legal ? ', movimento disponivel' : ''}`;
                    return (
                      <button key={square} type="button" role="gridcell" aria-label={label}
                        aria-selected={isSelected} onClick={() => handleSquareClick(square)}
                        className={`square ${lightSquare ? 'square-light' : 'square-dark'} ${isLast ? 'last-move' : ''} ${isSelected ? 'selected-square' : ''} ${checkedKing ? 'checked-square' : ''} ${legal ? 'legal-square' : ''} ${canSelectPiece ? 'selectable-square' : ''} ${stagedSource ? 'batch-origin' : ''}`}>
                        {piece && <motion.span layoutId={`piece-${piece.id}`}
                          className={`piece-wrap ${piece.type === 'blocker' ? 'is-blocker' : ''}`}
                          transition={{ type: 'spring', stiffness: 390, damping: 34 }}>
                          <PieceArt piece={piece} />
                        </motion.span>}
                        {stagedIndex >= 0 && <span className="batch-destination" aria-hidden="true"><b>B</b><small>{stagedIndex + 1}</small></span>}
                        {legal && <span className={piece ? 'capture-ring' : 'move-dot'} aria-hidden="true" />}
                        {visualIndex % 8 === 0 && <span className="coord-rank">{squareName(square).slice(1)}</span>}
                        {visualIndex >= 56 && <span className="coord-file">{squareName(square)[0]}</span>}
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </div>
          </div>
          <PlayerStrip color="white" name={mode === 'computer' ? 'Voc\u00ea' : 'Jogador 1'}
            active={game.turn === 'white' && !game.result} checked={game.turn === 'white' && inCheck && !game.result} />
          <div className={`board-under ${blockerPhase ? 'board-under-batch' : ''}`}>
            {blockerPhase ? <>
              <div className="batch-progress"><strong>{draftBlockers.length}/3 B</strong><span>{draftBlockers.length === 0 ? 'selecione B e casa livre' : 'destinos marcados'}</span></div>
              <div className="batch-controls">
                {draftBlockers.length > 0 && <button type="button" className="batch-reset" onClick={() => { setDraftBlockers([]); setSelected(null); }}>Limpar</button>}
                <button type="button" className="batch-flip" aria-label="Virar tabuleiro" title="Virar tabuleiro"
                  onClick={() => { setFlipped(!flipped); setSelected(null); }}><RotateCw size={16} /></button>
                <button type="button" className="batch-confirm" disabled={!readyToMoveBlockers} onClick={confirmBlockerBatch}>
                  Mover os 3 B <ArrowRight size={15} />
                </button>
              </div>
            </> : <>
              <span>Clique em uma pe&ccedil;a para ver as jogadas.</span>
              <button type="button" onClick={() => { setFlipped(!flipped); setSelected(null); }}>
                <RotateCw size={15} /> Virar tabuleiro
              </button>
            </>}
          </div>
        </section>

        <aside className="info-panel">
          <div className="turn-section">
            <div className="section-heading"><span>NO TABULEIRO</span><span className="turn-number">0{game.turn === 'white' ? '1' : '2'}</span></div>
            <AnimatePresence mode="wait">
              <motion.div key={`${statusTitle}-${blockerPhase}-${shiftsRemaining}`} className="turn-message"
                initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -7 }} transition={{ duration: 0.22 }}>
                <h2>{statusTitle}</h2><p>{statusText}</p>
              </motion.div>
            </AnimatePresence>
            <div className="turn-label"><span className={`turn-color turn-${game.turn}`} />
              {game.result ? 'Partida finalizada' : game.turn === 'white' ? 'Pe\u00e7as claras' : 'Pe\u00e7as escuras'}
              <span className="turn-label-line" />
            </div>
          </div>
          <div className="blocker-section">
            <div className="blocker-heading"><span>A REGRA QUE MUDA TUDO</span><span className="outline-b">B</span></div>
            <h3>O jogo tem<br /><em>novos limites.</em></h3>
            <p>As pe&ccedil;as B travam o caminho. Apenas os cavalos podem saltar por cima.</p>
            <div className="cycle-readout">
              <strong>{blockerPhase ? String(shiftsRemaining).padStart(2, '0') : String(roundsUntilShift).padStart(2, '0')}</strong>
              <span>{blockerPhase ? 'destinos para marcar' : game.blockerDue[game.turn] && inCheck ? 'troca adiada pelo xeque' : 'rodadas at\u00e9 a pr\u00f3xima troca'}</span>
            </div>
            <div className="cycle-track" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((step) => <span key={step}
                className={blockerPhase || game.blockerDue[game.turn] || step < turnsInCycle ? 'filled' : ''} />)}
            </div>
            <button type="button" className="learn-link" onClick={() => setModal('rules')}>
              Entenda as regras <ArrowRight size={16} />
            </button>
          </div>
          <div className="history-section">
            <div className="section-heading"><span>HIST&Oacute;RICO</span><span className="heading-index">{String(game.history.length).padStart(2, '0')}</span></div>
            {game.history.length === 0 ? <p className="history-empty">Cada grande partida come&ccedil;a com uma jogada.</p> : (
              <ol className="history-list">{game.history.slice(-5).reverse().map((entry, index) => (
                <li key={`${game.history.length - index}-${entry.notation}`}>
                  <span className="history-round">{String(entry.round).padStart(2, '0')}</span>
                  <span className={`history-color history-${entry.color}`} />
                  <span className="history-notation">{entry.notation}</span>
                  {entry.kind === 'blocker' && <span className="history-b">B</span>}
                </li>
              ))}</ol>
            )}
          </div>
        </aside>
      </main>

      <footer className="page-footer">
        <span>BLOQ. &copy; 2026 &nbsp; / &nbsp; THINK BEYOND THE BOARD</span>
        <span>Pe&ccedil;as vetoriais em SVG &middot; alta nitidez</span>
      </footer>

      <AnimatePresence>
        {modal === 'rules' && <ModalShell key="rules" wide onClose={() => setModal(null)}>
          <div className="modal-eyebrow"><BookOpen size={15} /> O GUIA DO BLOQ</div>
          <h2 className="modal-title">Xadrez, com uma<br /><em>nova regra no caminho.</em></h2>
          <p className="modal-intro">BLOQ é um jogo de estratégia próprio, inspirado no xadrez. Não existem peões: cada lado começa com oito peças principais e três bloqueadores móveis.</p>
          <div className="rules-grid">
            <div className="rule-item"><span>01</span><div><h3>Forma&ccedil;&atilde;o das pe&ccedil;as</h3><p>Primeira fileira completa: 2 torres, 2 cavalos, 2 bispos, rei e rainha. Na segunda, os 3 B ficam diante das torres e do rei; 2 cavalos, 2 bispos e 1 rainha ficam diante das pe&ccedil;as iguais.</p></div></div>
            <div className="rule-item"><span>02</span><div><h3>O bloqueador B</h3><p>Os B n&atilde;o capturam nem podem ser capturados. Eles impedem a passagem de qualquer pe&ccedil;a, exceto os cavalos, que saltam normalmente.</p></div></div>
            <div className="rule-item"><span>03</span><div><h3>Os 3 B primeiro</h3><p>Na abertura, marque 3 destinos livres e confirme: os B mudam juntos, antes de qualquer jogada normal. A troca se repete a cada 5 rodadas do jogador, sempre antes da pr&oacute;xima jogada e sem consumir o turno.</p></div></div>
            <div className="rule-item"><span>04</span><div><h3>Somente aliados separados</h3><p>Qualquer casa desocupada vale. B de cores opostas podem ficar lado a lado; B da mesma cor n&atilde;o, nem na diagonal. A troca fica adiada em xeque e n&atilde;o pode causar xeque. Sem trio legal, &eacute; dispensada.</p></div></div>
          </div>
          <div className="modal-rule-foot"><Crown size={20} /><span>Xeque, xeque-mate, roque e empate seguem as regras descritas neste jogo. O BLOQ não é uma partida de xadrez oficial: sua formação inicial e a movimentação dos bloqueadores são regras próprias. O histórico local prioriza vitórias e, depois, menor tempo.</span></div>
          <button type="button" className="modal-primary" onClick={() => setModal(null)}>Voltar ao tabuleiro <ArrowRight size={17} /></button>
        </ModalShell>}

        {modal === 'ranking' && <ModalShell key="ranking" onClose={() => setModal(null)}>
          <div className="modal-eyebrow"><Trophy size={15} /> HALL DA ESTRAT&Eacute;GIA</div>
          <h2 className="modal-title">Ranking <em>BLOQ.</em></h2>
          <p className="modal-intro">Histórico deste navegador. Vitórias aparecem primeiro; em seguida, as partidas mais rápidas. Não é um ranking mundial.</p>
          {rankings.length === 0 ? <div className="ranking-empty"><Trophy size={35} strokeWidth={1.2} /><strong>O primeiro lugar est&aacute; livre.</strong><span>Termine uma partida para entrar no ranking.</span></div> : (
            <div className="ranking-list"><div className="ranking-list-head"><span>POS.</span><span>PARTIDA</span><span>TEMPO</span></div>
              {rankings.slice(0, 10).map((entry, index) => <div className="ranking-item" key={entry.id}>
                <span className="ranking-position">{String(index + 1).padStart(2, '0')}</span>
                <div><strong>{entry.winner ? entry.winner === 'white' ? 'Claras venceram' : 'Escuras venceram' : 'Empate'}</strong>
                  <small>{entry.mode === 'computer' ? 'Contra m\u00e1quina' : '2 jogadores'} &middot; {entry.date} &middot; {formatTime(entry.seconds)} / {entry.movements} mov.</small></div>
                <b>{formatTime(entry.seconds)}</b>
              </div>)}</div>
          )}
          <div className="ranking-actions"><button type="button" className="modal-primary" onClick={() => setModal(null)}>Voltar ao jogo <ArrowRight size={17} /></button>
            {rankings.length > 0 && <button type="button" className="clear-ranking" onClick={() => {
              setRankings([]);
              try { localStorage.removeItem('bloq-ranking'); } catch { /* Local only. */ }
            }}>Limpar ranking</button>}
          </div>
        </ModalShell>}

        {modal === 'confirm' && <ModalShell key="confirm" onClose={() => { setModal(null); setPendingMode(null); }}>
          <div className="modal-eyebrow"><RotateCcw size={15} /> NOVA PARTIDA</div>
          <h2 className="modal-title">Recome&ccedil;ar<br /><em>o jogo?</em></h2>
          <p className="modal-intro">A partida atual ser&aacute; encerrada sem entrar no ranking. Um novo tabuleiro estar&aacute; pronto para voc&ecirc;.</p>
          <div className="confirm-actions"><button type="button" className="modal-primary" onClick={() => startNewGame(pendingMode || mode)}>Sim, recome&ccedil;ar <ArrowRight size={17} /></button>
            <button type="button" className="secondary-action" onClick={() => { setModal(null); setPendingMode(null); }}>Continuar jogando</button>
          </div>
        </ModalShell>}

        {modal === 'result' && game.result && <ModalShell key="result" onClose={() => setModal(null)}>
          <div className="result-icon"><Crown size={26} strokeWidth={1.4} /></div>
          <div className="modal-eyebrow">PARTIDA CONCLU&Iacute;DA</div>
          <h2 className="modal-title">{game.result.kind === 'checkmate' ? 'Xeque-mate.' : 'Empate.'}<br />
            <em>{game.result.winner ? game.result.winner === 'white' ? 'Vit\u00f3ria das claras.' : 'Vit\u00f3ria das escuras.' : 'Uma boa disputa.'}</em></h2>
          <p className="modal-intro">Resultado salvo no histórico local deste navegador.</p>
          <div className="result-stats"><div><span>TEMPO</span><strong>{formatTime(elapsed)}</strong></div><div><span>AÇÕES</span><strong>{game.movements}</strong></div></div>
          <div className="confirm-actions"><button type="button" className="modal-primary" onClick={() => startNewGame()}>Jogar novamente <ArrowRight size={17} /></button>
            <button type="button" className="secondary-action" onClick={() => setModal('ranking')}>Ver ranking</button></div>
        </ModalShell>}
      </AnimatePresence>
    </div>
  );
}
