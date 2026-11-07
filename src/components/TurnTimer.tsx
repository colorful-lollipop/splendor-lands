import { useEffect, useRef, useState } from 'react';
import { Icon } from './Ornaments';

/**
 * 回合倒计时。以服务端下发的 turnDeadline 为准，本地只做平滑显示，
 * 避免各客户端时钟不一致。最后 5 秒转为醒目的红色脉冲。
 */
export function TurnTimer({
  deadline,
  seconds,
  active,
  compact = false,
}: {
  deadline: number | null;
  seconds: number;
  active: boolean;
  compact?: boolean;
}) {
  const [left, setLeft] = useState<number>(0);
  const warned = useRef(false);

  useEffect(() => {
    if (!deadline || !seconds) {
      setLeft(0);
      warned.current = false;
      return;
    }
    const tick = () => {
      const remain = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setLeft(remain);
    };
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [deadline, seconds]);

  useEffect(() => {
    if (left > 5) warned.current = false;
  }, [left]);

  if (!seconds || !deadline || !active) return null;

  const danger = left <= 5;
  const percent = Math.max(0, Math.min(100, (left / seconds) * 100));

  return (
    <span
      className={`turn-timer ${danger ? 'is-danger' : ''} ${compact ? 'is-compact' : ''}`}
      title={danger ? '即将超时，本回合会被自动跳过' : '本回合剩余时间'}
      aria-live={danger ? 'assertive' : 'off'}
    >
      <Icon name="clock" size={compact ? 11 : 13} />
      <b>{left}</b>
      {!compact && <i className="tt-bar"><span style={{ width: `${percent}%` }} /></i>}
      {!compact && <span className="tt-label">秒</span>}
    </span>
  );
}
