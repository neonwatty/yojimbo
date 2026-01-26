# Remote Claude Launcher

Launch Claude Code on remote Mac minis with automatic keychain unlocking.
Extracted from Yojimbo for standalone use while developing the app.

## Quick Start

```bash
# From anywhere (after sourcing ~/.zshrc):
mm1                      # Launch Claude on Mac Mini 1
mm2                      # Launch Claude on Mac Mini 2
mm1 ~/projects/myapp     # Launch in specific directory

# Or via Makefile:
make remote-mm1
make remote-mm2
```

## Setup

### 1. Store Keychain Passwords

The Mac minis require keychain unlock to access Claude's API credentials.
Store each machine's login password in your local keychain:

```bash
# Interactive (prompts securely):
mm-password mm1
mm-password mm2

# Or via Makefile:
make remote-password MM=mm1
make remote-password MM=mm2
```

### 2. Test Connection

Verify SSH and keychain unlock work before launching:

```bash
mm-test mm1
mm-test mm2

# Or via Makefile:
make remote-test MM=mm1
```

### 3. Launch Claude

```bash
mm1                      # Mac Mini 1, home directory
mm2 ~/my-project         # Mac Mini 2, specific directory
```

## Machine Configuration

| Alias | Host | User | SSH Key |
|-------|------|------|---------|
| mm1 | 192.168.1.19 | neonwatty | ~/.ssh/id_ed25519 |
| mm2 | 192.168.1.18 | jeremywatt | default |

## Shell Aliases (in ~/.zshrc)

```bash
alias mm1='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh mm1'
alias mm2='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh mm2'
alias mm-password='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh password'
alias mm-test='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh test'
```

## Makefile Commands

```bash
make remote-mm1              # Launch on Mac Mini 1
make remote-mm2              # Launch on Mac Mini 2
make remote-password MM=mm1  # Set password for Mac Mini 1
make remote-test MM=mm1      # Test connection
make remote-help             # Show help
```

## Troubleshooting

### "Password is incorrect"
```bash
mm-password mm1   # Re-enter the correct password
mm-test mm1       # Verify it works
```

### "No keychain password stored"
```bash
mm-password mm1   # Store the password first
```

### SSH connection fails
- Check the Mac mini is powered on and on the network
- Verify SSH key is set up: `ssh neonwatty@192.168.1.19`
- Check `~/.ssh/id_ed25519` exists

## How It Works

1. Retrieves stored password from local macOS Keychain
2. SSHs into the Mac mini with appropriate key
3. Sends `security unlock-keychain` command
4. Waits for password prompt, sends password
5. Launches `yolo` (Claude with --dangerously-skip-permissions)
6. Hands control to you for interactive session
