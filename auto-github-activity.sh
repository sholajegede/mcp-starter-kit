#!/bin/bash

# Automated GitHub Activity Script
# This script creates daily commits to increase your GitHub activity

echo "🤖 Starting automated GitHub activity..."

# Create a log file to track changes
LOG_FILE="activity-log.txt"

# Function to create a random commit message
get_commit_message() {
    local messages=(
        "📝 Update documentation and examples"
        "🔧 Improve CLI user experience"
        "✨ Add new features and enhancements"
        "🐛 Fix minor bugs and issues"
        "📚 Update README with better instructions"
        "🚀 Optimize build process"
        "💡 Add helpful comments to code"
        "🔍 Improve error handling"
        "📦 Update dependencies"
        "🎨 Improve code formatting"
        "⚡ Performance improvements"
        "🛡️ Security enhancements"
        "📱 Mobile-friendly updates"
        "🌐 Internationalization improvements"
        "🔧 Configuration updates"
    )
    
    local random_index=$((RANDOM % ${#messages[@]}))
    echo "${messages[$random_index]}"
}

# Function to make a small change
make_small_change() {
    local change_type=$((RANDOM % 4))
    
    case $change_type in
        0)
            # Update timestamp in a file
            echo "# Last updated: $(date)" >> temp-update.txt
            ;;
        1)
            # Add a comment to package.json
            sed -i.bak 's/"version": "1.4.9"/"version": "1.4.9" \/\/ Auto-updated/' package.json
            ;;
        2)
            # Update README with timestamp
            echo "" >> README.md
            echo "<!-- Last auto-update: $(date) -->" >> README.md
            ;;
        3)
            # Create a small log entry
            echo "$(date): Automated update" >> $LOG_FILE
            ;;
    esac
}

# Function to clean up temporary changes
cleanup() {
    rm -f temp-update.txt
    rm -f package.json.bak
    # Remove the auto-comment from package.json
    sed -i.bak 's/ \/\/ Auto-updated//' package.json
    rm -f package.json.bak
}

# Main automation loop
for day in {1..7}; do
    echo "📅 Day $day: Creating automated activity..."
    
    # Make 2-4 commits per day
    commits_today=$((2 + RANDOM % 3))
    
    for commit in $(seq 1 $commits_today); do
        echo "  🔄 Commit $commit/$commits_today"
        
        # Make a small change
        make_small_change
        
        # Add and commit
        git add .
        commit_msg=$(get_commit_message)
        git commit -m "$commit_msg" --quiet
        
        # Small delay between commits
        sleep $((1 + RANDOM % 3))
    done
    
    # Push to GitHub (if remote is set)
    if git remote -v | grep -q origin; then
        echo "  🚀 Pushing to GitHub..."
        git push origin main --quiet
    fi
    
    # Clean up temporary files
    cleanup
    
    echo "  ✅ Day $day completed!"
    
    # Wait until next day (for demo, we'll use shorter intervals)
    if [ $day -lt 7 ]; then
        echo "  ⏰ Waiting for next day..."
        sleep 5  # In real scenario, this would be 24 hours
    fi
done

echo "🎉 Automated GitHub activity completed!"
echo "📊 Total commits made: $(git log --oneline | wc -l)"
echo "📈 Your GitHub activity should now show consistent green squares!"
