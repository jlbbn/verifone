# Banxico Plus - Financial Ticker Design Guidelines

## Project Overview
A financial data ticker application with horizontal scrolling text and interactive playback controls, displaying real-time financial information in a continuous, elegant marquee format.

## Design Approach
**Utility-Focused Financial Dashboard** - This is a data-display application where clarity, readability, and performance are paramount. The design prioritizes information delivery over decorative elements.

---

## Core Visual Specifications

### Color Palette
**Ticker Bar**
- Background: 0 0% 0% (pure black)
- Text: 0 0% 100% (pure white)
- High contrast for optimal readability of financial data

**Control Elements**
- Buttons: White borders with transparent backgrounds on dark base
- Slider track: Dark gray (0 0% 20%)
- Slider thumb: White (0 0% 100%)

### Typography
**Ticker Text**
- Font Family: Arial (system font for maximum compatibility)
- Font Size: 20px
- Font Weight: Normal (400)
- Color: #FFFFFF
- Letter Spacing: Normal

**Control Labels**
- Font Family: Arial
- Font Size: 14px
- Color: White or light gray for secondary text

### Layout System
**Ticker Bar**
- Height: 50px
- Width: 100% viewport width
- Position: Fixed at top of viewport
- Text vertical alignment: Centered

**Spacing**
- Message separation: 30px horizontal gap between ticker items
- Control panel padding: 20px top/bottom, 40px left/right
- Button spacing: 12px gap between controls

---

## Component Library

### Ticker Display
**Horizontal Scrolling Marquee**
- Direction: Right-to-left continuous scroll
- Animation: Smooth using requestAnimationFrame
- Default velocity: 2 pixels per frame
- Infinite loop: Auto-restart when messages complete cycle
- Messages: Financial data strings (e.g., "BTC/USD: $45,234", "TIIE 28 días: 11.15%")

**Message Array (Editable)**
```
Example messages from screenshot:
- "TIIE 28 días: 11.15%"
- "Dólar Spot: $20.34"
- "Cetes 28 días: 11.00%"
- "Inflación anual: 4.5%"
```

### Interactive Controls
**Pause/Resume Buttons**
- Style: Outlined buttons with white borders
- Background: Transparent with subtle hover states
- Icons or text: "Pause" / "Resume" or play/pause icons
- Functionality: Toggle ticker animation state

**Speed Control Slider**
- Type: Range input (HTML5 slider)
- Range: 0.5x to 5x speed multiplier
- Visual feedback: Display current speed value
- Real-time adjustment: Changes apply immediately to ticker

### Control Panel Layout
- Position: Below ticker bar or in bottom-right corner
- Background: Dark panel (0 0% 10%) with subtle border
- Responsive: Stack controls vertically on mobile

---

## Interaction Guidelines

### Ticker Behavior
- Continuous motion by default (auto-play on load)
- Seamless loop without visible restart
- Pause on user interaction (via pause button)
- Maintain position when paused, resume from same point

### Hover Effects (Optional Enhancement)
- Text opacity: Slight increase (0.7 → 1.0) on hover over individual items
- Cursor: Default (no pointer unless items are clickable)
- Underline: Subtle underline effect on hover if messages link to detail views

### Responsiveness
- Mobile: Reduce font size to 16px, ticker height to 40px
- Tablet: Maintain desktop specifications
- Controls: Stack vertically on screens < 640px

---

## Performance & Compatibility
- Use requestAnimationFrame for smooth 60fps animation
- Avoid CSS animations for horizontal scroll (JavaScript provides better control)
- GSAP optional for enhanced easing, but vanilla JS preferred for lightweight implementation
- Compatible with Chrome, Firefox, Safari, Edge (modern versions)

---

## File Structure Requirements
1. **index.html** - Main container, ticker bar div, control panel
2. **style.css** - All visual styling, layout, colors, typography
3. **script.js** - Animation logic, message array, control handlers

**Code Quality**
- Extensive comments explaining each function
- Editable parameters at top of script.js (velocity, messages array)
- Clean indentation and naming conventions
- No external dependencies beyond optional GSAP

---

## Visual Hierarchy
1. **Primary Focus**: Scrolling ticker with financial data
2. **Secondary**: Control panel for user interaction
3. **Tertiary**: Speed indicator and status labels

**Content Density**: Minimalist - only essential elements visible, no decorative graphics or hero sections. The ticker IS the hero element.

---

## Images
**No images required** - This is a pure data-display application. All visual impact comes from typography, motion, and high contrast color scheme.