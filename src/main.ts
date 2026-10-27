import './style.css';
import { DeckStore } from './state/store';
import { CardUI } from './ui/card';
import { ImportModalUI } from './ui/importModal';
import { SettingsModalUI } from './ui/settingsModal';

document.addEventListener('DOMContentLoaded', async () => {
  const store = new DeckStore();

  new CardUI(store);
  new ImportModalUI(store);
  new SettingsModalUI(store);

  // Load words on start
  await store.initDeck();
});
