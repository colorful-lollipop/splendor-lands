import { useEffect, useMemo, useState } from 'react';
import { createRoom, joinRoom, openCollection, openRules, openSkins, requestRooms, toggleMusic, toggleSfx, toggleVoice, updateName, useStore } from '../store';
import { CARD_MAP, CARDS, NOBLES, NOBLE_MAP, SKIN_OPTIONS, cardName } from '../lib/meta';
import type { CardData } from '../lib/types';
import { CardView } from './CardView';
import { NobleTile } from './CardView';
import { Gem } from './Gem';
import { Icon, PatternDivider } from './Ornaments';
import { Avatar } from './Avatar';
import { Modal } from './modals/Modal';
import { sfx } from '../lib/sfx';

export function Landing() {
  const name = useStore((s) => s.name);
  const skins = useStore((s) => s.skins);
  const sfxOn = useStore((s) => s.sfxOn);
  const musicOn = useStore((s) => s.musicOn);
  const voiceOn = useStore((s) => s.voiceOn);
  const rooms = useStore((s) => s.rooms);
  const stats = useStore((s) => s.stats);
  const status = useStore((s) => s.status);
  const pending = useStore((s) => s.pending);

  const [code, setCode] = useState('');
  const [showcase, setShowcase] = useState<CardData | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const room = params.get('room');
    if (room) setCode(room.toUpperCase().slice(0, 4));
    requestRooms();
    const t = window.setInterval(requestRooms, 12000);
    return () => window.clearInterval(t);
  }, []);

  // 每次进入首页随机抽 3 张不同颜色的卡 + 1 位贵族 + 1 颗宝石，展示卡面特色
  const heroCards = useMemo(() => {
    const byColor = new Map<string, string[]>();
    for (const c of CARDS) {
      const list = byColor.get(c.bonus) || [];
      list.push(c.id);
      byColor.set(c.bonus, list);
    }
    const colors = [...byColor.keys()].sort(() => Math.random() - 0.5).slice(0, 3);
    return colors
      .map((color) => {
        const ids = byColor.get(color)!;
        return CARD_MAP.get(ids[Math.floor(Math.random() * ids.length)]);
      })
      .filter(Boolean);
  }, []);
  const heroNoble = useMemo(() => {
    const pick = NOBLES[Math.floor(Math.random() * NOBLES.length)];
    return pick ? NOBLE_MAP.get(pick.id) : null;
  }, []);
  const heroGem = useMemo(() => ['r', 'b', 'g', 'w', 'k'][Math.floor(Math.random() * 5)], []);

  const dust = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: `${(i * 61) % 100}%`,
        size: 2 + ((i * 7) % 4),
        delay: `${(i * 1.7) % 14}s`,
        duration: `${12 + ((i * 5) % 9)}s`,
        color: ['#e8c06a', '#7aa9e0', '#69c08a', '#d06a6a', '#b49ad0'][i % 5],
      })),
    [],
  );

  return (
    <div className="landing">
      <div className="landing-bg" />
      <div className="gem-dust" aria-hidden="true">
        {dust.map((d, i) => (
          <span
            key={i}
            style={{
              left: d.left,
              bottom: '-10px',
              width: d.size,
              height: d.size,
              background: d.color,
              boxShadow: `0 0 8px ${d.color}`,
              animationDelay: d.delay,
              animationDuration: d.duration,
            }}
          />
        ))}
      </div>

      <nav className="landing-nav">
        <div className="brand">
          <span className="brand-mark">
            <Gem color="r" size={20} variant="faceted" />
          </span>
          <span className="brand-title">
            璀璨宝石
            <small>SPLENDOR</small>
          </span>
        </div>
        <div className="topbar-actions">
          <button className="icon-btn" onClick={() => openCollection(true)} title="宝石图鉴" aria-label="宝石图鉴">
            <Icon name="collection" size={18} />
          </button>
          <button className="icon-btn" onClick={() => openRules(true)} title="游戏规则" aria-label="游戏规则">
            <Icon name="book" size={18} />
          </button>
          <button className="icon-btn" onClick={() => openSkins(true)} title="皮肤工坊" aria-label="皮肤工坊">
            <Icon name="palette" size={18} />
          </button>
          <button className={`icon-btn ${sfxOn ? '' : 'is-muted'}`} onClick={toggleSfx} title={sfxOn ? '音效已开启' : '音效已关闭'} aria-label="音效开关">
            <Icon name={sfxOn ? 'sound' : 'mute'} size={18} />
          </button>
          <button className={`icon-btn ${musicOn ? '' : 'is-muted'}`} onClick={toggleMusic} title={musicOn ? '酒馆音乐已开启' : '酒馆音乐已关闭'} aria-label="音乐开关">
            <Icon name="music" size={18} />
          </button>
          <button className={`icon-btn ${voiceOn ? '' : 'is-muted'}`} onClick={toggleVoice} title={voiceOn ? '角色语音已开启' : '角色语音已关闭'} aria-label="语音开关">
            <Icon name={voiceOn ? 'mic' : 'mute'} size={18} />
          </button>
        </div>
      </nav>

      <main className="landing-main">
        <section className="hero">
          <div className="hero-eyebrow">ART OF GEMS &amp; NOBLES</div>
          <h1 className="hero-title">
            <span className="hero-title-cn">璀璨宝石</span>
            <span className="hero-title-en">SPLENDOR</span>
          </h1>
          <p className="hero-tagline">
            文艺复兴的黎明，宝石商队穿行于地中海沿岸。
            收集钻石、蓝宝石、祖母绿、红宝石与黑曜石，
            购入矿脉与商馆，赢得君王与贵族的青睐，
            成为全欧洲最耀眼的珠宝巨商。
          </p>
          <div className="hero-features">
            <span className="hero-feature">
              <Icon name="users" size={13} /> 2–4 人在线联机
            </span>
            <span className="hero-feature">
              <Icon name="gem" size={13} /> 90 张原画卡牌
            </span>
            <span className="hero-feature">
              <Icon name="sparkle" size={13} /> 可更换卡面 / 宝石皮肤
            </span>
          </div>

          <div className="hero-cards">
            <div className="hero-gem">
              <Gem color={heroGem as 'r' | 'b' | 'g' | 'w' | 'k'} size={46} variant="faceted" glow />
            </div>
            {heroCards.map((card) => (
              <div className="hero-card" key={card!.id}>
                <CardView
                  card={card!}
                  size="board"
                  hideName={false}
                  onClick={() => {
                    sfx('click');
                    setShowcase(card!);
                  }}
                />
              </div>
            ))}
            {heroNoble && (
              <div className="hero-noble">
                <NobleTile noble={heroNoble} />
              </div>
            )}
          </div>
          <p className="hero-caption">
            当前画风 · {SKIN_OPTIONS.art.find((option) => option.id === skins.art)?.name} · 点击卡牌欣赏大图
          </p>
        </section>

        <section className="entry-panel" aria-label="进入游戏">
          <div className="entry-title">入席</div>
          <div className="entry-sub">STEP INTO THE MERCHANT'S HALL</div>

          <div className="form-row">
            <label className="form-label" htmlFor="player-name">
              <span>你的名字</span>
              <span style={{ opacity: 0.6 }}>{name.length}/16</span>
            </label>
            <div className="field" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Avatar name={name || '?'} skinKey={skins.avatar} size={42} />
              <input
                id="player-name"
                value={name}
                maxLength={16}
                onChange={(e) => updateName(e.target.value)}
                placeholder="一位神秘的宝石商人"
                autoComplete="nickname"
              />
            </div>
          </div>

          <button
            className="btn"
            style={{ width: '100%', height: 44 }}
            onClick={() => {
              sfx('click');
              createRoom();
            }}
            disabled={pending || !name.trim() || status !== 'open'}
          >
            <Icon name="sparkle" size={16} /> 创建房间
          </button>
          <p className="create-hint">房间可容纳 2–4 人，人齐后由房主开始</p>

          <div className="entry-divider">或加入现有房间</div>

          <div className="join-row">
            <div className="field">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 4))}
                placeholder="房间号"
                maxLength={4}
                aria-label="房间号"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    sfx('click');
                    joinRoom(code);
                  }
                }}
              />
            </div>
            <button
              className="btn btn-ghost"
              style={{ height: 44, padding: '0 22px' }}
              onClick={() => {
                sfx('click');
                joinRoom(code);
              }}
              disabled={pending || code.length !== 4 || !name.trim() || status !== 'open'}
            >
              加入
            </button>
          </div>

          <div className="rooms-block">
            <div className="rooms-head">
              <span className="rh-title">公开房间</span>
              <span className="rh-count">{rooms.length ? `${rooms.length} 个等待中` : '暂无'}</span>
            </div>
            <div className="rooms-list">
              {rooms.length === 0 && <div className="rooms-empty">还没有公开房间，创建一间，邀请好友入席吧。</div>}
              {rooms.map((r) => (
                <button
                  key={r.code}
                  className="room-row"
                  onClick={() => {
                    sfx('click');
                    joinRoom(r.code);
                  }}
                  disabled={pending}
                >
                  <span className="rr-code">{r.code}</span>
                  <span className="rr-host">{r.host} 的房间</span>
                  <span className="rr-count">
                    {r.players}/{r.maxPlayers}
                  </span>
                  <Icon name="arrow" size={13} />
                </button>
              ))}
            </div>
          </div>

          <div className="entry-footer">
            <span className={`online-dot ${status === 'open' ? '' : 'is-off'}`}>
              <i /> {status === 'open' ? '服务器在线' : status === 'connecting' ? '正在连接服务器' : '连接中断'}
            </span>
            <span>{stats ? `${stats.players} 位商人在线 · ${stats.playing} 局进行中` : '宝石与荣耀在此汇聚'}</span>
          </div>

          <PatternDivider />
          <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--dim)', marginTop: 10, letterSpacing: '0.06em' }}>
            与好友分享房间号即可加入 · 支持断线重连
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>© 璀璨宝石 · 基于 Splendor 桌游规则的粉丝作品</span>
        <span>卡面艺术由 AI 绘制 · 所有皮肤均可自由切换</span>
      </footer>

      {showcase && (
        <Modal
          title={cardName(showcase, skins.art)}
          subtitle={`${SKIN_OPTIONS.art.find((option) => option.id === skins.art)?.name} · ${['', '一级', '二级', '三级'][showcase.tier]} · ${showcase.points} 点声望`}
          onClose={() => setShowcase(null)}
          width={560}
        >
          <div className="art-lightbox">
            <CardView card={showcase} size="large" />
          </div>
          <p className="art-lightbox-note">在皮肤工坊切换画风，同一张卡会拥有不同的名字与卡框。</p>
        </Modal>
      )}
    </div>
  );
}