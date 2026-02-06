# Claude Code Implementation Brief: Apple-Inspired Website
**Task:** Build modern Apple-style website replica using extracted design patterns  
**Created:** 2026-02-04 | **Priority:** High

## 🎯 PROJECT OVERVIEW

**Mission:** Create a fully functional, Apple-inspired website that demonstrates design-to-code pipeline capabilities. This should rival Figma by shipping actual working code, not just static designs.

**Source Material:** 
- Complete design analysis: `apple-design-analysis.md`
- Component specifications: `apple-component-library.md`  
- Design DNA guide: `apple-vibe-synthesis.md`
- Reference screenshots: Browser captures from apple.com

## 🏗️ TECHNICAL REQUIREMENTS

### Tech Stack (Required):
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS + CSS Modules for custom components
- **Animations**: Framer Motion for smooth interactions
- **Icons**: Lucide React + custom SVG components
- **Images**: Next/Image with optimization and lazy loading
- **Typography**: Inter font (closest to SF Pro)
- **Deployment**: Production-ready Vercel configuration

### Performance Requirements:
- **Lighthouse Score**: 90+ for Performance, Accessibility, SEO
- **Core Web Vitals**: Green scores across the board
- **Loading**: Initial page load under 2 seconds
- **Images**: Optimized with WebP/AVIF formats
- **Responsive**: Perfect rendering on all device sizes

## 📄 PAGES TO BUILD

### 1. Homepage (`/`)
**Content Structure:**
- **Hero Section**: Seasonal campaign (Valentine's Day or similar)
- **iPhone Section**: Latest generation showcase with CTAs
- **iPad Section**: M3 chip messaging 
- **Apple Watch Section**: Health-focused messaging
- **Services Section**: Fitness+, Apple Card, Trade-in
- **Entertainment Section**: Apple TV+ content gallery
- **Footer**: Comprehensive site navigation

**Key Components:**
- Animated hero with decorative elements
- Product cards with hover effects
- Horizontal scrolling galleries  
- Smooth section transitions
- Mobile hamburger navigation

### 2. iPhone Product Page (`/iphone`)
**Content Structure:**
- **Product Navigation**: Horizontal family navigation
- **Product Grid**: iPhone 17 Pro, Air, 17, 16, 16e cards
- **Why Apple Section**: Trade-in, financing, support options
- **Feature Deep-dive**: Innovation, cameras, battery life sections
- **Ecosystem Integration**: iPhone + Mac, Watch, AirPods
- **Footer Navigation**: Product-specific links

**Key Components:**
- Interactive product comparison cards
- Expandable accordion sections
- Gallery navigation with previous/next
- Product configurator UI elements
- Cross-device integration showcase

### 3. Product Detail Page (choose one: `/iphone-17-pro`)
**Content Structure:**
- **Hero**: Large product imagery with key messaging
- **Features**: Scrollable sections with rich media
- **Specifications**: Technical details in Apple's style
- **Purchase Options**: Colors, storage, pricing, CTAs
- **Accessories**: Related products section

## 🎨 DESIGN IMPLEMENTATION GUIDE

### Color Palette (Use These Exact Values):
```css
/* Primary */
--apple-blue: #007AFF;
--apple-gray: #86868B;
--apple-gray-light: #F5F5F7;

/* Text */
--text-primary: #1D1D1F;
--text-secondary: #86868B;

/* Backgrounds */
--bg-primary: #FFFFFF;
--bg-secondary: #F5F5F7;
--bg-dark: #1D1D1F;
```

### Typography Scale:
- **Hero Headlines**: text-5xl (48px) font-bold
- **Section Headers**: text-3xl (30px) font-semibold  
- **Product Names**: text-2xl (24px) font-bold
- **Body Text**: text-base (16px) font-normal
- **Captions**: text-sm (14px) text-gray-600

### Spacing System:
- **Section Gaps**: 20-32 spacing (80-128px)
- **Component Gaps**: 8-16 spacing (32-64px)  
- **Element Gaps**: 4-6 spacing (16-24px)
- **Container Padding**: px-4 md:px-8 (16-32px)

## 🧱 COMPONENT IMPLEMENTATION PRIORITY

### Phase 1: Foundation Components
1. **AppleNavigation** - Global header with mobile menu
2. **AppleButton** - Primary/secondary button variants
3. **AppleSection** - Container with background options
4. **AppleFooter** - Multi-column footer with links

### Phase 2: Product Components
1. **AppleHero** - Campaign and product hero sections
2. **AppleProductCard** - Interactive product showcase cards
3. **AppleGallery** - Horizontal scrolling content sections
4. **AppleAccordion** - Expandable content sections

### Phase 3: Advanced Features  
1. **AppleProductNav** - Sticky product family navigation
2. **AppleColorPicker** - Product color selection interface
3. **ApplePricing** - Dynamic pricing with financing options
4. **AppleModal** - Search and overlay interfaces

## 📱 RESPONSIVE IMPLEMENTATION

### Breakpoints:
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */  
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile-First Patterns:
- **Navigation**: Hamburger menu with full-screen overlay
- **Cards**: Single column with full-width CTAs
- **Images**: Optimized aspect ratios for mobile viewing
- **Typography**: Larger base sizes for mobile readability
- **Touch**: All targets minimum 44x44px for accessibility

## 🎬 ANIMATION SPECIFICATIONS

### Micro-Interactions:
```css
/* Button Hover */
transform: translateY(-2px);
box-shadow: 0 4px 12px rgba(0,0,0,0.15);
transition: all 0.2s ease;

/* Card Hover */
transform: translateY(-4px);
box-shadow: 0 8px 24px rgba(0,0,0,0.12);

/* Page Load */
opacity: 0 → 1;
transform: translateY(20px) → translateY(0);
duration: 0.6s ease-out;
```

### Page Transitions:
- **Smooth scrolling** between sections
- **Staggered animations** for card grids
- **Progressive image loading** with fade-in
- **Parallax effects** on hero sections (subtle)

## 📐 LAYOUT ARCHITECTURE

### Homepage Structure:
```
Navigation (sticky)
├── Hero Section (Valentine's campaign)
├── iPhone Showcase Section  
├── iPad Showcase Section
├── Apple Watch Section
├── Services Section (Card, Trade-in)
├── Entertainment Gallery
└── Footer Navigation
```

### iPhone Page Structure:
```
Navigation (sticky)
├── Product Family Navigation
├── Hero ("Explore the lineup")
├── Product Grid (5 iPhone models)
├── Why Apple Section (6 benefits)
├── Feature Deep-dive (scrollable)  
├── Ecosystem Integration
└── Footer with Product Links
```

## 🛒 E-COMMERCE PATTERNS

### Apple's Purchase Flow Patterns:
1. **Product Discovery**: Visual browsing with clear comparisons
2. **Configuration**: Color and storage selection
3. **Value Addition**: Trade-in and financing prominent
4. **Trust Building**: "Why Apple" messaging
5. **Multiple CTAs**: "Learn more" + "Buy" options always present

### Pricing Display Patterns:
- **"From $999"** format for starting prices
- **Financing options** with monthly payments
- **Trade-in credits** as separate value props
- **Footnote references** for legal clarity
- **Multiple purchase paths** (Apple, carriers, etc.)

## 🎪 CONTENT CREATION GUIDELINES

### Product Copy Style:
- **Headlines**: Emotional benefits first ("Say hello to the latest generation")
- **Descriptions**: Feature benefits in user language ("ultimate way to watch your health")
- **Technical Details**: Simple explanations of complex technology
- **CTAs**: Action-oriented and specific ("Shop iPhone", "Learn more about iPad Air")

### Visual Content:
- **Product Images**: Clean white backgrounds, consistent lighting
- **Lifestyle Images**: Products in natural use contexts
- **Feature Illustrations**: Simple diagrams and icons
- **Video Content**: Auto-playing ambient loops (no sound)

## 🚀 IMPLEMENTATION CHECKLIST

### Must-Have Features:
- [ ] **Responsive Navigation** with mobile hamburger menu
- [ ] **Product Cards** with hover effects and color selection
- [ ] **Smooth Animations** for page transitions and interactions
- [ ] **Image Optimization** with Next/Image lazy loading  
- [ ] **Accessibility** with comprehensive ARIA implementation
- [ ] **SEO Optimization** with proper meta tags and semantic HTML
- [ ] **Performance** optimized for Core Web Vitals
- [ ] **Cross-browser** compatibility (Chrome, Safari, Firefox, Edge)

### Nice-to-Have Features:
- [ ] **Dark Mode** support with system preference detection
- [ ] **Parallax Scrolling** on hero sections
- [ ] **Product Configurator** with real-time price updates
- [ ] **Search Functionality** with Apple-style results
- [ ] **Shopping Cart** with Apple Card payment simulation
- [ ] **Keyboard Navigation** for full accessibility

## 📊 SUCCESS CRITERIA

### Design Fidelity:
- **Visual Match**: 90%+ similarity to Apple's current design language
- **Interaction Quality**: Smooth, responsive, premium feeling
- **Content Hierarchy**: Clear information architecture
- **Brand Consistency**: Cohesive experience across all pages

### Technical Excellence:
- **Performance**: Lighthouse scores 90+ across all metrics
- **Accessibility**: WCAG 2.1 AA compliance
- **Mobile Experience**: Perfect rendering on all device sizes
- **Code Quality**: Clean, maintainable, production-ready code

### Innovation Demonstration:
- **Speed**: Built in hours/days, not weeks
- **Quality**: Production-ready code with modern practices
- **Completeness**: Fully functional website, not just static mockups
- **Reusability**: Component library that can be extended

---

## 🎬 READY TO BUILD!

**All design patterns extracted and documented.**  
**All components specified with exact requirements.**  
**Ready for Claude Code to demonstrate why this pipeline rivals Figma.**

**Constraint Reminder:** NO API coding in this task - focus on frontend implementation using the extracted Apple design patterns to create a stunning, Apple-inspired website that showcases the power of design-to-code automation.