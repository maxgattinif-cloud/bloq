import type { Color, PieceType } from './game';

export type ArtType = Exclude<PieceType, 'blocker'>;

// Vector pieces: crisp at any size, with a distinct silhouette for each type.
export function ChessPieceArt({ type, color }: { type: ArtType; color: Color }) {
  const white = color === 'white';
  const id = `pc-${color}`;
  const body = `url(#${id}-body)`;
  const shared = {
    fill: body,
    stroke: white ? '#8d877a' : '#040506',
    strokeWidth: 1.1,
    strokeLinejoin: 'round' as const,
    strokeLinecap: 'round' as const,
  };
  const detail = white ? '#7d7767' : '#020304';
  const highlight = white ? 'rgba(255,255,255,.75)' : 'rgba(220,230,235,.32)';

  const head = (() => {
    switch (type) {
      case 'king':
        return (
          <>
            <path d="M40 42 C37 31 41 24 50 24 C59 24 63 31 60 42 Z" {...shared} />
            <rect x="47" y="8" width="6" height="19" rx="1.5" {...shared} />
            <rect x="41.5" y="12.5" width="17" height="5" rx="1.5" {...shared} />
          </>
        );
      case 'queen':
        return (
          <>
            <path d="M35 46 C35 37 38 33 41 31 L50 37 L59 31 C62 33 65 37 65 46 Z" {...shared} />
            <circle cx="36.5" cy="27" r="4.3" {...shared} />
            <circle cx="50" cy="22" r="4.8" {...shared} />
            <circle cx="63.5" cy="27" r="4.3" {...shared} />
          </>
        );
      case 'bishop':
        return (
          <>
            <path d="M50 7 C61 17 65 28 57 41 L43 41 C35 28 39 17 50 7 Z" {...shared} />
            <circle cx="50" cy="5.5" r="3.6" {...shared} />
            <path d="M45.5 21 L55.5 30" stroke={detail} strokeWidth="2.8" strokeLinecap="round" />
          </>
        );
      case 'knight':
        return (
          <>
            <path d="M32 80 C36 70 40 61 40 50 C36 46 34 40 34 34 C34 28 36 24 38 22 C40 14 46 9 52 6 L55 1 L60 9 C66 14 69 22 68 33 L66 45 C68 56 69 67 69 80 Z" {...shared} />
            <circle cx="49" cy="23" r="2.4" fill={detail} />
            <path d="M36 30 C42 27 47 28 52 33" fill="none" stroke={detail} strokeWidth="1" opacity=".5" />
          </>
        );
      case 'rook':
        return (
          <>
            <path d="M30 42 L30 22 L38 22 L38 30 L46 30 L46 22 L54 22 L54 30 L62 30 L62 22 L70 22 L70 42 Z" {...shared} />
          </>
        );
    }
  })();

  const column = type === 'rook'
    ? 'M33 82 L35 42 L65 42 L67 82 Z'
    : type === 'knight' ? null
    : 'M31 80 C37 68 41 58 42 46 L58 46 C59 58 63 68 69 80 Z';

  return (
    <svg className="chess-art" viewBox="0 0 100 120" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={white ? '#bcb7a8' : '#262b2e'} />
          <stop offset=".3" stopColor={white ? '#fffdf5' : '#6a7378'} />
          <stop offset=".58" stopColor={white ? '#efebdf' : '#3b4246'} />
          <stop offset="1" stopColor={white ? '#9f9a8b' : '#0c0f11'} />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="111" rx="37" ry="5" fill="#000" opacity=".28" />
      <path d="M11 86 L11 98 C11 107 29 111 50 111 C71 111 89 107 89 98 L89 86 Z" {...shared} />
      {column && <path d={column} {...shared} />}
      {column && <ellipse cx="50" cy="46" rx="12" ry="3.4" {...shared} />}
      {head}
      <ellipse cx="50" cy="86" rx="39" ry="12.5" {...shared} />
      <path d="M22 88 C28 95 40 97 50 97" fill="none" stroke={highlight} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M40 60 L40 74" stroke={highlight} strokeWidth="2.6" strokeLinecap="round" opacity=".8" />
      <ellipse cx="72" cy="84" rx="3" ry="1.2" fill={highlight} opacity=".7" />
    </svg>
  );
}
