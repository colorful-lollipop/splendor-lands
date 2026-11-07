import { useMemo, useState } from 'react';
import { CARDS, COLORS, GEM, cardName, tierRoman } from '../../lib/meta';
import type { Color } from '../../lib/types';
import { useStore } from '../../store';
import { CardView } from '../CardView';
import { Gem } from '../Gem';
import { Icon } from '../Ornaments';
import { Modal } from './Modal';

type TierFilter = 'all' | '1' | '2' | '3';

export function CollectionModal({ onClose }: { onClose: () => void }) {
  const unlocked = useStore((s) => s.unlockedCards);
  const artSkin = useStore((s) => s.skins.art);
  const [tier, setTier] = useState<TierFilter>('all');
  const [color, setColor] = useState<'all' | Color>('all');
  const [ownedOnly, setOwnedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const owned = useMemo(() => new Set(unlocked), [unlocked]);

  const cards = useMemo(
    () =>
      CARDS.filter(
        (card) =>
          (tier === 'all' || card.tier === Number(tier)) &&
          (color === 'all' || card.bonus === color) &&
          (!ownedOnly || owned.has(card.id)),
      ),
    [tier, color, ownedOnly, owned],
  );
  const selected = selectedId && owned.has(selectedId) ? CARDS.find((card) => card.id === selectedId) || null : null;
  const percent = Math.round((owned.size / CARDS.length) * 100);

  return (
    <Modal title="宝石图鉴" subtitle="每一次购入，都是一页新的收藏 · 永久保存在本机" onClose={onClose} width={1120}>
      <div className="collection-head">
        <div className="collection-progress-copy">
          <span>收藏进度</span>
          <strong>{owned.size}<small> / {CARDS.length}</small></strong>
          <span>{percent}%</span>
        </div>
        <div className="collection-progress" aria-label={`已收藏 ${owned.size} 张，共 ${CARDS.length} 张`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="collection-tier-counts">
          {([1, 2, 3] as const).map((t) => {
            const all = CARDS.filter((card) => card.tier === t);
            const count = all.filter((card) => owned.has(card.id)).length;
            return <span key={t}>{tierRoman(t)} 级 <b>{count}/{all.length}</b></span>;
          })}
        </div>
      </div>

      <div className="collection-filters">
        <div className="collection-filter-group" aria-label="等级筛选">
          {(['all', '1', '2', '3'] as const).map((value) => (
            <button key={value} className={tier === value ? 'is-active' : ''} onClick={() => setTier(value)}>
              {value === 'all' ? '全部等级' : `${tierRoman(Number(value))} 级`}
            </button>
          ))}
        </div>
        <div className="collection-filter-group collection-colors" aria-label="颜色筛选">
          <button className={color === 'all' ? 'is-active' : ''} onClick={() => setColor('all')}>全部</button>
          {COLORS.map((c) => (
            <button key={c} className={color === c ? 'is-active' : ''} onClick={() => setColor(c)} title={GEM[c].name} aria-label={GEM[c].name}>
              <Gem color={c} size={16} variant="faceted" />
            </button>
          ))}
        </div>
        <button className={`collection-owned-toggle ${ownedOnly ? 'is-active' : ''}`} onClick={() => setOwnedOnly((value) => !value)}>
          <Icon name="check" size={13} /> 只看已收录
        </button>
      </div>

      <div className={`collection-layout ${selected ? 'has-preview' : ''}`}>
        <div className="collection-grid">
          {cards.map((card) => {
            const isOwned = owned.has(card.id);
            return (
              <div className={`collection-card ${isOwned ? 'is-owned' : 'is-locked'} ${selectedId === card.id ? 'is-selected' : ''}`} key={card.id}>
                <CardView
                  card={card}
                  size="search"
                  hideName={false}
                  dim={!isOwned}
                  selected={selectedId === card.id}
                  onClick={isOwned ? () => setSelectedId(card.id) : undefined}
                />
                {!isOwned && (
                  <div className="collection-lock">
                    <Icon name="lock" size={18} />
                    <span>未收录</span>
                  </div>
                )}
                {isOwned && <span className="collection-owned-mark"><Icon name="check" size={11} /> 已收录</span>}
              </div>
            );
          })}
          {cards.length === 0 && (
            <div className="collection-empty">
              <Icon name="gem" size={30} />
              <b>这里还没有卡牌</b>
              <span>在对局中购入发展卡，即可点亮对应图鉴。</span>
            </div>
          )}
        </div>

        {selected && (
          <aside className="collection-preview">
            <button className="collection-preview-close" onClick={() => setSelectedId(null)} aria-label="关闭卡牌预览">
              <Icon name="close" size={14} />
            </button>
            <CardView card={selected} size="large" />
            <div className="collection-preview-tier">{tierRoman(selected.tier)} 级 · {GEM[selected.bonus].name}加成</div>
            <h3>{cardName(selected, artSkin)}</h3>
            <div className="collection-preview-points">{selected.points}<span>声望</span></div>
            <div className="collection-preview-cost">
              {COLORS.filter((c) => selected.cost[c] > 0).map((c) => (
                <span key={c}><Gem color={c} size={18} variant="faceted" /> {selected.cost[c]}</span>
              ))}
            </div>
            <p>已在你的商人旅程中购入。切换卡面画风，可欣赏这张卡牌的其他艺术版本。</p>
          </aside>
        )}
      </div>
    </Modal>
  );
}
