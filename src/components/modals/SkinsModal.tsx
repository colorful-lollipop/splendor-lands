import { useState } from 'react';
import { ART_PRESETS, AVATAR_OPTIONS, CARDS, GEM, NOBLES, SKIN_OPTIONS, avatarArt, backArt, cardArt, cardName, nobleArt } from '../../lib/meta';
import { updateAvatar, updateSkins, useStore } from '../../store';
import { Modal } from './Modal';
import { Gem } from '../Gem';
import { CardView } from '../CardView';
import { Icon } from '../Ornaments';
import type { SkinSettings } from '../../lib/types';

type Tab = keyof typeof SKIN_OPTIONS | 'avatar';

const TABS: { id: Tab; label: string }[] = [
  { id: 'frame', label: '卡框主题' },
  { id: 'art', label: '卡面画风' },
  { id: 'gems', label: '宝石样式' },
  { id: 'back', label: '卡背' },
  { id: 'table', label: '桌面' },
  { id: 'noble', label: '贵族' },
  { id: 'avatar', label: '头像' },
];

const SAMPLE_CARDS = ['r3-01', 'b2-01', 'g3-01']
  .map((id) => CARDS.find((c) => c.id === id))
  .filter(Boolean);

export function SkinsModal({ onClose }: { onClose: () => void }) {
  const skins = useStore((s) => s.skins);
  const [tab, setTab] = useState<Tab>('frame');

  const pick = <K extends keyof SkinSettings>(key: K, value: SkinSettings[K]) => {
    if (key === 'avatar') return;
    updateSkins({ ...skins, [key]: value });
  };

  return (
    <Modal title="皮肤工坊" subtitle="所有外观均即时生效，并保存在本机" onClose={onClose} width={880}>
      <div className="skin-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={`skin-tab ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'frame' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.frame.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.frame === opt.id ? 'is-active' : ''}`}
                onClick={() => pick('frame', opt.id as SkinSettings['frame'])}
              >
                <div className="skin-swatch">
                  {opt.swatch.map((c) => (
                    <span key={c} style={{ background: c }} />
                  ))}
                </div>
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="skin-preview">
            {SAMPLE_CARDS.map((c) => (
              <CardView key={c!.id} card={c!} size="board" />
            ))}
          </div>
        </>
      )}

      {tab === 'art' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.art.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.art === opt.id ? 'is-active' : ''}`}
                onClick={() => {
                  const art = opt.id as SkinSettings['art'];
                  updateSkins({ ...skins, art, ...ART_PRESETS[art] });
                }}
              >
                <div className="art-style-preview">
                  {SAMPLE_CARDS.slice(0, 3).map((c) => (
                    <img key={c!.id} src={cardArt(c!.art, opt.id as SkinSettings['art'])} alt="" loading="lazy" />
                  ))}
                </div>
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
                <div className="skin-name-sample">
                  例：{cardName(SAMPLE_CARDS[0]!, opt.id as SkinSettings['art'])}
                </div>
              </button>
            ))}
          </div>
          <div className="art-compare">
            {SKIN_OPTIONS.art.map((opt) => (
              <div className={`art-compare-item ${skins.art === opt.id ? 'is-active' : ''}`} key={opt.id}>
                <CardView card={SAMPLE_CARDS[0]!} size="board" skinOverride={opt.id as SkinSettings['art']} />
                <div className="art-compare-copy">
                  <b>{opt.name}</b>
                  <span>{cardName(SAMPLE_CARDS[0]!, opt.id as SkinSettings['art'])}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="skin-note">
            <Icon name="sparkle" size={13} /> 切换画风会同时换上配套的卡框、宝石、卡背、桌面与贵族，一键得到完整主题。
          </div>
        </>
      )}

      {tab === 'gems' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.gems.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.gems === opt.id ? 'is-active' : ''}`}
                onClick={() => pick('gems', opt.id as SkinSettings['gems'])}
              >
                <div className="gem-style-preview">
                  {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => (
                    <Gem key={c} color={c} size={24} variant={opt.id as SkinSettings['gems']} />
                  ))}
                </div>
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="gem-preview-row">
            {(['w', 'b', 'g', 'r', 'k', 'gold'] as const).map((c) => (
              <div key={c} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <Gem color={c} size={54} variant={skins.gems} glow />
                <span style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.06em' }}>
                  {c === 'gold' ? '黄金' : GEM[c].name}
                </span>
              </div>
            ))}
          </div>
          <div className="skin-note">
            <Icon name="sparkle" size={13} /> 宝石样式会应用到银行、玩家面板与所有计数图标。
          </div>
        </>
      )}

      {tab === 'back' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.back.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.back === opt.id ? 'is-active' : ''}`}
                onClick={() => pick('back', opt.id as SkinSettings['back'])}
              >
                <div className="card-back-preview">
                  <img src={backArt(opt.id)} alt={opt.name} />
                </div>
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="skin-note">
            <Icon name="sparkle" size={13} /> 卡背会显示在牌堆、对手保留区与盲抽预览中。
          </div>
        </>
      )}

      {tab === 'table' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.table.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.table === opt.id ? 'is-active' : ''}`}
                onClick={() => pick('table', opt.id as SkinSettings['table'])}
              >
                <div className={`table-preview table-preview-${opt.id}`} />
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
        </>
      )}

      {tab === 'noble' && (
        <>
          <div className="skin-grid">
            {SKIN_OPTIONS.noble.map((opt) => (
              <button
                key={opt.id}
                className={`skin-card ${skins.noble === opt.id ? 'is-active' : ''}`}
                onClick={() => pick('noble', opt.id as SkinSettings['noble'])}
              >
                <div className="art-style-preview is-noble">
                  {NOBLES.slice(0, 3).map((n) => (
                    <img key={n.id} src={nobleArt(n.id, opt.id as SkinSettings['noble'])} alt="" loading="lazy" />
                  ))}
                </div>
                <div className="skin-name">{opt.name}</div>
                <div className="skin-desc">{opt.desc}</div>
              </button>
            ))}
          </div>
          <div className="skin-preview">
            {NOBLES.slice(0, 5).map((n) => (
              <div className="noble-preview" key={n.id}>
                <img src={nobleArt(n.id, skins.noble)} alt={n.name} />
                <span>{n.name}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'avatar' && (
        <>
          <div className="avatar-grid">
            {AVATAR_OPTIONS.map((key) => (
              <button
                key={key}
                className={`avatar-choice ${skins.avatar === key ? 'is-active' : ''}`}
                onClick={() => updateAvatar(key)}
                title={key.startsWith('noble-') ? '贵族肖像' : '卡牌原画'}
              >
                <img src={avatarArt(key, skins.art)} alt="" loading="lazy" />
              </button>
            ))}
          </div>
          <div className="skin-note">
            <Icon name="sparkle" size={13} /> 头像会同步给同一房间内的其他玩家。
          </div>
        </>
      )}
    </Modal>
  );
}