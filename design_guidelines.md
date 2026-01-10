# Design Guidelines: Women's Safety Platform

## Design Approach
**System-Based Approach**: Material Design principles for trust and accessibility, customized for safety-critical interactions. Drawing from Google Maps for familiar map patterns and Uber for location-based UI clarity.

## Core Design Principles
1. **Trust Through Clarity**: Clean, professional aesthetic that inspires confidence
2. **Safety-First Hierarchy**: Danger indicators must be immediately recognizable
3. **Mobile-Critical**: Platform will be used on-the-go; mobile layout is primary

---

## Typography
- **Primary Font**: Inter (Google Fonts) - modern, highly legible
- **Headings**: 600-700 weight, 1.5-2.5rem
- **Body**: 400 weight, 1rem with 1.5 line-height for readability
- **UI Labels**: 500 weight, 0.875rem
- **Map Markers**: 600 weight, 0.75-0.875rem

## Layout System
**Spacing Primitives**: Tailwind units of 2, 4, 6, and 8 for consistent rhythm
- Component padding: p-4 (mobile), p-6 (desktop)
- Section spacing: py-8 (mobile), py-12 (desktop)
- Card gaps: gap-4
- Map controls: Absolute positioned with m-4 offset

---

## Component Library

### Navigation
**Top Bar** (sticky):
- Logo left, emergency button right (always visible)
- Hamburger menu (mobile), horizontal nav (desktop)
- Glass morphism effect (semi-transparent with backdrop blur) when over map
- Height: h-16

### Map Interface (Hero Component)
**Full-height Interactive Map**:
- Occupies 60vh-70vh on mobile, 75vh-85vh on desktop
- Custom controls positioned absolute:
  - Search bar top-center with backdrop blur background
  - Location button bottom-right
  - Layer toggles top-right
  - Route panel slides in from bottom (mobile) or left sidebar (desktop)

**Map Markers**:
- Danger zones: Bold circular markers with warning icon
- Safe routes: Highlighted paths with distinct visual treatment
- User location: Pulsing indicator

### Information Cards
**Danger Report Cards**:
- Rounded corners (rounded-lg)
- Shadow elevation (shadow-md)
- Icon + severity badge + timestamp + description
- User avatar + report count for credibility
- Action buttons: View Details, Navigate Away

### Route Panel
**Sliding Panel Component**:
- Glass morphism background
- Route options listed vertically
- Each route shows: distance, estimated time, safety rating
- Visual safety indicator (icon-based rating system)

### Emergency Features
**SOS Button**:
- Fixed position, highly visible
- Large tap target (min 48px)
- High contrast treatment
- No hover states needed (always prominent)

### Community Section
**Safety Tips Grid**:
- 2-column grid (desktop), single column (mobile)
- Card-based layout with icons
- Helpful safety advice and reporting guidelines

### Footer
**Comprehensive Footer**:
- Emergency contacts prominently displayed
- Quick links to: Report Danger, Safe Routes, Community Guidelines
- Partner organizations logos
- Language selector
- Trust indicators (verified reports count, active users)

---

## Accessibility
- WCAG AAA contrast ratios for all danger indicators
- Screen reader labels for all map markers
- Keyboard navigation for map controls
- Focus indicators on all interactive elements
- Clear danger level hierarchy with both color AND iconography

---

## Images
**Hero Section**: NO traditional hero image. The interactive map IS the hero.

**Supporting Images**:
1. **Community Section**: Authentic photos of diverse women in urban settings (walking safely, using phones for navigation)
2. **Safety Tips Cards**: Simple iconographic illustrations
3. **Testimonial Section**: User avatars (can use avatar generator or illustrations)

All images should convey empowerment, community, and urban safety.

---

## Multi-Column Strategy
- **Feature Grid**: 3 columns (desktop), 1 column (mobile) for key features
- **Statistics Bar**: 4 columns showing: Total Reports, Active Users, Safe Routes, Cities Covered
- **Testimonials**: 2 columns (desktop), stacked (mobile)
- **Map View**: Single column focus - no competing elements

---

## Animations
**Minimal, Purposeful Only**:
- Map marker pulse for active dangers
- Smooth panel slide-ins
- Route path drawing animation
- No decorative animations

---

## Page Structure
1. Navigation (sticky)
2. Map Interface (primary focus, 70vh)
3. Quick Stats Bar (4-column grid)
4. How It Works (3-step process with icons)
5. Community Reports (card grid)
6. Safety Tips (2-column cards)
7. Trust Indicators (partner logos, statistics)
8. Footer (comprehensive)