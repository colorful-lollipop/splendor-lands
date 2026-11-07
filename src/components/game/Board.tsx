import { useState } from 'react';
import { CARD_MAP, NOBLE_MAP, TIER_INFO, COLORS, GEM, computePayment, tierRoman } from '../../lib/meta';
import { useStore } from '../../store';
import { CardView, NobleTile } from '../CardView';
import { CardBack, Icon } from '../Ornaments';
import { Gem } from '../Gem';
import type { CardData, GameView, PlayerView } from '../../lib/types';
import { sfx } from '../../lib/sfx';

interface BoardProps {
  game: GameView;
  me: PlayerView | null;
  onInspect: (card: CardData, source: { kind: 'board'; tier: number; index: number } | { kind: 'reserved'; cardId: string } | { kind: 'deck'; tier: number }) => void;
  onInspectNoble: (nobleId: string) => void;
  pendingNoble: boolean;
  onChooseNoble: (id: string) => void;
}

export function BoardSurface({ game, me, onInspect, onInspectNoble, pendingNoble, onChooseNoble }: BoardProps) {
  const skins = useStore((s) => s.skins);
  const eligible = new Set<string>(pendingNoble ? (game.pending?.options || []) : []);
  const myTurn = game.canAct;
  const [tier, setTier] = useState(1);

  const affordableIn = (t: number) =>
    (game.board[String(t)] || []).some((id) => {
      if (!id) return false;
      const card = CARD_MAP.get(id);
      if (!card) return false;
      return Boolean(me && myTurn && computePayment(card, me.bonuses, me.tokens).affordable);
    });

  return (
    <div className="board-surface" data-table={skins.table}>
      <div className="nobles-strip">
        <div className="strip-label">贵族</div>
        <div className="nobles-row">
          {game.nobles.length === 0 && <span className="nobles-empty">所有贵族都已效忠某位商人</span>}
          {game.nobles.map((id) => {
            const noble = NOBLE_MAP.get(id);
            if (!noble) return null;
            const canPick = pendingNoble && eligible.has(id);
            return (
              <NobleTile
                key={id}
                noble={noble}
                highlight={pendingNoble && eligible.has(id)}
                selectable={canPick}
                onClick={
                  canPick
                    ? () => {
                        sfx('noble');
                        onChooseNoble(id);
                      }
                    : () => onInspectNoble(id)
                }
              />
            );
          })}
        </div>
      </div>

      <div className="tier-tabs">
        {[3, 2, 1].map((t) => (
          <button
            key={t}
            className={`tier-tab ${tier === t ? 'is-active' : ''}`}
            onClick={() => {
              sfx('click');
              setTier(t);
            }}
          >
            <span className="tt-roman">{tierRoman(t)}</span>
            <span className="tt-label">{TIER_INFO[t].label}</span>
            <span className="tt-deck">牌堆 {game.decks[String(t)] ?? 0}</span>
            {affordableIn(t) && <i className="tt-dot" />}
          </button>
        ))}
      </div>

      <div className="tier-single">
        <div className="row-cards">
          {(game.board[String(tier)] || []).map((id, index) => {
            if (!id) {
              return <div className="card-slot-empty" key={`empty-${tier}-${index}`} />;
            }
            const card = CARD_MAP.get(id);
            if (!card) return null;
            const payment = me ? computePayment(card, me.bonuses, me.tokens) : null;
            const affordable = myTurn && Boolean(payment?.affordable);
            return (
              <div className={`board-card-wrap ${affordable ? 'is-buyable' : ''}`} key={id}>
                <CardView
                  card={card}
                  size="board"
                  affordable={affordable}
                  me={me}
                  onClick={() => onInspect(card, { kind: 'board', tier, index })}
                />
                {affordable && <span className="buyable-flag">可购买</span>}
              </div>
            );
          })}
        </div>

        <DeckPile tier={tier} count={game.decks[String(tier)] ?? 0} onClick={() => onInspectDeck(tier, onInspect)} disabled={!myTurn} />
      </div>
    </div>
  );
}

function onInspectDeck(tier: number, onInspect: BoardProps['onInspect']) {
  onInspect({ id: `deck-${tier}`, tier: tier as 1 | 2 | 3, bonus: 'w', points: 0, art: '', name: '', cost: { w: 0, b: 0, g: 0, r: 0, k: 0 } }, { kind: 'deck', tier });
}

function DeckPile({ tier, count, onClick, disabled }: { tier: number; count: number; onClick: () => void; disabled: boolean }) {
  return (
    <button
      className={`deck-pile ${count === 0 ? 'is-empty' : ''}`}
      onClick={() => {
        if (disabled) return;
        sfx('click');
        onClick();
      }}
      disabled={disabled || count === 0}
      title={`${TIER_INFO[tier].label}牌堆 · 剩余 ${count} 张（预订可盲抽一张）`}
    >
      <div className="deck-stack">
        <CardBack label={count > 0 ? `${tierRoman(tier)}` : ''} />
      </div>
      <div className="deck-meta">
        <span className="deck-count">{count}</span>
        <span className="deck-sub">{count === 0 ? '已抽空' : '预订盲抽'}</span>
      </div>
    </button>
  );
}

export function BankBar({
  game,
  selection,
  onToggle,
  onClear,
  onTake,
}: {
  game: GameView;
  selection: string[];
  onToggle: (color: string) => void;
  onClear: () => void;
  onTake: () => void;
}) {
  const myTurn = game.canAct && game.phase === 'action';
  const pair = selection.length === 2 && selection[0] === selection[1];
  const distinct = new Set(selection).size === selection.length && selection.length > 0;
  const availableColors = COLORS.filter((c) => game.tokens[c] > 0).length;
  const valid = pair ? game.tokens[selection[0] as keyof typeof game.tokens] >= 4 : distinct && (selection.length === 3 || selection.length === Math.min(3, availableColors));
  const totalSelected = selection.length;

  return (
    <div className="bank-bar">
      <div className="bank-title">
        <b>宝石银行</b>
        <span>点击选择</span>
      </div>

      <div className="bank-tokens">
        {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => {
          const count = game.tokens[c];
          const picked = selection.filter((x) => x === c).length;
          const isGold = c === 'gold';
          return (
            <button
              key={c}
              data-color={c}
              className={`bank-token ${count === 0 ? 'is-empty' : ''} ${picked ? 'is-selected' : ''}`}
              onClick={() => myTurn && !isGold && count > 0 && onToggle(c)}
              disabled={!myTurn || isGold || count === 0}
              title={isGold ? '黄金为万能宝石，只能通过预订卡牌获得' : `${GEM[c].name} · 剩 ${count} 枚`}
            >
              <span className="token-gem">
                <Gem color={c} size={30} variant="faceted" />
              </span>
              <span className="token-name">{GEM[c].name}</span>
              {picked > 0 && <span className="token-picked-badge">{picked}</span>}
              <span className="token-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="bank-hint">
        {!myTurn ? (
          <>等待其他商人行动…</>
        ) : selection.length === 0 ? (
          <>拿取 <b>3 枚不同颜色</b>，或 <b>2 枚同色</b>（该色需剩 4 枚以上）</>
        ) : (
          <>
            已选 <b>{totalSelected}</b> 枚 · {valid ? '可以拿取' : pair ? '该色不足 4 枚' : '需选满 3 种不同颜色'}
            <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
              <button className="btn btn-sm btn-ghost" onClick={onClear}>
                取消
              </button>
              <button className="btn btn-sm" disabled={!valid} onClick={onTake}>
                拿取
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function miniBonusDots(bonuses: Record<string, number>) {
  return COLORS.filter((c) => (bonuses[c] || 0) > 0).map((c) => (
    <span className="bonus-chip" key={c}>
      <Gem color={c} size={11} variant="faceted" />
      <span className="num">{bonuses[c]}</span>
    </span>
  ));
}

export function TokenPill({ color, count }: { color: string; count: number }) {
  return (
    <span className={`wallet-pill ${count === 0 ? 'is-zero' : ''}`}>
      <Gem color={color as never} size={13} variant="faceted" />
      <span className="num">{count}</span>
    </span>
  );
}

export function CardSlotEmpty() {
  return (
    <div className="card-slot-empty">
      <Icon name="gem" size={16} />
    </div>
  );
}