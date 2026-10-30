import { state, tick, save } from './store.js';
import { init } from './api.js';
import { watchAds } from './ads.js';
import { route, applyTheme, startupNotices, refreshAfterConnect } from './views.js';

applyTheme();
watchAds();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.addEventListener('hashchange', route);

// Keep hearts, streaks and quests fresh if the tab stays open across time boundaries
setInterval(() => {
  const before = `${state.hearts}|${state.quests.date}`;
  tick();
  if (`${state.hearts}|${state.quests.date}` !== before) save();
}, 60000);

route();
init().then(() => {
  applyTheme();
  refreshAfterConnect();
  startupNotices();
});
