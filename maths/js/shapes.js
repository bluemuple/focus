// Shared SVG shape library used by the question bank and quiz screens.
// Every entry returns inline SVG markup. CSS fill classes (sh-pink, sh-red,
// sh-green, sh-blue, sh-purple, sh-yellow) are defined wherever this file
// is consumed.
window.SHAPES = {
  square:        `<svg viewBox="0 0 200 200"><rect x="40" y="40" width="120" height="120" class="sh-red"/></svg>`,
  rectangle:     `<svg viewBox="0 0 240 160"><rect x="20" y="30" width="200" height="100" class="sh-blue"/></svg>`,
  triangle:      `<svg viewBox="0 0 200 180"><polygon points="100,20 180,160 20,160" class="sh-green"/></svg>`,
  triangleDown:  `<svg viewBox="0 0 200 180"><polygon points="20,20 180,20 100,170" class="sh-green"/></svg>`,
  regPentagon:   `<svg viewBox="0 0 200 200"><polygon points="100,20 185,80 153,175 47,175 15,80" class="sh-pink"/></svg>`,
  regHexagon:    `<svg viewBox="0 0 220 200"><polygon points="60,20 160,20 210,100 160,180 60,180 10,100" class="sh-pink"/></svg>`,
  regOctagon:    `<svg viewBox="0 0 220 220"><polygon points="70,10 150,10 210,70 210,150 150,210 70,210 10,150 10,70" class="sh-blue"/></svg>`,
  parallelogram: `<svg viewBox="0 0 240 150"><polygon points="50,20 230,20 190,130 10,130" class="sh-red"/></svg>`,
  trapezium:     `<svg viewBox="0 0 240 150"><polygon points="50,20 190,20 230,130 10,130" class="sh-purple"/></svg>`,
  rhombus:       `<svg viewBox="0 0 200 200"><polygon points="100,15 185,100 100,185 15,100" class="sh-yellow"/></svg>`,
  circle:        `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="85" class="sh-blue"/></svg>`,
  irregPentagonHouse: `<svg viewBox="0 0 200 200"><polygon points="40,180 40,90 100,30 160,90 160,180" class="sh-green"/></svg>`,
  chevronRight:  `<svg viewBox="0 0 240 160"><polygon points="20,30 140,30 220,80 140,130 20,130 80,80" class="sh-blue"/></svg>`,
  chevronLeftArrow: `<svg viewBox="0 0 260 160"><polygon points="20,80 120,20 120,55 240,55 240,105 120,105 120,140" class="sh-green"/></svg>`,
  irregHexagonBook: `<svg viewBox="0 0 220 180"><polygon points="40,40 130,20 200,60 180,140 90,160 20,110" class="sh-pink"/></svg>`,
  lShape:        `<svg viewBox="0 0 200 200"><polygon points="20,20 120,20 120,100 180,100 180,180 20,180" class="sh-purple"/></svg>`,
};

// Common CSS for shape fills (inject into any page that displays shapes)
window.SHAPE_CSS = `
  .sh-pink   { fill: #d84a6b; }
  .sh-red    { fill: #d64b3b; }
  .sh-green  { fill: #6abf4c; }
  .sh-blue   { fill: #3aa0dc; }
  .sh-purple { fill: #5f4aa8; }
  .sh-yellow { fill: #e6c968; }
`;
