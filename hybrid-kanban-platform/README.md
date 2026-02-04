# 🚀 Hybrid Kanban Platform

A modern, hybrid Kanban platform that combines the beautiful design system from Lovable with local development control and direct OpenClaw integration.

![Hybrid Kanban Platform](https://img.shields.io/badge/Version-1.0.0-blue) ![React](https://img.shields.io/badge/React-18+-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6) ![Vite](https://img.shields.io/badge/Vite-5+-646CFF)

## ✨ Features

### 🎨 Beautiful Design System
- **Lovable-inspired UI**: Extracted and adapted the polished design system from Lovable
- **Modern aesthetics**: Clean, professional interface with carefully chosen colors and typography
- **Dark mode ready**: Full support for light and dark themes
- **Responsive design**: Works seamlessly on desktop, tablet, and mobile devices

### 📋 Core Kanban Functionality
- **Drag & drop**: Smooth task movement between columns with visual feedback
- **Task management**: Create, edit, delete, and organize tasks with priorities and due dates
- **Flexible boards**: Support for multiple boards and customizable columns
- **Rich task details**: Descriptions, tags, priorities, due dates, and comments
- **Real-time updates**: Instant UI updates with optimistic state management

### 🤖 OpenClaw Integration
- **Direct webhook integration**: No external dependencies, direct API communication
- **Real-time agent monitoring**: Track active, completed, and failed agents
- **Automated task creation**: Tasks automatically generated from OpenClaw agent activities
- **Agent status dashboard**: Comprehensive overview of all running agents
- **Token usage tracking**: Monitor AI model token consumption

### 🛠 Local Development Control
- **Fast hot reload**: Instant development feedback with Vite
- **Local data storage**: All data stored locally with Zustand persistence
- **No external services**: Complete independence from external APIs
- **TypeScript support**: Full type safety throughout the application
- **Modern toolchain**: React 18, Vite 5, Tailwind CSS 3

## 🏁 Quick Start

### Prerequisites
- Node.js 18+ 
- npm, yarn, or pnpm

### Installation

```bash
# Clone or navigate to the hybrid-kanban-platform directory
cd hybrid-kanban-platform

# Install dependencies
npm install

# Start development server
npm run dev
```

The platform will be available at `http://localhost:3001`

### Production Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## 🎯 Usage Guide

### Basic Kanban Operations

1. **Creating Tasks**
   - Click the `+` button in any column header
   - Enter a task title and press Enter
   - Edit the task to add descriptions, priorities, and due dates

2. **Moving Tasks**
   - Drag tasks between columns to change their status
   - Tasks automatically save their new position

3. **Task Management**
   - Click on any task to open the edit dialog
   - Set priorities (Low, Medium, High, Urgent)
   - Add due dates and tags
   - Write detailed descriptions

### OpenClaw Integration

1. **Connecting to OpenClaw**
   - Click "Connect to OpenClaw" in the status panel
   - The platform will automatically sync with your OpenClaw instance
   - View real-time agent activity and status

2. **Automated Tasks**
   - Enable "OpenClaw Automated Task" when editing tasks
   - These tasks will automatically update based on agent status
   - View agent progress directly in the Kanban board

3. **Webhook Configuration**
   - Use the webhook endpoint: `http://localhost:3001/api/webhooks/openclaw`
   - Configure this in your OpenClaw instance for real-time updates

## 🏗 Architecture

### Tech Stack
- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS + Custom Design System
- **State Management**: Zustand with persistence
- **Drag & Drop**: @hello-pangea/dnd
- **Icons**: Lucide React
- **UI Components**: Custom components based on Radix UI primitives

### Design System
The platform uses a carefully crafted design system extracted from Lovable:

```css
/* Color Palette */
--primary: hsl(234 89% 63%)        /* Refined indigo */
--secondary: hsl(220 14% 96%)      /* Soft gray-blue */
--accent: hsl(173 80% 40%)         /* Vibrant teal */

/* Priority Colors */
--priority-low: hsl(142 71% 45%)    /* Green */
--priority-medium: hsl(38 92% 50%)  /* Yellow */
--priority-high: hsl(25 95% 53%)    /* Orange */
--priority-urgent: hsl(0 84% 60%)   /* Red */

/* Column Colors */
--column-todo: hsl(220 14% 96%)     /* Light gray */
--column-progress: hsl(199 89% 96%) /* Light blue */
--column-review: hsl(38 92% 96%)    /* Light yellow */
--column-done: hsl(142 71% 96%)     /* Light green */
```

### State Management
- **Kanban Store**: Manages boards, columns, tasks, and comments
- **OpenClaw Store**: Handles agent connections, webhooks, and real-time updates
- **Persistence**: Automatic local storage with Zustand persist middleware

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# Development
VITE_APP_NAME="Hybrid Kanban Platform"
VITE_OPENCLAW_ENDPOINT="http://localhost:8080"

# Production
VITE_BUILD_MODE="production"
```

### OpenClaw Integration
1. Configure webhook URL in OpenClaw: `http://localhost:3001/api/webhooks/openclaw`
2. Enable the following webhook events:
   - `agent.created`
   - `agent.started`
   - `agent.completed`
   - `agent.failed`
   - `task.updated`

## 🤝 Contributing

This platform was designed to be easily extensible. Key areas for contribution:

- **New integrations**: Connect to other AI platforms or project management tools
- **Enhanced UI**: Additional components and design improvements
- **Real-time features**: WebSocket connections for multi-user collaboration
- **Mobile app**: React Native version for mobile devices

## 📈 Roadmap

- [ ] **Multi-user support**: Real-time collaboration with WebSocket
- [ ] **Project templates**: Pre-configured board layouts
- [ ] **Advanced filtering**: Search and filter tasks by various criteria
- [ ] **Analytics dashboard**: Task completion metrics and time tracking
- [ ] **Export/Import**: JSON and CSV data exchange
- [ ] **Plugin system**: Extensible architecture for custom integrations

## 🛡 Security & Privacy

- **Local-first**: All data stored locally, no external tracking
- **No analytics**: Zero telemetry or usage tracking
- **Secure connections**: HTTPS support for production deployments
- **Data encryption**: Optional encryption for sensitive project data

## 📝 License

This project is open source and available under the MIT License.

## 🙋 Support

For questions, issues, or feature requests:

1. Check the documentation above
2. Review existing GitHub issues
3. Create a new issue with detailed information
4. Join the community discussions

---

**Built with ❤️ combining the best of Lovable's design system with OpenClaw's powerful AI integration capabilities.**