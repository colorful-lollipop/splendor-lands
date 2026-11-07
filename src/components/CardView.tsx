import type { CSSProperties, ReactNode } from 'react';
import { COLORS, cardArt, cardName, computePayment, tierRoman, GEM, nobleArt } from '../lib/meta';
import type { CardData, PlayerView } from '../lib/types';
import { CornerFlourish } from './Ornaments';
import { Gem } from './Gem';
import { useStore } from '../store';

interface CardViewProps {
  card: CardData;
  size?: 'board' | 'mini' | 'large' | 'search' | 'mobile' | 'micro';
  affordable?: boolean;
  dim?: boolean;
  selected?: boolean;
  me?: PlayerView | null;
  onClick?: () => void;
  hideName?: boolean;
  className?: string;
  badges?: ReactNode;
  /** 皮肤工坊预览时覆盖当前画风，让每套画风展示自己的原画与卡名。 */
  skinOverride?: import('../lib/types').ArtSkin;
}

export function CardView({
  card,
  size = 'board',
  affordable = false,
  dim = false,
  selected = false,
  me,
  onClick,
  hideName = false,
  className = '',
  badges,
  skinOverride,
}: CardViewProps) {
  const payment = me ? computePayment(card, me.bonuses, me.tokens) : null;
  const currentSkin = useStore((s) => s.skins.art);
  const artSkin = skinOverride || currentSkin;
  const cls = [
    'card',
    `card-${size}`,
    affordable ? 'is-affordable' : '',
    dim ? 'is-dim' : '',
    selected ? 'is-selected' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const costEntries = COLORS.filter((c) => (card.cost[c] || 0) > 0);

  return (
    <button
      type="button"
      className={cls}
      data-bonus={card.bonus}
      data-tier={card.tier}
      data-art={artSkin}
      onClick={onClick}
      disabled={!onClick}
      aria-label={`${cardName(card, artSkin)}，${GEM[card.bonus].name}加成，${card.points} 声望`}
      title={payment ? `${GEM[card.bonus].name}加成 · 需支付 ${payment.gold} 枚黄金等价物${payment.affordable ? ' · 可以购买' : ''}` : undefined}
    >
      <span className="card-inner">
        <span className="card-art">
          <img src={cardArt(card.art, artSkin)} alt="" draggable={false} loading="lazy" />
          <span className="card-art-glow" />
          <span className="card-art-vignette" />
        </span>

        <span className="card-tier">{tierRoman(card.tier)}</span>

        {card.points > 0 && (
          <span className="card-points" title={`${card.points} 点声望`}>
            <span className="num">{card.points}</span>
          </span>
        )}

        <span className="card-bonus" title={`${GEM[card.bonus].name}加成`}>
          <Gem color={card.bonus} size={size === 'large' ? 26 : 19} variant="faceted" />
        </span>

        {!hideName && <span className={`card-name ${size === 'mini' ? 'is-tiny' : ''}`}>{cardName(card, artSkin)}</span>}

        <span className="card-cost">
          {costEntries.map((c) => (
            <span key={c} className={`cost-pip ${payment && payment.need[c] > 0 ? 'is-needed' : ''}`}>
              <Gem color={c} size={size === 'large' ? 20 : 14} variant="faceted" />
              <span className="num">{card.cost[c]}</span>
            </span>
          ))}
        </span>

        <span className="card-frame-line" aria-hidden="true" />
        <CornerFlourish className="corner tl" />
        <CornerFlourish className="corner tr" />
        <CornerFlourish className="corner bl" />
        <CornerFlourish className="corner br" />
        {badges}
      </span>
    </button>
  );
}

interface NobleTileProps {
  noble: import('../lib/types').NobleData;
  size?: 'board' | 'large' | 'mobile';
  highlight?: boolean;
  onClick?: () => void;
  selectable?: boolean;
  className?: string;
}

export function NobleTile({ noble, size = 'board', highlight, onClick, selectable, className = '' }: NobleTileProps) {
  const entries = COLORS.filter((c) => (noble.cost[c] || 0) > 0);
  const nobleSkin = useStore((s) => s.skins.noble);
  return (
    <button
      type="button"
      className={`noble noble-${size} ${highlight ? 'is-highlight' : ''} ${selectable ? 'is-selectable' : ''} ${className}`}
      onClick={onClick}
      disabled={!onClick}
      title={`${noble.name} · ${noble.title}`}
      aria-label={`贵族 ${noble.name}，需要 ${entries.map((c) => `${GEM[c].name}${noble.cost[c]}`).join('、')}`}
    >
      <span className="noble-frame">
        <span className="noble-art">
          <img src={nobleArt(noble.art, nobleSkin)} alt="" draggable={false} loading="lazy" />
          <span className="noble-art-fade" />
        </span>
        <span className="noble-points" title="3 点声望">
          <span className="num">3</span>
        </span>
        <span className="noble-name">{noble.name}</span>
        <span className="noble-req">
          {entries.map((c) => (
            <span className="noble-req-item" key={c}>
              <Gem color={c} size={size === 'large' ? 20 : 13} variant="faceted" />
              <span className="num">{noble.cost[c]}</span>
            </span>
          ))}
        </span>
        <CornerFlourish className="corner tl" />
        <CornerFlourish className="corner br" />
      </span>
    </button>
  );
}

export function miniAvatarStyle(key: string): CSSProperties {
  return { backgroundImage: `url(${key.startsWith('noble-') ? `/assets/art/${key}.webp` : `/assets/art/${key}.webp`})` };
}