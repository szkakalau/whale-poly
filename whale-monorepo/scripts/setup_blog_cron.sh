#!/bin/bash

# Blog Automation Cron Setup Script
# This script sets up automated daily blog post generation

echo "🚀 Setting up Blog Automation Cron Job"
echo "====================================="

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Python script path
PYTHON_SCRIPT="$SCRIPT_DIR/blog_automation.py"

# Create log directory
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

# Log file paths
LOG_FILE="$LOG_DIR/blog_automation.log"
ERROR_LOG="$LOG_DIR/blog_automation_errors.log"

# Create virtual environment if it doesn't exist
VENV_DIR="$PROJECT_ROOT/venv"
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv "$VENV_DIR"
fi

# Activate virtual environment
source "$VENV_DIR/bin/activate"

# Install required packages
echo "📚 Installing required packages..."
pip install -r "$PROJECT_ROOT/requirements.txt" 2>/dev/null || echo "⚠️  requirements.txt not found, continuing..."

# Create the cron command
CRON_COMMAND="cd $PROJECT_ROOT && $VENV_DIR/bin/python3 $PYTHON_SCRIPT --run >> $LOG_FILE 2>> $ERROR_LOG"

# Set the cron schedule (9 AM daily)
CRON_SCHEDULE="0 9 * * *"

# Check if cron job already exists
echo "🔍 Checking existing cron jobs..."
CRON_EXISTS=$(crontab -l 2>/dev/null | grep -c "$PYTHON_SCRIPT" || echo "0")

if [ "$CRON_EXISTS" -gt 0 ]; then
    echo "⚠️  Cron job already exists. Would you like to replace it? (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        # Remove existing cron job
        (crontab -l 2>/dev/null | grep -v "$PYTHON_SCRIPT") | crontab -
    else
        echo "❌ Setup cancelled."
        exit 1
    fi
fi

# Add the new cron job
echo "⏰ Adding cron job for daily blog generation at 9 AM..."
(crontab -l 2>/dev/null; echo "$CRON_SCHEDULE $CRON_COMMAND") | crontab -

# Test the setup
echo "🧪 Testing blog automation..."
cd "$PROJECT_ROOT"
if $VENV_DIR/bin/python3 "$PYTHON_SCRIPT" --run --mock; then
    echo "✅ Test successful!"
else
    echo "❌ Test failed. Check the logs for details."
fi

echo ""
echo "✅ Blog automation setup complete!"
echo "📊 Configuration:"
echo "  - Schedule: Daily at 9:00 AM"
echo "  - Log file: $LOG_FILE"
echo "  - Error log: $ERROR_LOG"
echo "  - Python script: $PYTHON_SCRIPT"
echo ""
echo "📝 To manually run the blog generator:"
echo "  cd $PROJECT_ROOT && $VENV_DIR/bin/python3 $PYTHON_SCRIPT --run"
echo ""
echo "📊 To generate a report:"
echo "  cd $PROJECT_ROOT && $VENV_DIR/bin/python3 $PYTHON_SCRIPT --report"
echo ""
echo "⚙️  To view/edit configuration:"
echo "  cd $PROJECT_ROOT && $VENV_DIR/bin/python3 $PYTHON_SCRIPT --config get"
echo ""
echo "🔄 Cron job added successfully!"

# Deactivate virtual environment
deactivate