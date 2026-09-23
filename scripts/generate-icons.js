import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = path.resolve('public');

// 1. Base App Icon SVG (Full bleed maskable + standard)
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
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.12" stroke-width="4"/>
  
  <!-- Outer Glow Ring -->
  <circle cx="256" cy="256" r="180" fill="#E31B23" fill-opacity="0.08"/>

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

// 2. Dedicated Quick-Add Icon (Vibrant Red with Plus/Lightning for Home Screen)
const quickAddSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="qBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FF3B30"/>
      <stop offset="100%" stop-color="#C4121A"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#qBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Bold Plus Icon -->
  <path d="M256 140 L256 372 M140 256 L372 256" stroke="#FFFFFF" stroke-width="48" stroke-linecap="round"/>
  
  <!-- Subtle Euro / Coin watermark in bottom corner -->
  <circle cx="380" cy="380" r="64" fill="#FFFFFF" fill-opacity="0.2"/>
  <text x="380" y="398" font-family="sans-serif" font-size="52" font-weight="bold" fill="#FFFFFF" text-anchor="middle">€</text>
</svg>
`;

// 3. Dedicated Scanner Icon
const scanSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>

  <rect width="512" height="512" rx="128" fill="url(#sBg)"/>
  <rect x="8" y="8" width="496" height="496" rx="120" fill="none" stroke="#FFFFFF" stroke-opacity="0.25" stroke-width="4"/>

  <!-- Camera / Scan Viewfinder -->
  <path d="M160 160 L210 160 M160 160 L160 210" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
  <path d="M352 160 L302 160 M352 160 L352 210" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
  <path d="M160 352 L210 352 M160 352 L160 302" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
  <path d="M352 352 L302 352 M352 352 L352 302" stroke="#FFFFFF" stroke-width="28" stroke-linecap="round"/>
  
  <!-- Center Flash / AI Sparkle -->
  <line x1="180" y1="256" x2="332" y2="256" stroke="#60A5FA" stroke-width="12" stroke-linecap="round"/>
</svg>
`;

async function generate() {
  console.log('Generating PNG icons for Android & PWA...');

  // Base icon renders
  await sharp(Buffer.from(baseSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'icon-512.png'));
  await sharp(Buffer.from(baseSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'icon-192.png'));
  await sharp(Buffer.from(baseSvg)).resize(180, 180).png().toFile(path.join(publicDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(baseSvg)).resize(32, 32).png().toFile(path.join(publicDir, 'favicon-32x32.png'));
  await sharp(Buffer.from(baseSvg)).resize(16, 16).png().toFile(path.join(publicDir, 'favicon-16x16.png'));

  // Maskable icon with safe zone margin
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

  // Quick Add shortcut icon
  await sharp(Buffer.from(quickAddSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'quick-add-icon.png'));
  await sharp(Buffer.from(quickAddSvg)).resize(512, 512).png().toFile(path.join(publicDir, 'quick-add-icon-512.png'));

  // Scanner shortcut icon
  await sharp(Buffer.from(scanSvg)).resize(192, 192).png().toFile(path.join(publicDir, 'scan-icon.png'));

  console.log('All icons generated successfully!');
}

generate().catch(console.error);
