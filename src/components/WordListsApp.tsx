import '@fontsource-variable/inclusive-sans/wght.css';
import './word-explorer/wordExplorer.css';
import '../lib/fontChoice';
import { useEffect, useState } from 'react';
import { Icon } from './Icon';
import { HomeButton } from './HomeButton';
import { MainMenu } from './MainMenu';
import { ListMaker, SharedList } from './word-explorer/ListMaker';
import { ReaderProvider, TapProvider } from './word-explorer/parts';
import { SettingsDialog } from './word-explorer/SettingsDialog';
import { readSettings, saveSettings, type WxSettings } from '../lib/word-explorer/settings';
import { takeListStart } from '../lib/word-explorer/lists';
import { loadIndex } from '../lib/word-explorer/data';
import { loadWordTypes } from '../lib/wordTypes';

// The Word List Maker as its own tool (her request 2026-11-12), at /lists. Word Explorer's "Make a list" buttons
// open it with their filters ready; a word tapped twice opens its Word Explorer page. /lists?l=... is a list a
// teacher assigned.
const SIZE = { medium: '100%', large: '112.5%', xl: '125%' } as const;

export function WordListsApp() {
  const [settings, setSettings] = useState<WxSettings>(readSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [start] = useState(takeListStart);
  const shared = new URLSearchParams(window.location.search).get('l');
  useEffect(() => { document.title = 'Word List Maker'; loadIndex(); loadWordTypes(); }, []);
  useEffect(() => {
    const html = document.documentElement;
    const before = html.style.fontSize;
    html.style.fontSize = SIZE[settings.textSize];
    return () => { html.style.fontSize = before; };
  }, [settings.textSize]);
  const update = (s: WxSettings) => { setSettings(s); saveSettings(s); };
  return (
    <ReaderProvider rate={settings.speed}>
      <TapProvider open={(w, tab) => window.location.assign(`/words?w=${encodeURIComponent(w)}${tab ? `&tab=${tab}` : ''}`)}>
        <div className="wx" data-theme={settings.theme} data-size={settings.textSize} data-spacing={settings.spacing} data-lines={settings.lineSpacing} data-font={settings.font} data-buttons={settings.buttonSize} data-calm={settings.calm ? 'on' : 'off'} data-motion={settings.reduceMotion ? 'reduce' : 'full'}>
          <header className="wx-header">
            <HomeButton className="wx-btn" />
            <span className="wx-appname" role="heading" aria-level={1}><Icon name="menu" size={28} /><span>Word List Maker</span></span>
            <span style={{ flex: 1 }} />
            <a className="wx-btn" href="/words"><Icon name="book" size={22} /><span>Word Explorer</span></a>
            <button type="button" className="wx-btn" onClick={() => setShowSettings(true)}><Icon name="gear" size={22} /><span>Settings</span></button>
          </header>
          <main className="wx-main">
            {shared ? <SharedList data={shared} /> : <ListMaker initial={start?.recipe} initialName={start?.name} teacher={settings.teacherView} settings={settings} onSettings={update} />}
          </main>
          {showSettings && <SettingsDialog settings={settings} onChange={update} onClose={() => setShowSettings(false)} />}
          <MainMenu />
        </div>
      </TapProvider>
    </ReaderProvider>
  );
}
