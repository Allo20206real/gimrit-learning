# Gimrit

**Learn languages the fun way.** Gimrit is a gamified language-learning web app for Spanish, French, German, Italian and Portuguese.

## Run it

```bash
npm start            # http://localhost:3000
```

Needs Node 18+ and has **no dependencies**. `server.js` serves the app and a small JSON API. Accounts and progress are stored in `data/db.json`. You can change this with `PORT` and `DATA_DIR`.

You can also host just the `public/` folder on any static host. In that case lessons, practice, streaks, quests and the shop all work offline from `localStorage`. Friends, leaderboards and cloud sync need the server.

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
- Gems, earned from lessons, chests, quests and achievements. Spend them in the shop on streak freezes, heart refills, XP boosts, themes and premium avatars.
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
```

To add content, edit `public/js/data.js`. Each word and sentence lists translations in the order `es|fr|de|it|pt`.

## Notes

- The server trusts the XP that clients report, so the leaderboard isn't cheat-proof. Validating XP on the server would be the next step for a public launch.
- Speech recognition only works in Chromium-based browsers and Safari. Elsewhere, the speaking exercises are skipped automatically.
