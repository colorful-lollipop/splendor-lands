import { useMemo, useState } from 'react';
import { addBot, leaveRoom, notify, removeBot, rematch, sendChat, setRoomPublic, setTurnSeconds, startGame, useStore, openRules, openSkins } from '../store';
import { Avatar } from './Avatar';
import { Icon, PatternDivider } from './Ornaments';
import { Gem } from './Gem';
import { sfx } from '../lib/sfx';
import { copyText } from '../lib/clipboard';

export function RoomScreen() {
  const room = useStore((s) => s.room);
  const chat = useStore((s) => s.chat);
  const selfId = useStore((s) => s.selfId);
  const skins = useStore((s) => s.skins);
  const [text, setText] = useState('');

  const isHost = room?.hostId === selfId;
  const seats = useMemo(() => {
    if (!room) return { list: [], empty: 0 };
    const list = [...room.players];
    const empty = Math.max(0, room.maxPlayers - list.length);
    return { list, empty };
  }, [room]);

  if (!room) return null;

  const shareLink = `${location.origin}${location.pathname}?room=${room.code}`;

  const copy = async (value: string, msg: string) => {
    if (await copyText(value)) notify(msg, 'success');
    else notify('复制失败，请手动选择复制', 'error');
  };

  return (
    <div className="room-screen">
      <div className="room-bg" />
      <div className="room-wrap">
        <header className="room-header">
          <div className="brand">
            <span className="brand-mark">
              <Gem color="r" size={20} variant="faceted" />
            </span>
            <span className="brand-title">
              璀璨宝石
              <small>SPLENDOR</small>
            </span>
          </div>

          <div className="room-code-block" onClick={() => copy(room.code, '房间号已复制')} title="点击复制房间号">
            <div>
              <div className="rc-label">房间号 · {room.isPublic ? '公开' : '私密'}</div>
              <div className="rc-code">{room.code}</div>
            </div>
            <div className="rc-copy">
              <Icon name="copy" size={14} /> 复制
            </div>
          </div>

          <div className="rh-actions">
            {isHost && room.status === 'lobby' ? (
              <button
                className={`btn btn-ghost btn-sm visibility-btn ${room.isPublic ? 'is-public' : ''}`}
                onClick={() => {
                  sfx('click');
                  setRoomPublic(!room.isPublic);
                }}
                title={room.isPublic ? '当前会出现在大厅公开房间列表，点击转为私密' : '默认私密，只有拿到房间号或邀请链接的人才能加入，点击公开'}
              >
                <Icon name={room.isPublic ? 'users' : 'lock'} size={14} />
                {room.isPublic ? '公开房间' : '私密房间'}
              </button>
            ) : (
              <span className={`room-visibility ${room.isPublic ? 'is-public' : ''}`}>
                <Icon name={room.isPublic ? 'users' : 'lock'} size={13} />
                {room.isPublic ? '公开房间' : '私密房间'}
              </span>
            )}
            <button className="btn btn-ghost btn-sm" onClick={() => copy(shareLink, '邀请链接已复制')}>
              <Icon name="copy" size={14} /> 复制邀请链接
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => openRules(true)}>
              <Icon name="book" size={14} /> 规则
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => leaveRoom()}>
              <Icon name="leave" size={14} /> 离开
            </button>
          </div>
        </header>

        <div className="room-main">
          <section className="seats-panel">
            <div className="seats-head">
              <div>
                <h2>商会议席</h2>
                <p>
                  {room.players.length}/{room.maxPlayers} 位商人已入席
                </p>
              </div>
              <div className="label">{room.status === 'playing' ? '游戏进行中' : '等待开始'}</div>
            </div>

            <div className="seats-grid">
              {seats.list.map((p) => (
                <div className={`seat ${p.isBot ? 'is-bot' : ''} is-filled`} key={p.id}>
                  <Avatar name={p.name} skinKey={p.avatar || 'w1'} size={52} className="seat-avatar" glow={p.id === selfId} />
                  <div className="seat-info">
                    <div className="seat-name">
                      {p.name}
                      {p.isHost && <span className="tag">房主</span>}
                      {p.id === selfId && <span className="tag">你</span>}
                      {p.isBot && <span className={`tag bot ${p.botLevel === 'hard' ? 'hard' : p.botLevel === 'easy' ? 'easy' : ''}`}>{p.botLevel === 'easy' ? '简单电脑' : p.botLevel === 'hard' ? '困难电脑' : '普通电脑'}</span>}
                    </div>
                    <div className="seat-meta">
                      {p.isBot ? '由房主添加' : p.connected ? '已连接' : '离线'}
                    </div>
                    <div className="seat-ready">{p.isBot ? '自动准备' : '准备就绪'}</div>
                  </div>
                  {isHost && p.isBot && room.status === 'lobby' && (
                    <div className="seat-actions">
                      <button className="icon-btn" style={{ width: 28, height: 28 }} onClick={() => removeBot(p.id)} title="移除电脑">
                        <Icon name="close" size={13} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {Array.from({ length: seats.empty }, (_, i) => (
                <div className="seat is-empty" key={`empty-${i}`}>
                  <span className="empty-plus">+</span>
                  <span>等待商人入席</span>
                </div>
              ))}
            </div>

            {isHost && (
              <div className="host-actions" style={{ marginTop: 18 }}>
                {room.status === 'lobby' && (
                  <div className="turn-setting">
                    <span className="turn-setting-label">
                      <Icon name="clock" size={12} /> 每回合限时
                    </span>
                    <div className="turn-setting-options">
                      {[30, 60, 90, 0].map((seconds) => (
                        <button
                          key={seconds}
                          className={room.turnSeconds === seconds ? 'is-active' : ''}
                          onClick={() => {
                            sfx('click');
                            setTurnSeconds(seconds);
                          }}
                        >
                          {seconds ? `${seconds}s` : '不限'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn"
                    style={{ flex: 1 }}
                    onClick={() => {
                      sfx('click');
                      startGame();
                    }}
                    disabled={room.players.length < 2}
                  >
                    <Icon name="sparkle" size={15} /> 开始游戏
                  </button>
                  {room.status === 'lobby' && (
                    <div className="bot-add-group">
                      <button className="btn btn-ghost" onClick={() => addBot('easy')} disabled={room.players.length >= room.maxPlayers} title="简单电脑：只看眼前，不会预订与规划">
                        <Icon name="plus" size={14} /> 简单
                      </button>
                      <button className="btn btn-ghost" onClick={() => addBot('normal')} disabled={room.players.length >= room.maxPlayers} title="普通电脑：会规划宝石与贵族">
                        <Icon name="plus" size={14} /> 普通
                      </button>
                      <button className="btn btn-ghost" onClick={() => addBot('hard')} disabled={room.players.length >= room.maxPlayers} title="困难电脑：优先抢高分卡，善于预订与卡位">
                        <Icon name="plus" size={14} /> 困难
                      </button>
                    </div>
                  )}
                </div>
                {room.players.length < 2 && (
                  <div style={{ fontSize: 10.5, color: 'var(--muted)', textAlign: 'center' }}>
                    至少需要 2 位商人才能开局 · 可添加电脑凑齐
                  </div>
                )}
              </div>
            )}

            {!isHost && (
              <div className="host-panel panel-inset" style={{ marginTop: 18 }}>
                <div className="hp-title">等待房主开始</div>
                <div className="hp-desc">
                  房主准备好后即可开局。你也可以把房间号
                  <b style={{ color: 'var(--gold-1)' }}> {room.code} </b>
                  发给好友，或直接分享邀请链接。
                </div>
              </div>
            )}

            <div className="room-tips">
              <span className="tip-chip">宝石随机牌库</span>
              <span className="tip-chip">自动补牌</span>
              <span className="tip-chip">支持断线重连</span>
              <span className="tip-chip">最多 4 人</span>
              <span className="tip-chip">
                <Icon name="clock" size={11} />
                {room.turnSeconds ? `每回合 ${room.turnSeconds} 秒` : '不限时'}
              </span>
              <span className="tip-chip">
                <Icon name={room.isPublic ? 'users' : 'lock'} size={11} />
                {room.isPublic ? '公开房间' : '私密房间'}
              </span>
            </div>
          </section>

          <div className="room-side">
            <div className="room-chat">
              <div className="panel-head">
                <span className="ph-title">
                  <Icon name="chat" size={13} /> 商人闲谈
                </span>
                <span className="ph-meta">{chat.length} 条</span>
              </div>
              <div className="chat-list">
                {chat.length === 0 && <div className="rooms-empty">还没有人发言，打个招呼吧。</div>}
                {chat.map((c) => (
                  <div className={`chat-entry ${c.playerId === selfId ? 'is-you' : ''}`} key={c.id}>
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
                    if (e.key === 'Enter') {
                      sendChat(text);
                      setText('');
                    }
                  }}
                />
                <button
                  className="chat-send"
                  onClick={() => {
                    sendChat(text);
                    setText('');
                  }}
                  disabled={!text.trim()}
                  aria-label="发送"
                >
                  <Icon name="arrow" size={14} />
                </button>
              </div>
            </div>

            <div className="panel host-panel">
              <div className="hp-title">皮肤工坊</div>
              <div className="hp-desc">
                当前牌背：<b style={{ color: 'var(--gold-2)' }}>{{ emerald: '翡翠龙纹', crimson: '赤炎龙纹', astral: '星界航图' }[skins.back]}</b>
                <br />
                当前头像：{skins.avatar.startsWith('noble-') ? '贵族肖像' : '宝石卡原画'}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => openSkins(true)}>
                <Icon name="palette" size={14} /> 更换外观
              </button>
              <PatternDivider />
              <div className="hp-desc" style={{ fontSize: 10 }}>
                游戏中的牌面、宝石、桌面与牌背都可随时切换，所有设置会保存在本机。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RematchButton() {
  return (
    <button className="btn" onClick={() => rematch()}>
      <Icon name="sparkle" size={15} /> 再来一局
    </button>
  );
}