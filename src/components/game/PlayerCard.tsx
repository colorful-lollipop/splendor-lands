import { COLORS, GEM } from '../../lib/meta';
import type { GameView, PlayerView } from '../../lib/types';
import { Avatar } from '../Avatar';
import { Gem } from '../Gem';
import { useStore } from '../../store';

export function PlayerCard({ player, game, selfId }: { player: PlayerView; game: GameView; selfId: string | null }) {
  const skins = useStore((s) => s.skins);
  const isYou = player.id === selfId;
  const isTurn = player.isTurn;
  const bonusList = COLORS.filter((c) => (player.bonuses[c] || 0) > 0);
  const tokenList = (['w', 'b', 'g', 'r', 'k', 'gold'] as const).filter((c) => (player.tokens[c] || 0) > 0);

  return (
    <div className={`player-card ${isTurn ? 'is-turn' : ''} ${isYou ? 'is-you' : ''} ${!player.connected && !player.isBot ? 'is-offline' : ''}`}>
      {isTurn && <span className="pc-badge">行动中</span>}
      <Avatar name={player.name} skinKey={player.avatar} size={44} className="pc-avatar" glow={isTurn} />

      <div className="pc-main">
        <div className="pc-top">
          <span className="pc-name" title={player.name}>
            {player.name}
          </span>
          {isYou && <span className="tag">你</span>}
          {player.isBot && <span className="tag bot">电脑</span>}
          {!player.connected && !player.isBot && <span className="tag off">离线</span>}
        </div>

        <div className="pc-stats">
          {bonusList.length === 0 && tokenList.length === 0 && <span className="pc-empty">尚未持有宝石</span>}
          {bonusList.map((c) => (
            <span className="bonus-chip is-bonus" key={`b-${c}`} title={`${GEM[c].name}加成`}>
              <Gem color={c} size={11} variant="faceted" />
              <span className="num">{player.bonuses[c]}</span>
            </span>
          ))}
          {bonusList.length > 0 && tokenList.length > 0 && <span className="pc-divider" />}
          {tokenList.map((c) => (
            <span className="bonus-chip is-token" key={`t-${c}`} title={`${GEM[c].name} ${player.tokens[c]}`}>
              <Gem color={c} size={10} variant="faceted" />
              <span className="num">{player.tokens[c]}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="pc-side">
        <div className="pc-points">
          <span className="num">{player.points}</span>
          <span className="p-label">分</span>
        </div>
        <div className="pc-meta-row">
          {player.reservedCount > 0 && (
            <span className="pc-reserved" title={`保留 ${player.reservedCount} 张`}>
              {Array.from({ length: player.reservedCount }, (_, i) => (
                <span className="mini-back" key={i}>
                  <img src={`/assets/art/back-${skins.back}.webp`} alt="" />
                </span>
              ))}
            </span>
          )}
          {player.nobles.length > 0 && (
            <span className="pc-nobles" title={`${player.nobles.length} 位贵族`}>
              {player.nobles.map((n, i) => (
                <span className="pc-noble-dot" key={n + i} />
              ))}
            </span>
          )}
        </div>
        <span className="pc-cardcount">{player.cardCount} 张卡</span>
      </div>
    </div>
  );
}

export function PlayerRail({ game, selfId }: { game: GameView; selfId: string | null }) {
  return (
    <div className="player-list">
      {game.players.map((p) => (
        <PlayerCard key={p.id} player={p} game={game} selfId={selfId} />
      ))}
    </div>
  );
}