import { GEM } from '../lib/meta';
import type { GemSkin, TokenColor } from '../lib/types';

interface GemProps {
  color: TokenColor;
  size?: number;
  variant?: GemSkin;
  className?: string;
  glow?: boolean;
}

/** 宝石素材路径：public/assets/gems/{color}-{variant}.webp
 *  黄金在《璀璨宝石》里是金币而非宝石，因此无论何种宝石皮肤都使用金币素材。 */
export function gemArt(color: TokenColor, variant: GemSkin = 'faceted'): string {
  if (color === 'gold') return '/assets/gems/gold-coin.webp';
  return `/assets/gems/${color}-${variant}.webp`;
}

/**
 * 宝石。四种皮肤均为独立生成的写实素材（切面宝石 / 古国金币 / 原始晶簇 / 秘法符文），
 * 背景已抠为透明，可在任何底色上保持通透。
 */
export function Gem({ color, size = 28, variant = 'faceted', className = '', glow }: GemProps) {
  const c = GEM[color];
  return (
    <img
      src={gemArt(color, variant)}
      width={size}
      height={size}
      alt=""
      draggable={false}
      className={`gem-img ${className}`}
      style={{
        width: size,
        height: size,
        filter: glow ? `drop-shadow(0 0 ${Math.max(4, size / 3)}px ${c.hex}cc) drop-shadow(0 0 ${size / 6}px #ffffff66)` : undefined,
      }}
    />
  );
}

export function GemBadge({ color, count, size = 18 }: { color: TokenColor; count: number; size?: number }) {
  const c = GEM[color];
  return (
    <span className="gem-badge" style={{ boxShadow: `0 0 10px ${c.hex}55` }}>
      <Gem color={color} size={size} variant="faceted" />
      <span className="num">{count}</span>
    </span>
  );
}
