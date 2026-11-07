import { useMemo, useState } from 'react';
import { COLORS, GEM, nobleArt } from '../../lib/meta';
import type { GameView, PlayerView, TokenColor } from '../../lib/types';
import { sendAction, useStore } from '../../store';
import { Gem } from '../Gem';
import { Modal } from './Modal';
import { Icon } from '../Ornaments';
import { sfx } from '../../lib/sfx';

export function DiscardModal({ game, me }: { game: GameView; me: PlayerView }) {
  const mustReturn = game.pending?.mustReturn || 0;
  const [picks, setPicks] = useState<Record<string, number>>({});
  const picked = useMemo(() => Object.values(picks).reduce((a, b) => a + b, 0), [picks]);

  const add = (c: TokenColor, delta: number) => {
    setPicks((prev) => {
      const next = { ...prev };
      const value = Math.max(0, Math.min((me.tokens[c] || 0), (next[c] || 0) + delta));
      if (value === 0) delete next[c];
      else next[c] = value;
      if (Object.values(next).reduce((a, b) => a + b, 0) > mustReturn) return prev;
      return next;
    });
    sfx('click');
  };

  const confirm = () => {
    if (picked !== mustReturn) return;
    sfx('gem');
    sendAction({ type: 'returnTokens', tokens: picks });
  };

  return (
    <Modal
      title="宝石超载"
      subtitle={`你最多只能持有 10 枚宝石，需要归还 ${mustReturn} 枚`}
      hideClose
      width={600}
    >
      <div className="discard-copy">
        选择要归还给银行的宝石。黄金也可以归还。归还完成后，你的回合将自动结束。
      </div>
      <div className="discard-grid">
        {(['w', 'b', 'g', 'r', 'k', 'gold'] as TokenColor[]).map((c) => {
          const held = me.tokens[c] || 0;
          const n = picks[c] || 0;
          return (
            <div className={`discard-item ${n > 0 ? 'is-picked' : ''} ${held === 0 ? 'is-empty' : ''}`} key={c}>
              <Gem color={c} size={30} variant="faceted" />
              <div className="di-name">{GEM[c].name}</div>
              <div className="di-held">持有 {held}</div>
              <div className="di-stepper">
                <button onClick={() => add(c, -1)} disabled={n <= 0} aria-label="减少">
                  <Icon name="minus" size={12} />
                </button>
                <span className="num">{n}</span>
                <button onClick={() => add(c, 1)} disabled={n >= held || picked >= mustReturn} aria-label="增加">
                  <Icon name="plus" size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="discard-footer">
        <span className={picked === mustReturn ? 'ok' : ''}>
          已选择 <b>{picked}</b> / {mustReturn} 枚
        </span>
        <button className="btn" onClick={confirm} disabled={picked !== mustReturn}>
          <Icon name="check" size={15} /> 确认归还
        </button>
      </div>
    </Modal>
  );
}

export function NobleChoiceModal({ game, onChoose }: { game: GameView; onChoose: (id: string) => void }) {
  const options = game.pending?.options || [];
  const nobleSkin = useStore((s) => s.skins.noble);
  return (
    <Modal title="贵族来访" subtitle="你满足了多位贵族的条件，只能选择其中一位迎接" hideClose width={560}>
      <div className="noble-choice-grid">
        {options.map((id) => {
          const noble = NOBLE_OPTIONS.find((n) => n.id === id);
          if (!noble) return null;
          return (
            <div key={id} className="noble-choice">
              <div className="noble-choice-art">
                <img src={nobleArt(noble.id, nobleSkin)} alt={noble.name} />
                <span className="noble-choice-points num">3</span>
              </div>
              <div className="noble-choice-name">{noble.name}</div>
              <div className="noble-choice-title">{noble.title}</div>
              <div className="noble-choice-req">
                {COLORS.filter((c) => noble.cost[c] > 0).map((c) => (
                  <span key={c}>
                    <Gem color={c} size={13} variant="faceted" /> {noble.cost[c]}
                  </span>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => onChoose(id)}>
                迎接这位贵族
              </button>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

import noblesJson from '../../../shared/nobles.json';
import type { NobleData } from '../../lib/types';
const NOBLE_OPTIONS = noblesJson as NobleData[];