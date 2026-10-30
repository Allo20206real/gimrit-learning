# Gimrit

**Learn languages the fun way.** Gimrit is a gamified language-learning web app for Spanish, French, German, Italian and Portuguese.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

Needs Node 18+. `server.js` serves the app and a small JSON API. By default it stores data in `data/db.json`. If `DATABASE_URL` is set, it stores data in Postgres instead. Other settings: `PORT`, `DATA_DIR`, and `ALLOWED_ORIGINS` (the sites allowed to call the API, comma separated).

## Hosting

- **Website:** `.github/workflows/pages.yml` copies `public/` to the `gh-pages` branch on every push, and GitHub Pages serves it at https://allo20206real.github.io/gimrit-learning/.
- **Server:** `render.yaml` sets up the server on Render's free plan. Set `DATABASE_URL` to a Postgres database, such as a free one from neon.tech.
- **Connecting the two:** add a repository variable `GIMRIT_API_URL` with the server address (Settings → Secrets and variables → Actions → Variables), then re-run the "Deploy site" workflow. Without this, the site still works but without accounts, friends or leaderboards.

## Ads

All ad spots are set in `public/js/ads.js`. Paste an AdSense ad-unit ID, or another network's HTML snippet, into any spot. Spots left empty show nothing. Ads never appear inside lessons.

## Features

**Ways to learn**
- A learning path of 8 units (Greetings, Food, Animals, Family, Colors, Numbers, Travel, Home). Each unit has 5 lessons, a treasure chest and a guidebook with audio.
- 9 exercise types: picture choice, translate (both directions), word-bank sentence building, listen & tap, dictation, typing with accent keys, fill-in-the-blank, matching pairs, and speaking (speech recognition).
- Practice hub: smart review (spaced repetition), fix-your-mistakes, flashcards, a 60-second speed round, listening lab, speaking studio, sentence builder, and a word browser with strength meters.
- Interactive stories with comprehension questions, unlocked as you finish units.
- Answer checking that tolerates missing accents and typos, but tells you about them.

**Motivation**
- Streaks, plus streak freezes that are used automatically. You get a streak celebration screen, a week view and a 5-week calendar.
- XP, levels, a daily XP goal, combos and a 2× XP boost.
- Hearts: you lose one per mistake in lessons. They refill over time, and practice earns them back.
- Gems (everyone starts with 100), earned from lessons, chests, quests and achievements. Spend them in the shop on streak freezes, heart refills, XP boosts, themes and premium avatars.
- Three daily quests, a daily bonus chest, and 21 achievements.

**Social** (requires the server)
- Profiles with sign-up and login. Passwords are hashed with scrypt.
- Friend requests, accept/decline, and user search.
- Friend cards that show streak, XP, languages and whether they practiced today. You can nudge friends.
- An activity feed with 👏 cheers, a weekly friends quest, and head-to-head profile comparison.
- Weekly leaderboards (global and friends) and in-app notifications.

**Polish**
- Responsive layout: sidebar on desktop, bottom nav on mobile.
- Dark mode, 5 color themes, keyboard shortcuts (Enter, 1–9), sound effects, confetti, and a mascot named Gim.

## Project layout

```
server.js            HTTP server + API (accounts, sync, friends, feed, leaderboard)
public/index.html    App entry
public/css/          Styles
public/js/data.js    Course content (words, sentences, stories)
public/js/store.js   Game state: streaks, hearts, XP, quests, achievements, SRS
public/js/lesson.js  Exercise generators + lesson runner
public/js/views.js   Pages and router
public/js/api.js     Server sync and social API client
public/js/config.js  Server address used by the hosted site
public/js/ads.js     Ad spots — paste ad codes here
```

To add content, edit `public/js/data.js`. Each word and sentence lists translations in the order `es|fr|de|it|pt`.

## Notes

- The server trusts the XP that clients report, so the leaderboard isn't cheat-proof. Validating XP on the server would be the next step for a public launch.
- Speech recognition only works in Chromium-based browsers and Safari. Elsewhere, the speaking exercises are skipped automatically.
