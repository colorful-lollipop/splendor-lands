import { useEffect } from 'react';
import { useStore, openSkins, openRules, openCollection } from './store';
import { Toasts } from './components/Toasts';
import { Landing } from './components/Landing';
import { RoomScreen } from './components/RoomScreen';
import { GameScreen } from './components/GameScreen';
import { SkinsModal } from './components/modals/SkinsModal';
import { RulesModal } from './components/modals/RulesModal';
import { GameOverModal } from './components/modals/GameOverModal';
import { CollectionModal } from './components/modals/CollectionModal';

export function App() {
  const screen = useStore((s) => s.screen);
  const skinsOpen = useStore((s) => s.skinsOpen);
  const rulesOpen = useStore((s) => s.rulesOpen);
  const collectionOpen = useStore((s) => s.collectionOpen);
  const status = useStore((s) => s.status);
  const game = useStore((s) => s.game);
  const pending = useStore((s) => s.pending);
  const autoReconnecting = useStore((s) => s.autoReconnecting);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        openSkins(false);
        openRules(false);
        openCollection(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {screen === 'lobby' && <Landing />}
      {screen === 'room' && <RoomScreen />}
      {screen === 'game' && game && <GameScreen />}
      <Toasts />
      {skinsOpen && <SkinsModal onClose={() => openSkins(false)} />}
      {rulesOpen && <RulesModal onClose={() => openRules(false)} />}
      {collectionOpen && <CollectionModal onClose={() => openCollection(false)} />}
      {game?.finished && <GameOverModal />}
      {(pending || autoReconnecting) && (
        <div className="loading-veil">
          <div className="lv-inner">
            <div className="lv-spinner" />
            <p>{autoReconnecting ? '正在重返牌桌…' : '正在连接房间…'}</p>
          </div>
        </div>
      )}
      {status === 'closed' && !pending && <div className="net-banner">连接已断开，正在重连…</div>}
    </>
  );
}