import { useEffect, useMemo, useRef, useState } from 'react';
import {
  leaveRoom,
  notify,
  openCollection,
  openRules,
  openSkins,
  sendAction,
  sendChat,
  toggleMusic,
  toggleSfx,
  toggleVoice,
  useStore,
} from '../store';
import type { CardData, Color, GameView, PlayerView } from '../lib/types';
import { COLORS, GEM, NOBLE_MAP, CARD_MAP, cardName } from '../lib/meta';
import { localizeCardText } from '../lib/cardNames';
import { BoardSurface, BankBar } from './game/Board';
import { PlayerRail } from './game/PlayerCard';
import { CardView, NobleTile } from './CardView';
import { Gem } from './Gem';
import { Avatar } from './Avatar';
import { Icon, PatternDivider } from './Ornaments';
import { CardDetailModal, NobleDetailModal, type InspectSource } from './modals/CardDetailModal';
import { DiscardModal, NobleChoiceModal } from './modals/GameModals';
import { MobileGame } from './mobile/MobileGame';
import { sfx } from '../lib/sfx';
import { flashAt, flyGems } from '../lib/fx';
import { speak } from '../lib/voice';
import { copyText } from '../lib/clipboard';

const DESIGN_W = 1520;
const DESIGN_H = 960;

export function GameScreen() {
  const game = useStore((s) => s.game)!;
  const skins = useStore((s) => s.skins);
  const sfxOn = useStore((s) => s.sfxOn);
  const musicOn = useStore((s) => s.musicOn);
  const voiceOn = useStore((s) => s.voiceOn);
  const selfId = useStore((s) => s.selfId);
  const room = useStore((s) => s.room);
  const chat = useStore((s) => s.chat);

  const me = useMemo(() => game.players.find((p) => p.id === (selfId || game.me?.id)) || null, [game, selfId]);
  const myId = me?.id || null;
  const isHost = game.hostId === myId;  const [scale, setScale] = useState(1);
  const [stage, setStage] = useState({ w: DESIGN_W, h: DESIGN_H });
  const [selection, setSelection] = useState<Color[]>([]);
  const [inspect, setInspect] = useState<{ card: CardData; source: InspectSource } | null>(null);
  const [inspectNoble, setInspectNoble] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ id: number; title: string; sub: string } | null>(null);
  const [chatText, setChatText] = useState('');
  const [showLog, setShowLog] = useState(true);
  const [layout, setLayout] = useState<'desktop' | 'mobile' | 'portrait'>('desktop');
  const prevTurn = useRef<string | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      // 等比缩放取较小值，同时把舞台拉伸到铺满视口，避免左右黑边
      const s = Math.max(0.32, Math.min(1.35, Math.min(w / DESIGN_W, h / DESIGN_H)));
      setScale(s);
      setStage({ w: Math.max(DESIGN_W, w / s), h: Math.max(DESIGN_H, h / s) });
      if (w < 920 || h < 560) {
        setLayout(w < h ? 'portrait' : 'mobile');
      } else {
        setLayout('desktop');
      }
    };
    onResize();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  useEffect(() => {
    setSelection([]);
  }, [game.turn, game.turnCount, game.phase]);

  useEffect(() => {
    if (prevTurn.current !== game.turn) {
      prevTurn.current = game.turn;
      if (game.turn === myId && !game.finished) {
        setBanner({ id: Date.now(), title: '你的回合', sub: 'YOUR TURN · 选择一项行动' });
        sfx('turn');
        speak('turn', { speaker: me ? { name: me.name, avatar: me.avatar } : undefined });
        window.setTimeout(() => setBanner(null), 2200);
      }
    }
  }, [game.turn, myId, game.finished]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [game.log]);

  // 声望 / 贵族到访的飘字反馈
  const prevStats = useRef<{ points: number; nobles: number } | null>(null);
  useEffect(() => {
    const meNow = game.players.find((p) => p.id === myId);
    if (!meNow) return;
    const prev = prevStats.current;
    if (prev) {
      if (meNow.points > prev.points) {
        flashAt(document.querySelector('.self-score') as HTMLElement | null, `+${meNow.points - prev.points} 声望`);
      }
      if (meNow.nobles.length > prev.nobles) {
        flashAt(document.querySelector('.nobles-strip') as HTMLElement | null, '贵族来访 +3 声望');
        sfx('noble');
        const newest = meNow.nobles[meNow.nobles.length - 1];
        speak('noble', { nobleId: newest, detail: newest });
      }
    }
    prevStats.current = { points: meNow.points, nobles: meNow.nobles.length };
  }, [game.players, myId]);

  // 对手 / 电脑行动时也用他们的声音念台词
  const prevAction = useRef<number>(0);
  useEffect(() => {
    const act = game.lastAction;
    if (!act || act.at === prevAction.current) return;
    prevAction.current = act.at;
    if (!act.playerId || act.playerId === myId) return;
    const actor = game.players.find((p) => p.id === act.playerId);
    if (!actor) return;
    const kind = act.text.includes('预订') ? 'reserve' : act.text.includes('购入') ? 'buy' : act.text.includes('拿取') ? 'take' : null;
    if (!kind) return;
    speak(kind, {
      speaker: { name: actor.name, avatar: actor.avatar },
      detail: kind === 'buy' ? localizeCardText(act.text.replace(/^.*?购入了「/, '').replace(/」.*$/, ''), skins.art) : undefined,
    });
  }, [game.lastAction, game.players, myId, skins.art]);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chat]);

  const pendingNoble = game.phase === 'noble' && game.pending?.playerId === myId;
  const pendingDiscard = game.phase === 'discard' && game.pending?.playerId === myId;

  const turnPlayer = game.players.find((p) => p.id === game.turn);

  const toggleGem = (raw: string) => {
    const color = raw as Color;
    if (!game.canAct || game.phase !== 'action') return;
    setSelection((prev) => {
      if (prev.length === 1 && prev[0] === color) {
        if (game.tokens[color] < 4) {
          notify('该颜色不足 4 枚，不能拿取两枚同色宝石', 'error');
          return prev;
        }
        return [color, color];
      }
      if (prev.includes(color)) return prev.filter((c) => c !== color);
      if (prev.length >= 3) {
        notify('一次最多拿取 3 枚宝石', 'info');
        return prev;
      }
      if (prev.length === 2 && prev[0] === prev[1]) {
        return [color];
      }
      return [...prev, color];
    });
    sfx('gem');
  };

  const takeGems = () => {
    if (!selection.length) return;
    sfx('gem');
    const sources = selection
      .map((c) => document.querySelector(`.bank-token[data-color="${c}"]`) as HTMLElement | null)
      .filter((el): el is HTMLElement => Boolean(el));
    const target = document.querySelector('.self-bar .wallet-row') as HTMLElement | null;
    flyGems(sources, target);
    speak('take', { speaker: me ? { name: me.name, avatar: me.avatar } : undefined });
    sendAction({ type: 'take', colors: selection });
    setSelection([]);
  };

  const onInspect = (card: CardData, source: InspectSource) => {
    if (source.kind === 'deck') {
      setInspect({ card, source });
      return;
    }
    setInspect({ card, source });
  };

  const copyCode = async () => {
    if (await copyText(game.roomCode)) notify('房间号已复制', 'success');
    else notify('复制失败，请手动选择复制', 'error');
  };

  const doChooseNoble = (id: string) => {
    sendAction({ type: 'chooseNoble', nobleId: id });
  };

  const waitLabel = game.finished
    ? '对局已经结束'
    : game.phase === 'noble'
      ? '正在迎接贵族'
      : game.phase === 'discard'
        ? '正在归还宝石'
        : turnPlayer
          ? `等待 ${turnPlayer.name} 行动`
          : '';

  const overlays = (
    <>
      {layout === 'desktop' && banner && (
        <div className="turn-banner" key={banner.id}>
          <div className="tb-inner">
            <div className="tb-line">{banner.title}</div>
            <div className="tb-sub">{banner.sub}</div>
          </div>
        </div>
      )}

      {inspect && me && (
        <CardDetailModal
          card={inspect.card}
          source={inspect.source}
          game={game}
          me={me}
          onClose={() => setInspect(null)}
        />
      )}

      {inspectNoble && (
        <NobleDetailModal
          noble={NOBLE_MAP.get(inspectNoble)!}
          game={game}
          me={me}
          onClose={() => setInspectNoble(null)}
        />
      )}

      {pendingNoble && <NobleChoiceModal game={game} onChoose={doChooseNoble} />}
      {pendingDiscard && me && <DiscardModal game={game} me={me} />}
    </>
  );

  if (layout === 'portrait') {
    return (
      <div className="game-root">
        <div className="rotate-hint">
          <div className="rh-inner">
            <span className="rh-icon">
              <Icon name="rotate" size={44} />
            </span>
            <h2>请旋转至横屏</h2>
            <p>宝石牌桌需要横向空间。旋转手机后即可开始交易。</p>
          </div>
        </div>
        {overlays}
      </div>
    );
  }

  if (layout === 'mobile') {
    return (
      <MobileGame
        game={game}
        me={me}
        myId={myId}
        selection={selection}
        onToggleGem={toggleGem}
        onClearGems={() => setSelection([])}
        onTakeGems={takeGems}
        onInspect={onInspect}
        onInspectNoble={(id) => setInspectNoble(id)}
        pendingNoble={pendingNoble}
        onChooseNoble={doChooseNoble}
        onCopyCode={copyCode}
      >
        {overlays}
      </MobileGame>
    );
  }

  return (
    <div className="game-root">
      <div
        className="game-scale-wrap"
        style={{ width: stage.w, height: stage.h, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="game-shell">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark">
                <Gem color="r" size={20} variant="faceted" />
              </span>
              <span className="brand-title">
                璀璨宝石
                <small>SPLENDOR</small>
              </span>
            </div>

            <div className="topbar-center">
              <button className="room-code" onClick={copyCode} title="点击复制房间号">
                {game.roomCode}
                <span className="tiny">房间</span>
                <Icon name="copy" size={12} />
              </button>
              <span className="round-pill">
                <span>第 <b>{game.round}</b> 轮</span>
                <span className="dot" />
                <span>
                  {game.phase === 'action'
                    ? game.turn === myId
                      ? '你的回合'
                      : waitLabel
                    : game.phase === 'noble'
                      ? '贵族来访'
                      : game.phase === 'discard'
                        ? '宝石超载'
                        : '结算中'}
                </span>
              </span>
              {game.endTriggered && !game.finished && (
                <span className="round-pill" style={{ color: '#ffcc8a' }}>
                  <Icon name="crown" size={13} /> 最后一轮
                </span>
              )}
              {!isHost && <span className="chip">房主 {game.players.find((p) => p.isHost)?.name || '—'}</span>}
            </div>

            <div className="topbar-actions">
              <button className={`icon-btn ${showLog ? 'is-active' : ''}`} onClick={() => setShowLog((v) => !v)} title="战报">
                <Icon name="scroll" size={17} />
              </button>
              <button className="icon-btn" onClick={() => openCollection(true)} title="宝石图鉴" aria-label="宝石图鉴">
                <Icon name="collection" size={17} />
              </button>
              <button className="icon-btn" onClick={() => openRules(true)} title="规则">
                <Icon name="book" size={17} />
              </button>
              <button className="icon-btn" onClick={() => openSkins(true)} title="皮肤工坊">
                <Icon name="palette" size={17} />
              </button>
              <button className={`icon-btn ${sfxOn ? '' : 'is-muted'}`} onClick={toggleSfx} title="音效">
                <Icon name={sfxOn ? 'sound' : 'mute'} size={17} />
              </button>
              <button className={`icon-btn ${musicOn ? '' : 'is-muted'}`} onClick={toggleMusic} title="音乐">
                <Icon name="music" size={17} />
              </button>
              <button className={`icon-btn ${voiceOn ? '' : 'is-muted'}`} onClick={toggleVoice} title="角色语音">
                <Icon name={voiceOn ? 'mic' : 'mute'} size={17} />
              </button>
              <button
                className="icon-btn"
                onClick={() => {
                  if (window.confirm('确定要离开房间吗？游戏中的座位将由电脑接管。')) leaveRoom();
                }}
                title="离开"
              >
                <Icon name="leave" size={17} />
              </button>
            </div>
          </header>

          <div className="game-body">
            <aside className="rail-left">
              <div className="panel room-info-card">
                <div>
                  <div className="ri-code">{game.roomCode}</div>
                  <div className="ri-meta">
                    <span>
                      {game.players.length} 位商人 · <b>{game.endTriggered ? '最后一轮' : `第 ${game.round} 轮`}</b>
                    </span>
                    <span>{game.endTriggered ? '冲刺激动人心' : '先达到 15 声望者胜'}</span>
                  </div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div className="label">牌库</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
                    {[1, 2, 3].map((t) => (
                      <span key={t}>
                        {t}级 <b style={{ color: 'var(--gold-2)' }}>{game.decks[String(t)]}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <PlayerRail game={game} selfId={myId} />

              <div className="rail-tip panel-inset">
                <div className="rt-title">
                  <Icon name="target" size={12} /> 胜利条件
                </div>
                <div className="rt-text">
                  率先达到 <b>15 声望</b> 并坚持到本轮结束。每位贵族额外提供 <b>3 点声望</b>。
                </div>
              </div>

              <div className="rail-footnote">
                <Icon name="sparkle" size={12} /> 点击卡牌查看成本与操作
              </div>
            </aside>

            <main className="board-area">
              <BoardSurface
                game={game}
                me={me}
                onInspect={onInspect}
                onInspectNoble={(id) => setInspectNoble(id)}
                pendingNoble={pendingNoble}
                onChooseNoble={doChooseNoble}
              />

              <BankBar
                game={game}
                selection={selection}
                onToggle={toggleGem}
                onClear={() => setSelection([])}
                onTake={takeGems}
              />

              <SelfBar
                game={game}
                me={me}
                selfId={myId}
                onInspect={(card, cardId) => setInspect({ card, source: { kind: 'reserved', cardId } })}
                onClear={() => setSelection([])}
                selected={selection}
                onTake={takeGems}
              />
            </main>

            <aside className="rail-right">
              {showLog && (
                <div className="side-panel log-panel">
                  <div className="panel-head">
                    <span className="ph-title">
                      <Icon name="scroll" size={13} /> 战报
                    </span>
                    <span className="ph-meta">最近 {Math.min(60, game.log.length)} 条</span>
                  </div>
                  <div className="log-list" ref={logRef}>
                    {game.log.map((entry) => (
                      <div className={`log-entry kind-${entry.kind}`} key={entry.id}>
                        <span className="le-mark">◆</span>
                        <span>{localizeCardText(entry.text, skins.art)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="side-panel" style={{ flex: showLog ? 1 : 2 }}>
                <div className="panel-head">
                  <span className="ph-title">
                    <Icon name="chat" size={13} /> 商人闲谈
                  </span>
                  <span className="ph-meta">{chat.length}</span>
                </div>
                <div className="chat-list" ref={chatRef}>
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
                    value={chatText}
                    onChange={(e) => setChatText(e.target.value)}
                    maxLength={200}
                    placeholder="说点什么…"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        sendChat(chatText);
                        setChatText('');
                      }
                    }}
                  />
                  <button
                    className="chat-send"
                    onClick={() => {
                      sendChat(chatText);
                      setChatText('');
                    }}
                    disabled={!chatText.trim()}
                    aria-label="发送"
                  >
                    <Icon name="arrow" size={14} />
                  </button>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {overlays}
    </div>
  );
}

function SelfBar({
  game,
  me,
  selfId,
  onInspect,
  onClear,
  selected,
  onTake,
}: {
  game: GameView;
  me: PlayerView | null;
  selfId: string | null;
  onInspect: (card: CardData, cardId: string) => void;
  onClear: () => void;
  selected: string[];
  onTake: () => void;
}) {
  const artSkin = useStore((s) => s.skins.art);
  if (!me) return null;
  const isTurn = game.turn === selfId;
  const myTurn = isTurn && game.phase === 'action';
  const pair = selected.length === 2 && selected[0] === selected[1];
  const distinct = new Set(selected).size === selected.length && selected.length > 0;
  const availableColors = COLORS.filter((c) => game.tokens[c] > 0).length;
  const validTake = pair ? game.tokens[selected[0] as keyof GameView['tokens']] >= 4 : distinct && (selected.length === 3 || selected.length === Math.min(3, availableColors));

  const hint = game.finished ? (
    '对局已结束'
  ) : game.phase === 'noble' ? (
    game.pending?.playerId === selfId ? '请选择一位贵族' : '贵族正在造访…'
  ) : game.phase === 'discard' ? (
    game.pending?.playerId === selfId ? '请归还多余的宝石' : '等待归还宝石…'
  ) : myTurn ? (
    '轮到你行动 · 点击卡牌或选择宝石'
  ) : (
    <>等待 <b>{game.players.find((p) => p.isTurn)?.name}</b> 行动…</>
  );

  return (
    <div className="self-bar">
      <div className="self-avatar-wrap">
        <Avatar name={me.name} skinKey={me.avatar} size={58} className="self-avatar" glow={isTurn} />
      </div>

      <div className="self-score">
        <div className="score-num">{me.points}</div>
        <div className="score-label">声望</div>
      </div>

      <div className="self-mid">
        <div className="self-name-row">
          <span className="self-name">{me.name}</span>
          {isTurn && <span className="tag turn">你的回合</span>}
          {me.isHost && <span className="tag">房主</span>}
        </div>
        <div className="wallet-row">
          <span className="row-label">宝石</span>
          {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => (
            <span className={`wallet-pill ${(me.tokens[c] || 0) === 0 ? 'is-zero' : ''}`} key={c} title={GEM[c].name}>
              <Gem color={c} size={13} variant="faceted" />
              <span className="num">{me.tokens[c] || 0}</span>
            </span>
          ))}
        </div>
        <div className="wallet-row">
          <span className="row-label">加成</span>
          {COLORS.map((c) => (
            <span className={`bonus-pill ${(me.bonuses[c] || 0) === 0 ? 'is-zero' : ''}`} key={c} title={`${GEM[c].name}加成`}>
              <Gem color={c} size={12} variant="faceted" />
              <span className="num">{me.bonuses[c] || 0}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="self-reserved">
        <span className="reserved-label">保留</span>
        {[0, 1, 2].map((i) => {
          const cardId = me.reserved[i];
          const card = cardId ? CARD_MAP.get(cardId) || null : null;
          return (
            <div className={`reserved-slot ${card ? 'has-card' : ''}`} key={i} title={card ? cardName(card, artSkin) : '空保留位'}>
              {card ? (
                <CardView card={card} size="mini" hideName me={me} onClick={() => onInspect(card, cardId!)} />
              ) : (
                <span>·</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="self-actions">
        <div className="action-hint">{hint}</div>
        <div className="action-buttons">
          {myTurn && selected.length > 0 ? (
            <>
              <button className="btn btn-sm btn-ghost" onClick={onClear}>
                取消
              </button>
              <button className="btn btn-sm" disabled={!validTake} onClick={onTake}>
                拿取 {selected.length} 枚
              </button>
            </>
          ) : (
            <span className="action-hint" style={{ textAlign: 'right', minHeight: 0 }}>
              {myTurn ? '点击银行宝石开始选择' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}