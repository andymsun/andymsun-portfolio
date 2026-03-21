# andy's portfolio

yo. this is the monorepo for my portfolio stuff. it's got two main pieces going on right now:

## 1. the regular website
there's a regular static site right here in the root folder (`index.html` and `style.css`). it's just a clean, minimalist landing page if you don't feel like hacking into a terminal right now. nothing too crazy.

## 2. the ssh tui app (`sshfolio` folder)
this is the really cool part. i wrote a custom terminal app in go underneath the `sshfolio/` folder. if you ssh into my server, it drops you into this interactive retro terminal view of my resume and projects instead of a shell. 

if you want to test the terminal app on your own machine without a server:
- `cd sshfolio`
- run `go run .`
- profit.

### updating projects in the terminal
if i ever actually build something new, here's how to update the list:
- go to `sshfolio/.env` and add the new project info at the bottom (make sure the numbers stay in order, like project_1, project_2, etc).
- drop a new file matching the title straight into `sshfolio/assets/markdown/projects/` with all the deets.

### deploying
just commit to github, ssh into the real server (make sure you use the actual ssh port since my app steals port 22), run `git pull`, and rebuild the app (like `docker-compose up -d --build` or whatever we're doing these days).

have fun looking around ✨
