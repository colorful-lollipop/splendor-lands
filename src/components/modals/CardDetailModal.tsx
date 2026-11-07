import type { CardData, GameView, PlayerView } from '../../lib/types';
import { COLORS, GEM, NOBLE_MAP, cardName, computePayment, nobleArt } from '../../lib/meta';
import { useStore, sendAction, notify } from '../../store';
import { CardView, NobleTile } from '../CardView';
import { Modal } from './Modal';
import { Gem } from '../Gem';
import { CardBack, Icon } from '../Ornaments';
import { sfx } from '../../lib/sfx';
import { speak } from '../../lib/voice';

export type InspectSource =
  | { kind: 'board'; tier: number; index: number }
  | { kind: 'reserved'; cardId: string }
  | { kind: 'deck'; tier: number };

export function CardDetailModal({
  card,
  source,
  game,
  me,
  onClose,
}: {
  card: CardData;
  source: InspectSource;
  game: GameView;
  me: PlayerView | null;
  onClose: () => void;
}) {
  const isDeck = source.kind === 'deck';
  const artSkin = useStore((s) => s.skins.art);
  const displayName = cardName(card, artSkin);
  const payment = me && !isDeck ? computePayment(card, me.bonuses, me.tokens) : null;
  const myTurn = game.canAct && game.phase === 'action';
  const reservedFull = (me?.reserved.length || 0) >= 3;
  const alreadyReserved = source.kind === 'reserved';

  const doBuy = () => {
    if (!myTurn || !payment?.affordable) return;
    sfx('buy');
    speak('buy', { speaker: me ? { name: me.name, avatar: me.avatar } : undefined, detail: displayName });
    sendAction({
      type: 'buy',
      source:
        source.kind === 'board'
          ? { kind: 'board', tier: source.tier, index: source.index }
          : { kind: 'reserved', cardId: (source as { cardId: string }).cardId },
    });
    onClose();
  };

  const doReserve = () => {
    if (!myTurn) return;
    if (reservedFull) {
      notify('最多只能保留 3 张卡牌', 'error');
      return;
    }
    sfx('click');
    speak('reserve', { speaker: me ? { name: me.name, avatar: me.avatar } : undefined });
    sendAction({
      type: 'reserve',
      source: source.kind === 'deck' ? { kind: 'deck', tier: source.tier } : { kind: 'board', tier: (source as { tier: number }).tier, index: (source as { index: number }).index },
    });
    onClose();
  };

  return (
    <Modal
      title={isDeck ? '盲抽预订' : displayName}
      subtitle={
        isDeck
          ? `${['', '一级', '二级', '三级'][source.kind === 'deck' ? source.tier : 1]}牌堆 · 未知卡牌`
          : `${['', '一级', '二级', '三级'][card.tier]} · ${GEM[card.bonus].name}加成 · ${card.points} 点声望`
      }
      onClose={onClose}
      width={780}
    >
      <div className="card-detail">
        <div className="card-detail-visual">
          {isDeck ? (
            <div className="deck-detail-visual">
              <CardBack label="?" />
            </div>
          ) : (
            <CardView card={card} size="large" me={me} hideName={false} />
          )}
          <div className="cd-section-title" style={{ marginTop: 4 }}>
            {isDeck ? '未知的命运' : `${GEM[card.bonus].name} · 卡牌`}
          </div>
        </div>

        <div className="card-detail-info">
          {isDeck ? (
            <>
              <div className="cd-desc">
                从牌堆顶盲抽一张卡牌并加入你的保留区。你可以将它留到之后的回合购买，或在下方详情中查看它真正的价值。
                <br />
                预订时会获得 1 枚黄金（若银行仍有黄金）。
              </div>
              <div className="cd-section-title">预订说明</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, lineHeight: 1.9, color: 'var(--muted)' }}>
                <li>保留的卡牌最多 3 张，只有你能看到</li>
                <li>黄金可在购买时替代任意颜色的宝石</li>
                <li>预订后立即从牌堆补充一张新的明牌</li>
              </ul>
              <div className="cd-actions">
                <button className="btn" onClick={doReserve} disabled={!myTurn || reservedFull}>
                  <Icon name="sparkle" size={15} /> 预订这张暗牌
                </button>
                {reservedFull && <span className="cd-note danger">保留区已满（3/3）</span>}
                {!myTurn && <span className="cd-note">现在不是你的回合</span>}
              </div>
            </>
          ) : (
            <>
              <div className="cd-desc">
                {card.points > 0 && (
                  <>
                    购入后立即获得 <b style={{ color: 'var(--gold-1)' }}>{card.points} 点声望</b>，
                  </>
                )}
                并获得一枚永久的<b style={{ color: 'var(--gold-1)' }}>{GEM[card.bonus].name}加成</b>，使之后购买同色需求的卡牌更便宜。
              </div>

              <div className="cd-section-title">成本明细（已计入你的加成）</div>
              <div className="cd-cost-grid">
                {COLORS.filter((c) => (card.cost[c] || 0) > 0).map((c) => {
                  const need = payment?.need[c] ?? card.cost[c];
                  const covered = (me?.bonuses[c] || 0) >= card.cost[c];
                  const have = me?.tokens[c] || 0;
                  return (
                    <div className={`cd-cost-item ${covered ? 'is-covered' : ''}`} key={c}>
                      <Gem color={c} size={20} variant="faceted" />
                      <span>{GEM[c].name}</span>
                      <span className="have">
                        {covered ? '加成抵消' : `持有 ${have}`}
                      </span>
                      <span className="need">{need}</span>
                    </div>
                  );
                })}
                {payment && payment.gold > 0 && (
                  <div className={`cd-cost-item ${payment.affordable ? '' : 'is-bad'}`}>
                    <Gem color="gold" size={20} variant="faceted" />
                    <span>黄金 / 缺口</span>
                    <span className="have">持有 {me?.tokens.gold || 0}</span>
                    <span className="need">{payment.gold}</span>
                  </div>
                )}
              </div>

              <div className={`cd-note ${payment?.affordable ? 'good' : 'danger'}`}>
                {myTurn ? (
                  payment?.affordable ? (
                    `支付方案：${payment.gold > 0 ? `使用 ${payment.gold} 枚黄金补足缺口 · ` : ''}购入后可获得 ${card.points} 分与 ${GEM[card.bonus].name}加成。`
                  ) : (
                    `还缺少 ${payment?.missing ?? 0} 枚宝石（可用黄金替代），暂时无法购入。`
                  )
                ) : (
                  '现在不是你的回合，只能查看。'
                )}
              </div>

              <div className="cd-actions">
                <button className="btn" onClick={doBuy} disabled={!myTurn || !payment?.affordable}>
                  <Icon name="gem" size={15} /> 购入卡牌
                </button>
                {!alreadyReserved && (
                  <button className="btn btn-ghost" onClick={doReserve} disabled={!myTurn || reservedFull}>
                    <Icon name="scroll" size={15} /> 预订（+1 黄金）
                  </button>
                )}
                {reservedFull && !alreadyReserved && <span className="cd-note danger">保留区已满（3/3）</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export function NobleDetailModal({ noble, game, me, onClose }: { noble: import('../../lib/types').NobleData; game: GameView; me: PlayerView | null; onClose: () => void }) {
  const own = me?.nobles.includes(noble.id);
  const eligible = me && COLORS.every((c) => (me.bonuses[c] || 0) >= (noble.cost[c] || 0));
  const nobleSkin = useStore((s) => s.skins.noble);
  return (
    <Modal title={noble.name} subtitle={`${noble.title} · ${noble.nameEn}`} onClose={onClose} width={620}>
      <div className="noble-detail">
        <div className="noble-detail-visual">
          <div className="noble-portrait-large">
            <img src={nobleArt(noble.art, nobleSkin)} alt={noble.name} />
            <span className="noble-detail-frame" />
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.1em' }}>
            {own ? '已效忠' : `需要 ${COLORS.filter((c) => noble.cost[c] > 0).map((c) => `${GEM[c].name} ${noble.cost[c]}`).join(' · ')}`}
          </div>
        </div>
        <div className="noble-detail-info">
          <div className="cd-desc">
            {noble.name} 是文艺复兴时代举足轻重的人物。向这位贵族展示你的宝石商队实力，
            即可获得 <b style={{ color: 'var(--gold-1)' }}>3 点声望</b>，并且这位贵族会永久留在你的名下。
          </div>
          <div className="cd-section-title">当前达成进度</div>
          <div className="noble-progress">
            {COLORS.filter((c) => noble.cost[c] > 0).map((c) => {
              const have = me?.bonuses[c] || 0;
              const need = noble.cost[c];
              return (
                <div className={`noble-progress-row ${have >= need ? 'is-done' : ''}`} key={c}>
                  <Gem color={c} size={18} variant="faceted" />
                  <span>{GEM[c].name}加成</span>
                  <span className="need">{have} / {need}</span>
                </div>
              );
            })}
          </div>
          <div className={`cd-note ${eligible ? 'good' : ''}`}>
            {own ? '这位贵族已经向你效忠。' : eligible ? '你已满足条件，回合结束时即可迎接这位贵族。' : '继续购买对应颜色的卡牌来满足条件。'}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export { NobleTile, NOBLE_MAP };