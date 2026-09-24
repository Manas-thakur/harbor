# Harbor

A personal tracker for issues, bug causes, and the time you spend on them. It stays in this browser. There is no account and no server.

Use it when a ticket list has gotten too heavy, but you still want to know what broke, why, and how long it took.

## Run it

```bash
npm install
npm run dev
```

The dev server uses port 3847:

```bash
npx next dev -p 3847
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

## What you can do

- File bugs, tasks, and improvements
- Write a cause on a bug, then see which causes repeat
- Keep nested notes with to-dos, slash commands, `[[links]]`, backlinks, a daily page, and a table of every page
- Link a note to an issue, or mention the issue from the page
- Start a timer on an issue, or log time you already spent
- Run a Pomodoro: focus, short break, long break, with the focus block logged on an issue
- Move work across Backlog, To do, In progress, and Done
- Export and import the workspace as JSON, or export a single page as Markdown

The first visit loads a sample workspace so the time and causes views are not empty. Clear it from the sidebar when you want a blank slate.

Shortcuts: `C` creates an issue, `/` focuses search, `T` starts or stops the timer on the open issue, `Esc` closes the detail panel.

Data is stored in `localStorage` under `harbor.v1`.
