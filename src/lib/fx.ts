/** 轻量动画工具：用 Web Animations API 做宝石飞入、卡牌飞行等效果。 */

export function flyGems(fromEls: HTMLElement[], toEl: HTMLElement | null, opts?: { count?: number }) {
  if (!toEl || fromEls.length === 0) return;
  const target = toEl.getBoundingClientRect();
  fromEls.slice(0, 6).forEach((el, i) => {
    const img = el.querySelector('img');
    if (!img) return;
    const from = el.getBoundingClientRect();
    const clone = img.cloneNode(true) as HTMLImageElement;
    clone.style.position = 'fixed';
    clone.style.left = `${from.left}px`;
    clone.style.top = `${from.top}px`;
    clone.style.width = `${from.width}px`;
    clone.style.height = `${from.height}px`;
    clone.style.pointerEvents = 'none';
    clone.style.zIndex = '9999';
    clone.style.borderRadius = '50%';
    clone.style.filter = 'drop-shadow(0 0 10px rgba(255,225,150,0.9))';
    document.body.appendChild(clone);
    const dx = target.left + target.width / 2 - (from.left + from.width / 2);
    const dy = target.top + target.height / 2 - (from.top + from.height / 2);
    const anim = clone.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 40}px) scale(1.35)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.2)`, opacity: 0 },
      ],
      { duration: 620, delay: i * 70, easing: 'cubic-bezier(.35,.7,.3,1)' },
    );
    anim.onfinish = () => clone.remove();
    anim.oncancel = () => clone.remove();
  });
}

/** 在屏幕中央播放一段文字/光效冲击（用于购买、贵族来访） */
export function flashAt(el: HTMLElement | null, text: string, color = '#ffe9ac') {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const node = document.createElement('div');
  node.className = 'fx-flash';
  node.textContent = text;
  node.style.left = `${r.left + r.width / 2}px`;
  node.style.top = `${r.top + r.height / 2}px`;
  node.style.color = color;
  document.body.appendChild(node);
  const anim = node.animate(
    [
      { transform: 'translate(-50%,-50%) scale(0.7)', opacity: 0 },
      { transform: 'translate(-50%,-70%) scale(1)', opacity: 1, offset: 0.35 },
      { transform: 'translate(-50%,-140%) scale(1.05)', opacity: 0 },
    ],
    { duration: 1100, easing: 'cubic-bezier(.2,.7,.3,1)' },
  );
  anim.onfinish = () => node.remove();
}
