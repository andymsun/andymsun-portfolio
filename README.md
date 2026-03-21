# andy's portfolio

hello gang. this is the monorepo for my portfolio stuff. it's has two main pieces going on right now:

## 1. the regular website
there's a regular static site right here in the root folder (`index.html` and `style.css`). it's just a landing page if you don't feel like sshing into a terminal right now.

## 2. the ssh tui app (`sshfolio` folder)
cool stuff. custom terminal app in `sshfolio/` folder. if you ssh into ssh.andymsun.com, you get my portfolio

if you want to test the terminal app on your own machine without a server:
- `cd sshfolio`
- run `go run .`
- bottom text

### updating projects in the terminal
if i ever actually build something new, here's how to update the list:
- go to `sshfolio/.env` and add the new project info at the bottom (make sure the numbers stay in order, like project_1, project_2, etc).
- drop a new file matching the title straight into `sshfolio/assets/markdown/projects/` with all 
- bottom text

### deploying
just commit to github, ssh into the real server (make sure you use the actual ssh port since my thing steals port 22by convention), run `git pull`, and rebuild the app (like `docker-compose up -d --build` or whatever we gonna use for our vps). used hetzner vps for this btw, whatever their cheapest on demand vps thing was

have fun lol
