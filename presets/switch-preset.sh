#!/bin/bash
# OpenCode Preset Switcher
# Usage: ./switch-preset.sh <preset-name>

set -e

PRESETS_DIR="${HOME}/.config/opencode/presets"
CONFIG_FILE="${HOME}/.config/opencode/oh-my-opencode.json"
BACKUP_FILE="${HOME}/.config/opencode/oh-my-opencode.json.backup"

RED="\033[0;31m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
NC="\033[0m"

show_help() {
    echo -e "${GREEN}OpenCode Preset Switcher${NC}"
    echo ""
    echo "Usage: $0 <preset-name>"
    echo ""
    echo "Available presets:"
    echo "  balanced           - Quality/cost optimized for parallel agents"
    echo "  best               - Maximum quality (expensive)"
    echo "  free               - Zero cost (Antigravity + Copilot only)"
    echo "  maintainer-default - Official oh-my-opencode recommendations"
}

switch_preset() {
    local preset_name="$1"
    local preset_file="${PRESETS_DIR}/${preset_name}.jsonc"

    if [[ ! -f "$preset_file" ]]; then
        echo -e "${RED}Error: Preset '$preset_name' not found${NC}"
        echo "Available:"
        ls "${PRESETS_DIR}"/*.jsonc 2>/dev/null | xargs -I{} basename {} .jsonc | sed 's/^/  - /'
        exit 1
    fi

    # Backup current config
    if [[ -f "$CONFIG_FILE" ]]; then
        cp "$CONFIG_FILE" "$BACKUP_FILE"
        echo -e "${YELLOW}Backed up current config${NC}"
    fi

    # Strip JSONC comments (only // at start of line or after whitespace, not in URLs)
    # Also remove lines that are only whitespace
    sed -e 's|^[[:space:]]*//.*||' -e 's|[[:space:]]//[^"]*$||' "$preset_file" | \
        grep -v '^[[:space:]]*$' > "$CONFIG_FILE"

    echo -e "${GREEN}Switched to preset: $preset_name${NC}"
    echo "Restart opencode for changes to take effect."
}

# Main
if [[ $# -eq 0 || "$1" == "-h" || "$1" == "--help" ]]; then
    show_help
    exit 0
fi

switch_preset "$1"
