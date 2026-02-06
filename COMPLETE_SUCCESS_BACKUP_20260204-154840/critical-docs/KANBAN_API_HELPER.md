# 🎯 Kanban API Helper Functions

## 🚀 Create New Task

```bash
create_kanban_task() {
    local agent_id=$1
    local session_id=$2  
    local objective=$3
    local priority=${4:-"medium"}
    local label=${5:-"AI Task"}
    
    curl -X POST "http://localhost:3002/api/webhooks/openclaw" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"subagent.spawned\",
            \"agentId\": \"$agent_id\",
            \"sessionId\": \"$session_id\",
            \"data\": {
                \"objective\": \"$objective\",
                \"priority\": \"$priority\"
            },
            \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\",
            \"metadata\": {
                \"source\": \"openclaw-automation\",
                \"label\": \"$label\"
            }
        }" -s
}
```

## 🔄 Update Task Status

```bash
update_kanban_task() {
    local agent_id=$1
    local status=$2
    local progress=${3:-"Working on task"}
    
    curl -X POST "http://localhost:3002/api/webhooks/openclaw" \
        -H "Content-Type: application/json" \
        -d "{
            \"type\": \"task.updated\",
            \"agentId\": \"$agent_id\",
            \"data\": {
                \"status\": \"$status\",
                \"progress\": \"$progress\"
            },
            \"timestamp\": \"$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")\"
        }" -s
}
```

## 📊 Check Board Status

```bash
get_kanban_status() {
    curl -s "http://localhost:3002/api/data/live" | jq '.tasks | map({id, title, status, column: .columnId})'
}
```

## 🎯 Usage Examples

```bash
# Create a new coding task
create_kanban_task "nexus-fix-001" "security-session" "Fix Nexus security vulnerabilities" "urgent" "Security Fix"

# Update progress 
update_kanban_task "nexus-fix-001" "in_progress" "Implementing HMAC validation"

# Mark as complete
update_kanban_task "nexus-fix-001" "completed" "All Phase 1 security fixes implemented"
```