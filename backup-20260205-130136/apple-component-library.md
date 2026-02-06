# Apple-Inspired Component Library Specifications
**Created:** 2026-02-04 | **Based on:** apple.com analysis  
**Purpose:** Buildable component specifications for modern Apple-style website

## 🏗️ TECHNICAL ARCHITECTURE 

### CSS Framework Strategy
**Recommended Stack:**
- **Base**: Tailwind CSS for utility-first styling
- **Components**: CSS Modules for component-specific styles
- **Icons**: Inline SVG with multiple size variants
- **Fonts**: Inter (system fallback) or SF Pro if available
- **Animation**: CSS transitions + Framer Motion for complex animations

### Class Naming Convention
**Apple uses BEM-inspired naming:**
```css
/* Component-block__element--modifier pattern */
.globalnav-link
.globalnav-submenu-trigger-link  
.globalnav-link-text-container
.homepage-section
.collection-module
```

**Our Implementation:**
```css
/* Use Tailwind + component classes */
.apple-nav
.apple-nav__link
.apple-nav__submenu
.apple-card
.apple-card--premium
.apple-button
.apple-button--primary
```

## 🧱 CORE COMPONENTS

### 1. AppleNavigation Component
```tsx
interface AppleNavigationProps {
  logo: {
    href: string;
    ariaLabel: string;
  };
  menuItems: Array<{
    name: string;
    text: string;
    url: string;
    submenu?: Array<{name: string; text: string; url: string}>;
  }>;
  utilities: {
    search: boolean;
    cart: {enabled: boolean; itemCount?: number};
  };
  theme?: 'light' | 'dark';
}

// Visual Specs:
// - Height: 44px on desktop, 48px on mobile
// - Background: White with subtle bottom border
// - Typography: SF Pro Text, medium weight
// - Hover: Smooth background color transitions
// - Mobile: Hamburger menu with animated icon
```

### 2. AppleHero Component  
```tsx
interface AppleHeroProps {
  type: 'campaign' | 'product' | 'minimal';
  background?: {
    color?: string;
    gradient?: string;
    image?: string;
  };
  content: {
    headline: string;
    subline?: string;
    ctas: Array<{
      text: string;
      href: string;
      variant: 'primary' | 'secondary';
    }>;
  };
  media?: {
    src: string;
    alt: string;
    position?: 'center' | 'right' | 'left';
  };
  decorativeElements?: boolean; // For seasonal campaigns
}

// Visual Specs:
// - Min Height: 60vh on desktop, 50vh on mobile
// - Padding: 80px vertical, 40px horizontal
// - Typography: Large headline (48px+), medium subline
// - CTAs: Prominent blue button + outline secondary
// - Animation: Fade-in on load, parallax on scroll
```

### 3. AppleProductCard Component
```tsx
interface AppleProductCardProps {
  product: {
    name: string;
    shortName?: string; // For navigation breadcrumbs
    description: string[];
    image: {
      src: string;
      alt: string;
    };
    colors?: Array<{
      name: string;
      value: string; // Hex color
    }>;
    pricing: {
      main: string; // e.g., "From $999"
      financing?: string; // e.g., "or $41.62/mo. for 24 mo."
      footnote?: string;
    };
    ctas: {
      primary: {text: string; href: string};
      secondary: {text: string; href: string};
    };
  };
  theme?: 'light' | 'dark' | 'premium';
  layout?: 'horizontal' | 'vertical';
}

// Visual Specs:
// - Aspect Ratio: 4:3 for product images
// - Padding: 40px internal padding
// - Border Radius: 12px
// - Typography: Bold product name (24px), regular description (16px)
// - Colors: Display as small circles (24px diameter)
// - CTAs: Blue primary, outline secondary with arrow icons
// - Hover: Subtle lift effect (2px translate + shadow)
```

### 4. AppleButton Component
```tsx
interface AppleButtonProps {
  variant: 'primary' | 'secondary' | 'text' | 'minimal';
  size?: 'small' | 'medium' | 'large';
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  icon?: 'arrow' | 'chevron' | 'none';
  fullWidth?: boolean;
  disabled?: boolean;
}

// Visual Specs:
// PRIMARY: Blue background (#007AFF), white text, rounded corners (8px)
// SECONDARY: White background, blue border, blue text
// TEXT: No background, blue text, underline on hover
// MINIMAL: Subtle gray background, black text
// Icon: Arrow (→) or chevron (>), positioned right
// Padding: 16px horizontal, 12px vertical (medium)
// Animation: Scale on press (0.98), color transitions
```

### 5. AppleSection Component
```tsx
interface AppleSectionProps {
  heading?: {
    text: string;
    level: 1 | 2 | 3;
    alignment?: 'left' | 'center' | 'right';
  };
  content: React.ReactNode;
  background?: {
    color?: 'white' | 'gray' | 'black' | string;
    gradient?: string;
  };
  spacing?: 'compact' | 'normal' | 'large';
  container?: boolean; // Apply max-width container
}

// Visual Specs:
// - Max Width: 1200px (contained sections)
// - Padding: 80px vertical (large), 60px (normal), 40px (compact)
// - Typography: H2 section headings (36px), centered by default
// - Background: Subtle transitions between sections
```

### 6. AppleGallery Component
```tsx
interface AppleGalleryProps {
  items: Array<{
    id: string;
    content: React.ReactNode;
  }>;
  navigation?: {
    type: 'arrows' | 'dots' | 'tabs';
    position: 'bottom' | 'top' | 'sides';
  };
  autoplay?: {
    enabled: boolean;
    interval?: number;
  };
  responsive?: {
    mobile: number; // items per view
    tablet: number;
    desktop: number;
  };
}

// Visual Specs:
// - Smooth horizontal scrolling (CSS scroll-behavior)
// - Navigation arrows: Rounded, subtle shadow
// - Responsive: Single column on mobile, multiple on desktop
// - Touch: Swipe gestures supported
// - Indicators: Subtle dot navigation when applicable
```

### 7. AppleFooter Component
```tsx
interface AppleFooterProps {
  sections: Array<{
    heading: string;
    links: Array<{
      text: string;
      href: string;
    }>;
  }>;
  legal: {
    footnotes?: string[];
    copyright: string;
    policies: Array<{text: string; href: string}>;
  };
  localization?: {
    country: string;
    region: string;
    changeUrl: string;
  };
}

// Visual Specs:
// - Background: Light gray (#f5f5f7)
// - Typography: Small text (14px), multiple columns on desktop
// - Structure: Organized sections with clear hierarchy
// - Responsive: Accordion-style on mobile
// - Legal: Smallest text size for footnotes
```

## 🎨 DESIGN TOKENS

### Color System
```css
:root {
  /* Primary Colors */
  --apple-blue: #007AFF;
  --apple-blue-dark: #0051D5;
  --apple-gray: #86868B;
  --apple-gray-light: #F5F5F7;
  
  /* Text Colors */
  --text-primary: #1D1D1F;
  --text-secondary: #86868B;
  --text-tertiary: #D2D2D7;
  --text-inverse: #FFFFFF;
  
  /* Background Colors */
  --bg-primary: #FFFFFF;
  --bg-secondary: #F5F5F7;
  --bg-tertiary: #E8E8ED;
  --bg-dark: #1D1D1F;
  
  /* Product Colors (examples from iPhone page) */
  --cosmic-orange: #FF9500;
  --sky-blue: #56CCF2;
  --lavender: #B794F6;
  --deep-blue: #1B365D;
}
```

### Typography Scale
```css
:root {
  /* Font Sizes */
  --text-xs: 0.75rem;   /* 12px - footnotes */
  --text-sm: 0.875rem;  /* 14px - captions */
  --text-base: 1rem;    /* 16px - body */
  --text-lg: 1.125rem;  /* 18px - large body */
  --text-xl: 1.25rem;   /* 20px - small headings */
  --text-2xl: 1.5rem;   /* 24px - card headings */
  --text-3xl: 1.875rem; /* 30px - section headings */
  --text-4xl: 2.25rem;  /* 36px - page headings */
  --text-5xl: 3rem;     /* 48px - hero headings */
  
  /* Font Weights */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  
  /* Line Heights */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;
}
```

### Spacing Scale
```css
:root {
  /* Spacing (Apple uses generous whitespace) */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */
  --space-32: 8rem;     /* 128px */
}
```

### Border Radius & Shadows
```css
:root {
  /* Border Radius */
  --radius-sm: 0.125rem;  /* 2px */
  --radius: 0.375rem;     /* 6px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  
  /* Shadows (Apple uses very subtle shadows) */
  --shadow-xs: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

## 📐 LAYOUT PATTERNS

### Grid System
```scss
// Apple uses CSS Grid and Flexbox heavily
.apple-grid {
  display: grid;
  gap: var(--space-8);
  
  // Responsive columns
  grid-template-columns: 1fr; // Mobile
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(2, 1fr); // Tablet
  }
  
  @media (min-width: 1024px) {
    grid-template-columns: repeat(3, 1fr); // Desktop
  }
  
  @media (min-width: 1200px) {
    grid-template-columns: repeat(4, 1fr); // Large desktop
  }
}
```

### Container System
```scss
.apple-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 var(--space-4);
  
  @media (min-width: 768px) {
    padding: 0 var(--space-8);
  }
}

.apple-container--wide {
  max-width: 1440px;
}

.apple-container--narrow {
  max-width: 960px;
}
```

## 🎭 ANIMATION SPECIFICATIONS

### Micro-Interactions
```css
/* Button Hover Effects */
.apple-button {
  transition: all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.apple-button:hover {
  transform: translateY(-1px);
}

.apple-button:active {
  transform: scale(0.98);
}

/* Card Hover Effects */
.apple-card {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.apple-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
}

/* Gallery Transitions */
.apple-gallery {
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory;
}

.apple-gallery__item {
  scroll-snap-align: center;
}
```

### Page Transitions
```css
/* Page Load Animations */
@keyframes apple-fade-in {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.apple-animate-in {
  animation: apple-fade-in 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* Staggered Animations for Cards */
.apple-card:nth-child(1) { animation-delay: 0.1s; }
.apple-card:nth-child(2) { animation-delay: 0.2s; }
.apple-card:nth-child(3) { animation-delay: 0.3s; }
.apple-card:nth-child(4) { animation-delay: 0.4s; }
```

## 📱 RESPONSIVE DESIGN SYSTEM

### Breakpoints
```scss
$breakpoints: (
  'mobile': 0,
  'tablet': 768px,
  'desktop': 1024px,
  'wide': 1200px,
  'ultra': 1440px
);

// Mobile-first approach like Apple
@mixin mobile-up {
  @media (min-width: 768px) { @content; }
}

@mixin desktop-up {
  @media (min-width: 1024px) { @content; }
}
```

### Component Responsive Behavior
```scss
// Product Cards - Stack on mobile, grid on desktop
.apple-product-grid {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  
  @include mobile-up {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-8);
  }
  
  @include desktop-up {
    grid-template-columns: repeat(3, 1fr);
  }
}

// Navigation - Hamburger on mobile, horizontal on desktop  
.apple-nav__menu {
  display: none; // Hidden by default (mobile-first)
  
  @include mobile-up {
    display: flex;
    align-items: center;
    gap: var(--space-8);
  }
}

.apple-nav__mobile-trigger {
  @include mobile-up {
    display: none; // Hidden on desktop+
  }
}
```

## 🎯 CONTENT PATTERNS

### Apple Copy Style Guide
**Tone & Voice:**
- **Simple**: Use clear, jargon-free language
- **Confident**: State benefits directly 
- **Human**: "Say hello to..." vs "Introducing the..."
- **Benefit-focused**: What it does for you, not technical specs

**Headline Patterns:**
- **Product Launches**: "Say hello to [product name]"
- **Features**: "What makes it [adjective]." or "[Benefit]. [Technical backing]."
- **Seasonal**: "[Event/season] [emotional connection]"
- **Ecosystem**: "[Product] and [product]" integration stories

**CTA Patterns:**  
- **Primary**: "Buy" | "Shop [Product]" | "Learn more"
- **Secondary**: "Compare" | "Accessories" | "Get started"
- **Financing**: Always include financing options with footnotes

### Information Hierarchy
1. **Product Name** (largest, bold)
2. **Key Benefit** (medium, clear value prop)  
3. **Supporting Details** (smaller, technical or lifestyle context)
4. **Pricing** (prominent but not overwhelming)
5. **CTAs** (clear, action-oriented)
6. **Footnotes** (smallest, legal/technical details)

## 🔧 IMPLEMENTATION UTILITIES

### Apple Icon System
```tsx
// Icon component with Apple's multi-size approach
interface AppleIconProps {
  name: string;
  size: 'regular' | 'compact' | 'small' | 'large';
  color?: string;
}

// Examples of Apple's icon usage:
// - Search: Magnifying glass (regular: 15x44, compact: 17x48)
// - Cart: Shopping bag outline
// - Chevron: Navigation arrows (right-pointing)
// - Close: X with circle background
// - Menu: Hamburger with animated lines
```

### Accessibility Patterns (from Apple's implementation)
```tsx
// Apple's accessibility approach:
interface AccessibilityProps {
  ariaLabel: string;
  role?: string;
  ariaDescribedBy?: string;
  ariaExpanded?: boolean;
  tabIndex?: number;
}

// Key patterns observed:
// - Comprehensive aria-label usage
// - Role definitions for complex components  
// - Focus management for keyboard navigation
// - Screen reader optimizations
// - High contrast mode support
```

## 🌐 CONTENT MANAGEMENT STRUCTURE

### Page Types & Templates
**Homepage Template:**
- Hero section (seasonal campaign)
- Product showcase sections (3-4 major products)
- Entertainment/services section  
- Cross-sell opportunities
- Footer with comprehensive navigation

**Product Page Template:**
- Product family navigation
- Hero with product overview
- Feature breakdown ("Get to know [product]")
- Purchase options ("Why Apple is the best place to buy")
- Ecosystem integrations ("Significant others")
- Specifications footer

**Component Page Template:**
- Navigation breadcrumbs
- Product comparison grid
- Feature deep-dives with media
- Accessories and cross-sell
- Support and services links

---

## 🚀 READY FOR CLAUDE CODE IMPLEMENTATION

### Next Steps:
1. Create Next.js app with Tailwind CSS
2. Implement core components using these specifications
3. Build Apple-inspired homepage with real content
4. Add responsive behavior and animations
5. Test cross-browser compatibility and performance

**All specifications are ready for Claude Code to build a modern, Apple-inspired website that demonstrates OpenClaw's Figma-rival capabilities.**