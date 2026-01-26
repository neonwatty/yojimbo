#!/usr/bin/env zsh
# Remote Claude Launcher
# Extracted from Yojimbo app logic for standalone use
#
# Usage:
#   remote-claude mm1 [working_dir]       - Launch Claude on Mac Mini 1
#   remote-claude mm2 [working_dir]       - Launch Claude on Mac Mini 2
#   remote-claude password mm1            - Set/update password for Mac Mini 1
#   remote-claude password mm2            - Set/update password for Mac Mini 2
#   remote-claude test mm1                - Test SSH + keychain unlock (no Claude)
#   remote-claude ssh mm1                 - Plain SSH connection (no keychain/Claude)
#
# Aliases (add to ~/.zshrc):
#   alias mm1='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh mm1'
#   alias mm2='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh mm2'
#   alias mm-password='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh password'
#   alias mm-test='/Users/jeremywatt/Desktop/yojimbo-dev/scripts/remote-claude.sh test'

# Configuration (from yojimbo database)
declare -A MACHINES
MACHINES[mm1_host]="192.168.1.19"
MACHINES[mm1_user]="neonwatty"
MACHINES[mm1_key]="/Users/jeremywatt/.ssh/id_ed25519"
MACHINES[mm1_keychain_id]="d7abef8e-8f65-456c-86a3-97e301f3f0d9"

MACHINES[mm2_host]="192.168.1.18"
MACHINES[mm2_user]="jeremywatt"
MACHINES[mm2_key]=""  # Uses default SSH key
MACHINES[mm2_keychain_id]="eb3d724d-5245-47f3-81d8-73485b65f1c3"

KEYCHAIN_SERVICE="com.yojimbo.remote-keychain"

# Get password from local keychain (same as yojimbo app does)
get_keychain_password() {
    local machine_id="$1"
    security find-generic-password \
        -s "$KEYCHAIN_SERVICE" \
        -a "remote-${machine_id}" \
        -w 2>/dev/null
}

# Launch Claude on remote machine with keychain unlock
remote_claude() {
    local machine="$1"
    local workdir="${2:-~}"

    # Get machine config
    local host="${MACHINES[${machine}_host]}"
    local user="${MACHINES[${machine}_user]}"
    local key="${MACHINES[${machine}_key]}"

    if [[ -z "$host" ]]; then
        echo "Unknown machine: $machine"
        echo "Available: mm1 (Mac Mini 1), mm2 (Mac Mini 2)"
        return 1
    fi

    echo "🚀 Connecting to $machine ($host) as $user..."
    echo "📁 Working directory: $workdir"
    echo "🔐 You'll be prompted for keychain password, then Claude will launch"
    echo ""

    # SSH in, unlock keychain, then drop to interactive shell
    # Set TERM to xterm-256color for compatibility (Ghostty's terminfo may not be on remote)
    local remote_cmd="export TERM=xterm-256color; security unlock-keychain ~/Library/Keychains/login.keychain-db; exec zsh -l"

    if [[ -n "$key" ]]; then
        exec ssh -i "$key" -t "${user}@${host}" "$remote_cmd"
    else
        exec ssh -t "${user}@${host}" "$remote_cmd"
    fi
}

# Simple SSH connection without expect (for testing/debugging)
remote_ssh() {
    local machine="$1"

    local host="${MACHINES[${machine}_host]}"
    local user="${MACHINES[${machine}_user]}"
    local key="${MACHINES[${machine}_key]}"

    if [[ -z "$host" ]]; then
        echo "Unknown machine: $machine"
        return 1
    fi

    local ssh_opts=""
    if [[ -n "$key" ]]; then
        ssh_opts="-i $key"
    fi

    echo "Connecting to $machine ($host)..."
    ssh $ssh_opts "${user}@${host}"
}

# Store a password for a machine (prompts securely if not provided)
store_keychain_password() {
    local machine="$1"
    local password="$2"

    local host="${MACHINES[${machine}_host]}"
    local keychain_id="${MACHINES[${machine}_keychain_id]}"

    if [[ -z "$keychain_id" ]]; then
        echo "Unknown machine: $machine"
        echo "Available: mm1 (Mac Mini 1), mm2 (Mac Mini 2)"
        return 1
    fi

    # If password not provided, prompt for it securely
    if [[ -z "$password" ]]; then
        echo "Setting keychain password for $machine ($host)"
        echo -n "Enter password: "
        read -s password
        echo ""

        if [[ -z "$password" ]]; then
            echo "Password cannot be empty"
            return 1
        fi

        # Confirm password
        echo -n "Confirm password: "
        read -s password_confirm
        echo ""

        if [[ "$password" != "$password_confirm" ]]; then
            echo "Passwords do not match"
            return 1
        fi
    fi

    security add-generic-password \
        -a "remote-${keychain_id}" \
        -s "$KEYCHAIN_SERVICE" \
        -w "$password" \
        -U

    echo "✅ Password stored for $machine"
}

# Test keychain unlock on remote machine (without launching Claude)
test_remote_keychain() {
    local machine="$1"

    local host="${MACHINES[${machine}_host]}"
    local user="${MACHINES[${machine}_user]}"
    local key="${MACHINES[${machine}_key]}"
    local keychain_id="${MACHINES[${machine}_keychain_id]}"

    if [[ -z "$host" ]]; then
        echo "Unknown machine: $machine"
        echo "Available: mm1 (Mac Mini 1), mm2 (Mac Mini 2)"
        return 1
    fi

    # Get stored password
    local password
    password=$(get_keychain_password "$keychain_id")

    if [[ -z "$password" ]]; then
        echo "❌ No keychain password stored for $machine"
        echo "Run: $0 password $machine"
        return 1
    fi

    echo "🔍 Testing connection and keychain unlock for $machine ($host)..."

    # Build SSH options
    local ssh_opts=""
    if [[ -n "$key" ]]; then
        ssh_opts="-i $key"
    fi

    # Test SSH connection first
    echo -n "  SSH connection... "
    if ssh $ssh_opts -o ConnectTimeout=5 -o BatchMode=yes "${user}@${host}" "echo ok" 2>/dev/null | grep -q "ok"; then
        echo "✅"
    else
        echo "❌ Failed"
        echo "Check SSH keys and network connectivity"
        return 1
    fi

    # Test keychain unlock via SSH
    echo -n "  Keychain unlock... "

    # Escape password for shell
    local escaped_password="${password//\"/\\\"}"
    escaped_password="${escaped_password//\$/\\\$}"

    local result
    result=$(ssh $ssh_opts "${user}@${host}" "echo \"$escaped_password\" | security unlock-keychain ~/Library/Keychains/login.keychain-db 2>&1")
    local exit_code=$?

    if [[ $exit_code -eq 0 ]] && ! echo "$result" | grep -qi "incorrect\|bad password\|error"; then
        echo "✅"
        echo ""
        echo "🎉 All tests passed! Ready to launch with: $0 $machine"
        return 0
    else
        echo "❌ Failed"
        if echo "$result" | grep -qi "incorrect\|bad password"; then
            echo "  Password is incorrect. Update with: $0 password $machine"
        else
            echo "  Error: $result"
        fi
        return 1
    fi
}

# Main entry point with subcommand handling
# Works in both bash and zsh
if [[ "${ZSH_VERSION:-}" ]] || [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    case "$1" in
        password)
            # Set/update password: remote-claude password mm1
            if [[ -z "$2" ]]; then
                echo "Usage: $0 password <machine>"
                echo "  machine: mm1 or mm2"
                exit 1
            fi
            store_keychain_password "$2" "$3"
            ;;
        test)
            # Test connection: remote-claude test mm1
            if [[ -z "$2" ]]; then
                echo "Usage: $0 test <machine>"
                echo "  machine: mm1 or mm2"
                exit 1
            fi
            test_remote_keychain "$2"
            ;;
        ssh)
            # Plain SSH: remote-claude ssh mm1
            if [[ -z "$2" ]]; then
                echo "Usage: $0 ssh <machine>"
                echo "  machine: mm1 or mm2"
                exit 1
            fi
            remote_ssh "$2"
            ;;
        mm1|mm2)
            # Launch Claude: remote-claude mm1 [workdir]
            remote_claude "$@"
            ;;
        -h|--help|help|"")
            echo "Remote Claude Launcher"
            echo ""
            echo "Usage:"
            echo "  $0 <machine> [working_dir]  - Launch Claude on remote machine"
            echo "  $0 password <machine>       - Set/update keychain password"
            echo "  $0 test <machine>           - Test SSH + keychain unlock"
            echo "  $0 ssh <machine>            - Plain SSH (no keychain/Claude)"
            echo ""
            echo "Machines:"
            echo "  mm1  Mac Mini 1 (192.168.1.19, user: neonwatty)"
            echo "  mm2  Mac Mini 2 (192.168.1.18, user: jeremywatt)"
            echo ""
            echo "Examples:"
            echo "  $0 mm1                      # Launch Claude in home dir"
            echo "  $0 mm1 ~/projects/myapp     # Launch in specific dir"
            echo "  $0 password mm1             # Update stored password"
            echo "  $0 test mm1                 # Verify password works"
            ;;
        *)
            echo "Unknown command: $1"
            echo "Run '$0 --help' for usage"
            exit 1
            ;;
    esac
fi
