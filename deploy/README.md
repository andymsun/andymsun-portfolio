# deploying sshfolio

The terminal portfolio runs on one Hetzner server (`andymsun-ssh`, CPX11,
Ashburn, `178.156.231.94`, DNS `ssh.andymsun.com`). The web page is separate:
Vercel serves the repo root as static files; `git push` is the deploy.

## the box, as it is

- Ubuntu 24.04. Admin sshd on **port 2222**; port 22 is the portfolio.
- The portfolio is a Docker container, `sshfolio-sshfolio-1`, built by
  `docker compose` from `/opt/sshfolio` (a golang:1.22 image running
  `go run .`). Restart policy is `always`, so it survives reboots.
- The host key visitors trust is `/opt/sshfolio/.ssh/id_ed25519`, mounted into
  the container. Back it up with the server; if it changes, every past visitor
  gets a "host key changed" warning.
- ufw allows 22 and 2222. `hcloud` context `andymsun` on Andy's Mac manages the
  server; ssh key `andysun-mac` is registered in the project.

## getting a shell

```bash
ssh andy-vps          # Host andy-vps = root@178.156.231.94, port 2222 (in ~/.ssh/config)
```

If that key is ever lost: `hcloud server enable-rescue andymsun-ssh --ssh-key <key>`,
`hcloud server reboot andymsun-ssh`, ssh in on port 22 as root, `mount /dev/sda1 /mnt`,
append the key to `/mnt/root/.ssh/authorized_keys`, `umount /mnt`,
`hcloud server disable-rescue`, reboot. About two minutes of downtime.

## updating the portfolio

The rewritten agent went live on 2026-09-12. It runs from `/opt/portfolio/sshfolio`
on the server, built by the `Dockerfile` and `docker-compose.yml` in this
directory (copied there). The host key is the same one visitors have always
seen. The old flat checkout is still at `/opt/sshfolio`, stopped; to roll back:
`cd /opt/portfolio/sshfolio && docker compose down && cd /opt/sshfolio && docker compose up -d`.

`/opt/portfolio/sshfolio` is not a git checkout yet (the deploy was a tar copy
because nothing had been pushed). Until it is, an update is:

```bash
tar --exclude=ascii-gen --exclude=.ssh --exclude=.env -czf - -C sshfolio . \
  | ssh andy-vps 'cd /opt/portfolio/sshfolio && tar -xzf - && docker compose up -d --build'
```

Once the repo is pushed, make it a checkout so `deploy/deploy.sh` works:

```bash
ssh andy-vps
cd /opt && mv portfolio portfolio.tar && git clone https://github.com/andymsun/andymsun-portfolio portfolio
cp -a portfolio.tar/sshfolio/.ssh portfolio.tar/sshfolio/.env portfolio/sshfolio/
cp portfolio/deploy/Dockerfile portfolio/deploy/docker-compose.yml portfolio/sshfolio/
cd portfolio/sshfolio && docker compose up -d --build
```

After that, every update is `ssh andy-vps 'sudo /opt/portfolio/deploy/deploy.sh'`,
which pulls `main`, rebuilds, and restarts. Content lives in
`sshfolio/app/content.go` (and its twin `app.js` on the web).
