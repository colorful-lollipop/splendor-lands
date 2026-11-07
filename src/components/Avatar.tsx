import { avatarArt } from '../lib/meta';
import { useStore } from '../store';

export function Avatar({
  name,
  skinKey,
  size = 44,
  className = '',
  glow,
}: {
  name: string;
  skinKey: string;
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  const initial = (name || '?').trim().charAt(0) || '?';
  const key = skinKey || 'w1';
  const artSkin = useStore((s) => s.skins.art);
  return (
    <div
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: glow
          ? '0 0 0 2px rgba(255, 226, 160, 0.85), 0 0 0 4px rgba(18,12,7,0.9), 0 0 0 5px rgba(200,158,80,0.6), 0 0 24px rgba(240,200,120,0.45)'
          : undefined,
      }}
      title={name}
    >
      {key ? (
        <img src={avatarArt(key, artSkin)} alt="" draggable={false} loading="lazy" />
      ) : (
        <span style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: size / 2.4 }}>{initial}</span>
      )}
    </div>
  );
}