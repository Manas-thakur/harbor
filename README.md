# Harbor

A shared tracker for a team’s issues, bug causes, notes, and time. People sign up, join a team with an invite code, and work on the same board.

Use it when a ticket list has gotten too heavy, but you still want to know what broke, why, and how long it took.

## Run it

```bash
npm install
npm run dev
```

That starts the services and the web app. Open [http://127.0.0.1:3847](http://127.0.0.1:3847).

Harbor is split into small services. The web app talks only to the gateway. Each service has its own database under `data/`.

| Service | Port | Owns |
| --- | --- | --- |
| Gateway | 4100 | Login cookie and the public API |
| Auth | 4101 | Accounts and sessions |
| Teams | 4102 | Teams, members, invite codes |
| Issues | 4103 | Tickets and the next number |
| Time | 4104 | Time entries |
| Notes | 4105 | Pages |
| Pomodoro | 4106 | Each person's focus timer |

`npm run services` starts only the services. `npm run web` starts only the Next.js app, which proxies `/api` to the gateway.

## What you can do

- File bugs, tasks, and improvements
- Write a cause on a bug, then see which causes repeat
- Keep nested notes with to-dos, slash commands, `[[links]]`, backlinks, a daily page, and a table of every page
- Link a note to an issue, or mention the issue from the page
- Start a timer on an issue, or log time you already spent
- Run a Pomodoro: focus, short break, long break, with the focus block logged on an issue
- Move work across Backlog, To do, In progress, and Done
- Export and import the workspace as JSON, or export a single page as Markdown

Create an account on the first screen. You get a team of your own. Use Invite to copy a code, and someone else can join with that code after they log in.

Load the sample workspace from the sidebar if you want a filled board to click through.

Shortcuts: `C` creates an issue, `/` focuses search, `T` starts or stops the timer on the open issue, `Esc` closes the detail panel.

Passwords are hashed in the auth service. An existing `data/harbor.db` is split into the service databases the first time the services start.
