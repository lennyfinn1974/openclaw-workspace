import React from 'react'

export function KanbanBoard() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <h1 className="text-xl font-semibold">Test Kanban Board</h1>
      </div>
      
      <div className="flex-1 overflow-x-auto p-6">
        <div className="flex gap-4 h-full">
          {/* Test Column 1 */}
          <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-gray-100 p-4">
            <h3 className="font-medium mb-4">To Do</h3>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium">Sample Task 1</h4>
                <p className="text-sm text-gray-600">This is a test task</p>
              </div>
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium">Sample Task 2</h4>
                <p className="text-sm text-gray-600">Another test task</p>
              </div>
            </div>
          </div>
          
          {/* Test Column 2 */}
          <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-blue-100 p-4">
            <h3 className="font-medium mb-4">In Progress</h3>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium">Working Task</h4>
                <p className="text-sm text-gray-600">Currently being worked on</p>
              </div>
            </div>
          </div>
          
          {/* Test Column 3 */}
          <div className="flex w-72 flex-shrink-0 flex-col rounded-lg bg-green-100 p-4">
            <h3 className="font-medium mb-4">Done</h3>
            <div className="space-y-2">
              <div className="p-3 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium">Completed Task</h4>
                <p className="text-sm text-gray-600">This task is finished</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-4 text-center text-sm text-gray-500">
        ✅ React is working! Drag-and-drop temporarily disabled for debugging.
      </div>
    </div>
  )
}