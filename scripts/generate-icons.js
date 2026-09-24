import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

// 1. Base App Icon SVG (One UI Squircle with Vivid Contrast)
const baseSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#242428"/>
      <stop offset="50%" stop-color="#18181B"/>
      <stop offset="100%" stop-color="#0F0F12"/>
    </linearGradient>
    <linearGradient id="redGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3B30"/>
      <stop offset="100%" stop-color="#E31B23"/>
    </linearGradient>
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34D399"/>
      <stop offset="100%" stop-color="#059669"/>
    </linearGradient>
  </defs>

  <!-- Background container -->
  <rect width="512" height="512" rx="128" fill="url(#bgGrad)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.15" stroke-width="4"/>
  
  <!-- Outer Glow Ring -->
  <circle cx="256" cy="256" r="180" fill="#E31B23" fill-opacity="0.12"/>

  <!-- Shield Base -->
  <path d="M256 90 C340 130 400 136 420 144 C424 250 380 370 256 440 C132 370 88 250 92 144 C112 136 172 130 256 90 Z" 
        fill="#1C1C22" 
        stroke="#3A3A46" 
        stroke-width="8"/>

  <!-- Financial Flow Arcs -->
  <path d="M160 330 C190 300 230 320 260 260 C290 200 320 180 360 160" 
        fill="none" 
        stroke="url(#emeraldGrad)" 
        stroke-width="22" 
        stroke-linecap="round"/>
  <circle cx="360" cy="160" r="16" fill="url(#emeraldGrad)"/>

  <!-- Red Power Loop -->
  <path d="M170 220 C195 170 240 150 280 170 C325 190 340 240 315 285 C290 330 235 345 190 320" 
        fill="none" 
        stroke="url(#redGrad)" 
        stroke-width="20" 
        stroke-linecap="round"/>

  <!-- Center Core -->
  <circle cx="256" cy="256" r="30" fill="url(#redGrad)"/>
  <circle cx="256" cy="256" r="14" fill="#FFFFFF"/>
</svg>
`;

// 2. Dedicated Quick-Add Icon (Vibrant Red `#E31B23` with bold plus & coin)
const quickAddSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="qBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3B30"/>
      <stop offset="100%" stop-color="#C4121A"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#qBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Center Circle Base -->
  <circle cx="256" cy="256" r="148" fill="#FFFFFF" fill-opacity="0.18"/>

  <!-- Bold Plus Icon -->
  <path d="M256 150 L256 362 M150 256 L362 256" stroke="#FFFFFF" stroke-width="44" stroke-linecap="round" filter="url(#shadow)"/>
  
  <!-- Subtle Euro badge in bottom right corner -->
  <circle cx="392" cy="392" r="64" fill="#FFFFFF" filter="url(#shadow)"/>
  <text x="392" y="412" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Google Sans', sans-serif" font-size="56" font-weight="900" fill="#C4121A" text-anchor="middle">€</text>
</svg>
`;

// 3. Dedicated Scanner Icon (Vibrant Emerald / Cyan `#059669` with AI Sparkles & Camera)
const scanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#10B981"/>
      <stop offset="100%" stop-color="#047857"/>
    </linearGradient>
    <filter id="shadowS" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#sBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Receipt Outline -->
  <rect x="160" y="140" width="192" height="232" rx="20" fill="#FFFFFF" filter="url(#shadowS)"/>
  <rect x="190" y="180" width="132" height="14" rx="7" fill="#10B981" fill-opacity="0.5"/>
  <rect x="190" y="210" width="96" height="12" rx="6" fill="#047857" fill-opacity="0.4"/>
  <rect x="190" y="235" width="112" height="12" rx="6" fill="#047857" fill-opacity="0.4"/>
  <rect x="190" y="275" width="132" height="16" rx="8" fill="#047857"/>

  <!-- Camera / Viewfinder Corners -->
  <path d="M120 160 L120 120 L160 120" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M392 160 L392 120 L352 120" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M120 352 L120 392 L160 392" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M392 352 L392 392 L352 392" fill="none" stroke="#FFFFFF" stroke-width="26" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- AI Laser Scan Bar -->
  <line x1="140" y1="256" x2="372" y2="256" stroke="#FEF08A" stroke-width="12" stroke-linecap="round" filter="url(#shadowS)"/>
</svg>
`;

// 4. Dedicated What-If / Simulator Icon (Vibrant Indigo / Violet `#6366F1`)
const whatifSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="wBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#818CF8"/>
      <stop offset="100%" stop-color="#4F46E5"/>
    </linearGradient>
    <filter id="shadowW" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#wBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Sparkles & Simulation Crystal -->
  <circle cx="256" cy="256" r="110" fill="#FFFFFF" fill-opacity="0.15"/>
  <path d="M256 120 L276 216 L372 236 L276 256 L256 352 L236 256 L140 236 L236 216 Z" fill="#FFFFFF" filter="url(#shadowW)"/>
  <circle cx="360" cy="150" r="16" fill="#FDE047"/>
  <circle cx="150" cy="340" r="12" fill="#FDE047"/>
  <circle cx="370" cy="330" r="18" fill="#FFFFFF"/>
</svg>
`;

// 5. Dedicated Accounts & Funds Icon (Vibrant Amber / Gold `#F59E0B`)
const contiSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="cBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FBBF24"/>
      <stop offset="100%" stop-color="#D97706"/>
    </linearGradient>
    <filter id="shadowC" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000000" flood-opacity="0.3"/>
    </filter>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#cBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Bank / Temple Icon -->
  <path d="M256 130 L392 196 L120 196 Z" fill="#FFFFFF" filter="url(#shadowC)"/>
  <rect x="144" y="216" width="36" height="120" rx="8" fill="#FFFFFF" filter="url(#shadowC)"/>
  <rect x="218" y="216" width="36" height="120" rx="8" fill="#FFFFFF" filter="url(#shadowC)"/>
  <rect x="292" y="216" width="36" height="120" rx="8" fill="#FFFFFF" filter="url(#shadowC)"/>
  <rect x="366" y="216" width="36" height="120" rx="8" fill="#FFFFFF" filter="url(#shadowC)"/>
  <rect x="100" y="348" width="312" height="34" rx="10" fill="#FFFFFF" filter="url(#shadowC)"/>
</svg>
`;

async function generate() {
  console.log('Generating high quality raster PNG & vector SVG icons for Android PWA...');

  // Save standalone SVG files for highest quality vector rendering
  fs.writeFileSync(path.join(publicDir, 'app-icon.svg'), baseSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'quick-add-icon.svg'), quickAddSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'scan-icon.svg'), scanSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'whatif-icon.svg'), whatifSvg.trim());
  fs.writeFileSync(path.join(publicDir, 'conti-icon.svg'), contiSvg.trim());

  // Base icon renders
  await sharp(Buffer.from(baseSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(Buffer.from(baseSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(Buffer.from(baseSvg)).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(baseSvg)).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(Buffer.from(baseSvg)).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));

  // Maskable icon with safe zone margin for adaptive Android launchers
  await sharp(Buffer.from(baseSvg))
    .resize(400, 400)
    .extend({
      top: 56,
      bottom: 56,
      left: 56,
      right: 56,
      background: '#121212'
    })
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-512.png'));

  await sharp(Buffer.from(baseSvg))
    .resize(150, 150)
    .extend({
      top: 21,
      bottom: 21,
      left: 21,
      right: 21,
      background: '#121212'
    })
    .png()
    .toFile(path.join(publicDir, 'icon-maskable-192.png'));

  // 1. Quick Add Shortcut Icons
  await sharp(Buffer.from(quickAddSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'quick-add-icon-512.png'));
  await sharp(Buffer.from(quickAddSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'quick-add-icon.png'));
  await sharp(Buffer.from(quickAddSvg)).resize(96, 96).png().toFile(path.join(publicDir, 'quick-add-icon-96.png'));

  // 2. Scanner Shortcut Icons
  await sharp(Buffer.from(scanSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'scan-icon-512.png'));
  await sharp(Buffer.from(scanSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'scan-icon.png'));
  await sharp(Buffer.from(scanSvg)).resize(96, 96).png().toFile(path.join(publicDir, 'scan-icon-96.png'));

  // 3. What-If Shortcut Icons
  await sharp(Buffer.from(whatifSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'whatif-icon-512.png'));
  await sharp(Buffer.from(whatifSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'whatif-icon.png'));
  await sharp(Buffer.from(whatifSvg)).resize(96, 96).png().toFile(path.join(publicDir, 'whatif-icon-96.png'));

  // 4. Conti Shortcut Icons
  await sharp(Buffer.from(contiSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'conti-icon-512.png'));
  await sharp(Buffer.from(contiSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'conti-icon.png'));
  await sharp(Buffer.from(contiSvg)).resize(96, 96).png().toFile(path.join(publicDir, 'conti-icon-96.png'));

  console.log('All icons and shortcuts successfully generated!');
}

generate().catch(console.error);
