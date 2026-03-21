# SSHFolio

A custom Terminal User Interface (TUI) portfolio that acts as an interactive SSH server. When users SSH into your domain, they are presented with a navigated terminal app summarizing your projects and background.

## Running Locally

To run the application locally without needing an SSH connection, ensure you have Go installed and use the following command in the `sshfolio` directory:

```bash
go run .
```

This will run the interactive session directly in your current terminal window.

## Adding and Editing Projects

The project list is dynamically generated based on your environment variables and markdown files.

### 1. Configure the `.env` file
Open the `.env` file in the root of the `sshfolio` folder. For each project, you must define the following three variables in a strict numerical sequence (1, 2, 3...):

```env
PROJECT_1_DISPLAY_TITLE="Project Name"
PROJECT_1_MARKDOWN_FILE_TITLE="project-file"
PROJECT_1_DESCRIPTION="A brief summary of the project."
```

*Note: The sequence must be unbroken. If you have `PROJECT_1` and `PROJECT_3` with no `2`, the app will stop reading at `1`.*

### 2. Create the Markdown file
The actual content of the project page is stored in `assets/markdown/projects/`. 
Create a new file with the exact name you used for `PROJECT_X_MARKDOWN_FILE_TITLE` in your `.env` file, appending the `.md` extension.

For example, given the `.env` above, you would create or edit:
`assets/markdown/projects/project-file.md`

## Deployment (Hetzner VPS)

Because the `sshfolio` application binds to port `22` (the default SSH port) for visitors, your typical `ssh root@domain.com` login command will launch the TUI rather than a shell session.

To apply updates:
1. **Commit and push:** Make sure all your `.env` and `.md` changes are completed, committed, and pushed to your GitHub repository.
2. **Access your server shell:** SSH into your server using your alternative SSH port or IP.
   - Using the alternate port: `ssh -p <YOUR_OPENSSH_PORT> root@your-server-ip`
   - Alternatively, use the **Web Console** located in the [Hetzner Cloud Dashboard](https://console.hetzner.cloud/).
3. **Pull changes:** Navigate to the project directory on the server and run `git pull`.
4. **Rebuild the app:** Restart the service (for example, with `docker-compose up -d --build` or by running `go build .` and restarting your system service, depending on your setup).
