import { useEffect, useRef, useState } from 'react';
import type { CardData, Color, GameView, PlayerView } from '../../lib/types';
import { CARD_MAP, COLORS, GEM, NOBLE_MAP, TIER_INFO, cardName, computePayment, tierRoman } from '../../lib/meta';
import { localizeCardText } from '../../lib/cardNames';
import { TurnTimer } from '../TurnTimer';
import { CardView, NobleTile } from '../CardView';
import { Avatar } from '../Avatar';
import { Gem } from '../Gem';
import { CardBack, Icon } from '../Ornaments';
import { openCollection, openRules, openSkins, sendChat, toggleMusic, toggleSfx, toggleVoice, useStore } from '../../store';
import { sfx } from '../../lib/sfx';

type Sheet = 'log' | 'chat' | 'menu' | 'players' | null;

export function MobileGame({
  game,
  me,
  myId,
  selection,
  onToggleGem,
  onClearGems,
  onTakeGems,
  onInspect,
  onInspectNoble,
  pendingNoble,
  onChooseNoble,
  onCopyCode,
  children,
}: {
  game: GameView;
  me: PlayerView | null;
  myId: string | null;
  selection: Color[];
  onToggleGem: (color: string) => void;
  onClearGems: () => void;
  onTakeGems: () => void;
  onInspect: (card: CardData, source: { kind: 'board'; tier: number; index: number } | { kind: 'reserved'; cardId: string } | { kind: 'deck'; tier: number }) => void;
  onInspectNoble: (id: string) => void;
  pendingNoble: boolean;
  onChooseNoble: (id: string) => void;
  onCopyCode: () => void;
  children?: React.ReactNode;
}) {
  const skins = useStore((s) => s.skins);
  const chat = useStore((s) => s.chat);
  const sfxOn = useStore((s) => s.sfxOn);
  const musicOn = useStore((s) => s.musicOn);
  const voiceOn = useStore((s) => s.voiceOn);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [tier, setTier] = useState(1);
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log, sheet]);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat, sheet]);

  const myTurn = game.canAct && game.phase === 'action';
  const pair = selection.length === 2 && selection[0] === selection[1];
  const distinct = new Set(selection).size === selection.length && selection.length > 0;
  const availableColors = COLORS.filter((c) => game.tokens[c] > 0).length;
  const validTake = pair
    ? game.tokens[selection[0] as keyof GameView['tokens']] >= 4
    : distinct && (selection.length === 3 || selection.length === Math.min(3, availableColors));

  const turnPlayer = game.players.find((p) => p.isTurn);
  const turnText = game.finished
    ? '对局结束'
    : game.phase === 'noble'
      ? game.pending?.playerId === myId
        ? '请选择贵族'
        : '贵族来访'
      : game.phase === 'discard'
        ? game.pending?.playerId === myId
          ? '请归还宝石'
          : '归还宝石中'
        : myTurn
          ? '你的回合'
          : `${turnPlayer?.name || ''} 行动中`;

  const send = () => {
    if (!text.trim()) return;
    sendChat(text);
    setText('');
  };

  return (
    <div className="game-root is-mobile">
      <div className="m-shell">
        <header className="m-top">
          <button className="m-code" onClick={onCopyCode} title="复制房间号">
            {game.roomCode}
          </button>
          <span className="m-round">第 {game.round} 轮</span>
          <TurnTimer
            deadline={game.turnDeadline}
            seconds={game.turnSeconds}
            active={!game.finished && (game.turn === myId || game.pending?.playerId === myId)}
            compact
          />
          <span className={`m-turn ${myTurn ? 'is-you' : ''}`}>{turnText}</span>

          <div className="m-scores">
            {game.players.map((p) => (
              <button
                key={p.id}
                className={`m-score ${p.isTurn ? 'is-turn' : ''} ${p.id === myId ? 'is-you' : ''}`}
                onClick={() => setSheet('players')}
                aria-label={`${p.name} ${p.points} 声望`}
              >
                <Avatar name={p.name} skinKey={p.avatar} size={20} />
                <span className="num">{p.points}</span>
              </button>
            ))}
          </div>

          <div className="m-btns">
            <button className="m-btn" onClick={() => setSheet('log')} aria-label="战报">
              <Icon name="scroll" size={15} />
            </button>
            <button className="m-btn" onClick={() => setSheet('chat')} aria-label="聊天">
              <Icon name="chat" size={15} />
            </button>
            <button className="m-btn" onClick={() => setSheet('menu')} aria-label="更多">
              <Icon name="palette" size={15} />
            </button>
          </div>
        </header>

        <main className="m-board">
          <div className="m-nobles">
            {game.nobles.map((id) => {
              const noble = NOBLE_MAP.get(id);
              if (!noble) return null;
              const canPick = pendingNoble && (game.pending?.options || []).includes(id);
              return (
                <NobleTile
                  key={id}
                  noble={noble}
                  size="mobile"
                  highlight={pendingNoble && canPick}
                  selectable={canPick}
                  onClick={canPick ? () => onChooseNoble(id) : () => onInspectNoble(id)}
                />
              );
            })}
            {game.nobles.length === 0 && <span className="m-nobles-empty">贵族已全部效忠</span>}
          </div>

          <div className="m-tabs">
            {[3, 2, 1].map((t) => {
              const affordable = (game.board[String(t)] || []).some((id) => {
                const card = id ? CARD_MAP.get(id) : null;
                return card && me && myTurn && computePayment(card, me.bonuses, me.tokens).affordable;
              });
              return (
                <button
                  key={t}
                  className={`m-tab ${tier === t ? 'is-active' : ''}`}
                  onClick={() => setTier(t)}
                >
                  <span className="m-tab-roman">{tierRoman(t)}</span>
                  <span className="m-tab-label">{TIER_INFO[t].label}</span>
                  <span className="m-tab-deck">牌堆 {game.decks[String(t)] ?? 0}</span>
                  {affordable && <i className="m-tab-dot" />}
                </button>
              );
            })}
          </div>

          <div className="m-cards">
            {(game.board[String(tier)] || []).map((id, index) => {
              if (!id) return <div className="m-slot-empty" key={`e-${tier}-${index}`} />;
              const card = CARD_MAP.get(id);
              if (!card) return null;
              const pay = me ? computePayment(card, me.bonuses, me.tokens) : null;
              return (
                <CardView
                  key={id}
                  card={card}
                  size="mobile"
                  affordable={myTurn && Boolean(pay?.affordable)}
                  me={me}
                  onClick={() => onInspect(card, { kind: 'board', tier, index })}
                />
              );
            })}
            <button
              className={`m-deck ${game.decks[String(tier)] === 0 ? 'is-empty' : ''}`}
              onClick={() => {
                if (!myTurn || game.decks[String(tier)] === 0) return;
                sfx('click');
                onInspect(
                  { id: `deck-${tier}`, tier: tier as 1 | 2 | 3, bonus: 'w', points: 0, art: '', name: '', cost: { w: 0, b: 0, g: 0, r: 0, k: 0 } },
                  { kind: 'deck', tier },
                );
              }}
              disabled={!myTurn || game.decks[String(tier)] === 0}
              aria-label={`${TIER_INFO[tier].label}牌堆，剩余 ${game.decks[String(tier)] ?? 0}`}
            >
              <CardBack label="" />
              <span className="m-deck-count">{game.decks[String(tier)] ?? 0}</span>
            </button>
          </div>
        </main>

        <footer className="m-foot">
          <div className="m-wallet">
            <Avatar name={me?.name || '?'} skinKey={me?.avatar || 'w1'} size={26} glow={myTurn} />
            <span className="m-points">{me?.points ?? 0}</span>
            {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => (
              <span className={`m-pill ${(me?.tokens[c] || 0) === 0 ? 'is-zero' : ''}`} key={c} title={GEM[c].name}>
                <Gem color={c} size={12} variant="faceted" />
                <span className="num">{me?.tokens[c] || 0}</span>
              </span>
            ))}
            <span className="m-sep" />
            {COLORS.map((c) => (
              <span className={`m-pill is-bonus ${(me?.bonuses[c] || 0) === 0 ? 'is-zero' : ''}`} key={c} title={`${GEM[c].name}加成`}>
                <Gem color={c} size={11} variant="faceted" />
                <span className="num">{me?.bonuses[c] || 0}</span>
              </span>
            ))}
            {(me?.reserved.length || 0) > 0 && (
              <>
                <span className="m-sep" />
                {me!.reserved.map((id) => {
                  const card = CARD_MAP.get(id);
                  return card ? (
                    <div key={id} className="m-reserved" title={cardName(card, skins.art)}>
                      <CardView
                        card={card}
                        size="micro"
                        hideName
                        me={me}
                        onClick={() => onInspect(card, { kind: 'reserved', cardId: id })}
                      />
                    </div>
                  ) : null;
                })}
              </>
            )}
          </div>

          <div className="m-bank">
            {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => {
              const count = game.tokens[c];
              const picked = selection.filter((x) => x === c).length;
              const isGold = c === 'gold';
              return (
                <button
                  key={c}
                  className={`m-token ${count === 0 ? 'is-empty' : ''} ${picked ? 'is-selected' : ''}`}
                  onClick={() => myTurn && !isGold && count > 0 && onToggleGem(c)}
                  disabled={!myTurn || isGold || count === 0}
                  aria-label={`${GEM[c].name} ${count}`}
                >
                  <Gem color={c} size={22} variant="faceted" />
                  {picked > 0 && <span className="m-picked">{picked}</span>}
                  <span className="m-count">{count}</span>
                </button>
              );
            })}
            {selection.length > 0 ? (
              <div className="m-take">
                <button className="m-mini" onClick={onClearGems} aria-label="取消选择">
                  <Icon name="close" size={13} />
                </button>
                <button className="m-take-btn" disabled={!validTake} onClick={onTakeGems}>
                  拿取 {selection.length}
                </button>
              </div>
            ) : (
              <span className="m-hint">
                {myTurn ? '选宝石或点卡牌' : turnText}
              </span>
            )}
          </div>
        </footer>
      </div>

      {sheet && (
        <div className="m-sheet-backdrop" onClick={() => setSheet(null)}>
          <div className="m-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="m-sheet-head">
              <span>
                {sheet === 'log' ? '战报' : sheet === 'chat' ? '商人闲谈' : sheet === 'players' ? '玩家' : '更多'}
              </span>
              <button className="m-btn" onClick={() => setSheet(null)} aria-label="关闭">
                <Icon name="close" size={15} />
              </button>
            </div>

            {sheet === 'log' && (
              <div className="m-sheet-body" ref={logRef}>
                {game.log.map((entry) => (
                  <div className={`log-entry kind-${entry.kind}`} key={entry.id}>
                    <span className="le-mark">◆</span>
                    <span>{localizeCardText(entry.text, skins.art)}</span>
                  </div>
                ))}
              </div>
            )}

            {sheet === 'players' && (
              <div className="m-sheet-body m-player-list">
                {game.players.map((p) => (
                  <div className={`m-player ${p.isTurn ? 'is-turn' : ''}`} key={p.id}>
                    <Avatar name={p.name} skinKey={p.avatar} size={34} glow={p.isTurn} />
                    <div className="m-player-info">
                      <div className="m-player-name">
                        {p.name}
                        {p.id === myId && <span className="tag">你</span>}
                        {p.isBot && <span className="tag bot">电脑</span>}
                      </div>
                      <div className="m-player-stats">
                        {COLORS.filter((c) => (p.bonuses[c] || 0) > 0).map((c) => (
                          <span className="m-pill is-bonus" key={c}>
                            <Gem color={c} size={10} variant="faceted" />
                            <span className="num">{p.bonuses[c]}</span>
                          </span>
                        ))}
                        {(['w', 'b', 'g', 'r', 'k', 'gold'] as const)
                          .filter((c) => (p.tokens[c] || 0) > 0)
                          .map((c) => (
                            <span className="m-pill" key={`t-${c}`}>
                              <Gem color={c} size={10} variant="faceted" />
                              <span className="num">{p.tokens[c]}</span>
                            </span>
                          ))}
                        <span className="m-player-meta">
                          {p.cardCount} 卡 · {p.nobles.length} 贵族 · {p.reservedCount} 保留
                        </span>
                      </div>
                    </div>
                    <span className="m-player-score">{p.points}</span>
                  </div>
                ))}
              </div>
            )}

            {sheet === 'chat' && (
              <>
                <div className="m-sheet-body" ref={chatRef}>
                  {chat.length === 0 && <div className="rooms-empty">安静得只剩宝石碰撞声。</div>}
                  {chat.map((c) => (
                    <div className={`chat-entry ${c.playerId === myId ? 'is-you' : ''}`} key={c.id}>
                      <span className="ce-name">{c.name}</span>
                      {c.text}
                    </div>
                  ))}
                </div>
                <div className="chat-input-row">
                  <input
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    maxLength={200}
                    placeholder="说点什么…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') send();
                    }}
                  />
                  <button className="chat-send" onClick={send} disabled={!text.trim()} aria-label="发送">
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </>
            )}

            {sheet === 'menu' && (
              <div className="m-sheet-body m-menu">
                <button
                  className="m-menu-item"
                  onClick={() => {
                    setSheet(null);
                    openCollection(true);
                  }}
                >
                  <Icon name="collection" size={16} /> 宝石图鉴
                </button>
                <button
                  className="m-menu-item"
                  onClick={() => {
                    setSheet(null);
                    openRules(true);
                  }}
                >
                  <Icon name="book" size={16} /> 游戏规则
                </button>
                <button
                  className="m-menu-item"
                  onClick={() => {
                    setSheet(null);
                    openSkins(true);
                  }}
                >
                  <Icon name="palette" size={16} /> 皮肤工坊
                </button>
                <button className="m-menu-item" onClick={() => setSheet('players')}>
                  <Icon name="users" size={16} /> 玩家详情
                </button>
                <button className="m-menu-item" onClick={toggleMusic}>
                  <Icon name="music" size={16} /> {musicOn ? '关闭酒馆音乐' : '开启酒馆音乐'}
                </button>
                <button className="m-menu-item" onClick={toggleVoice}>
                  <Icon name={voiceOn ? 'mic' : 'mute'} size={16} /> {voiceOn ? '关闭角色语音' : '开启角色语音'}
                </button>
                <button className="m-menu-item" onClick={toggleSfx}>
                  <Icon name={sfxOn ? 'sound' : 'mute'} size={16} /> {sfxOn ? '关闭音效' : '开启音效'}
                </button>
                <div className="m-menu-note">当前卡面：{skins.art === 'glass' ? '彩窗圣殿' : skins.art === 'anime' ? '星轨绘旅' : '传奇油画'}</div>
              </div>
            )}
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
