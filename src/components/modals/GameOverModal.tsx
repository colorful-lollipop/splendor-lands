import { useMemo } from 'react';
import { leaveRoom, rematch, useStore } from '../../store';
import { Avatar } from '../Avatar';
import { Icon } from '../Ornaments';
import { Modal } from './Modal';
import { NOBLE_MAP } from '../../lib/meta';

export function GameOverModal() {
  const game = useStore((s) => s.game);
  const room = useStore((s) => s.room);
  const selfId = useStore((s) => s.selfId);
  if (!game) return null;
  const isHost = room?.hostId === selfId || game.me?.isHost;

  const ranked = useMemo(() => {
    return [...game.players].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      return a.cardCount - b.cardCount;
    });
  }, [game]);

  const winners = game.players.filter((p) => game.winners.includes(p.id));
  const winNames = winners.map((p) => p.name).join('、');

  return (
    <Modal title="对局结束" onClose={undefined} hideClose width={640}>
      <div className="gameover-hero">
        <div className="gameover-crown">
          <Icon name="crown" size={34} />
        </div>
        <div className="gameover-title gold-text">{winNames} 赢得荣耀</div>
        <div className="gameover-sub">
          最高 {winners[0]?.points ?? 0} 点声望 · 共 {game.turnCount} 次行动 · 第 {game.round} 轮
        </div>
      </div>

      <div className="rank-list">
        {ranked.map((p, i) => (
          <div className={`rank-row ${game.winners.includes(p.id) ? 'is-winner' : ''}`} key={p.id}>
            <span className="rank-index">#{i + 1}</span>
            <Avatar name={p.name} skinKey={p.avatar} size={36} className="rank-avatar" glow={game.winners.includes(p.id)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="rank-name">
                {p.name}
                {p.id === selfId && <span className="tag" style={{ marginLeft: 6 }}>你</span>}
              </div>
              <div className="rank-meta">
                {p.cardCount} 张发展卡 · {p.nobles.length} 位贵族 · {p.bonuses ? Object.values(p.bonuses).reduce((a, b) => a + b, 0) : 0} 点加成
                {p.nobles.length > 0 && ` · ${p.nobles.map((n) => NOBLE_MAP.get(n)?.name).filter(Boolean).join('、')}`}
              </div>
            </div>
            <span className="rank-points">{p.points}</span>
          </div>
        ))}
      </div>

      <div className="gameover-actions">
        {isHost ? (
          <button className="btn" onClick={() => rematch()}>
            <Icon name="sparkle" size={15} /> 再来一局
          </button>
        ) : (
          <div className="cd-note">等待房主开启新一局…</div>
        )}
        <button className="btn btn-ghost" onClick={() => leaveRoom()}>
          <Icon name="leave" size={15} /> 返回大厅
        </button>
      </div>
    </Modal>
  );
}