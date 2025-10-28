#!/bin/bash
# Environment setup for Claude Code terminal commands
# Source this file to set up PATH and other environment variables

# Set PATH with Homebrew and common locations
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.npm-global/bin:$HOME/.local/bin:$PATH"

# Node/npm configuration
export NODE_OPTIONS="--max-old-space-size=4096"

# Helpful aliases (optional, but useful)
alias ll='ls -la'
alias gs='git status'
alias gp='git pull'
alias gpu='git push'

# Color output
export CLICOLOR=1
export LSCOLORS=GxFxCxDxBxegedabagaced

# Success message
echo "✅ Environment configured for Claude Code"

