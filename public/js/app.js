import { state, tick, save } from './store.js';
import { init } from './api.js';
import { route, applyTheme, startupNotices } from './views.js';

applyTheme();
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
  // re-render once we know whether the server / profile is available
  if (!location.hash.startsWith('#/lesson') && !location.hash.startsWith('#/practice/') && !location.hash.startsWith('#/story')) route();
  startupNotices();
});
