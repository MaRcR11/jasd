import { S } from '../state.js';
export const THEMES = {
  dark: {
    bg: '#0f0f11',
    bg2: '#17171b',
    bg3: '#1e1e24',
    bg4: '#27272f',
    border: '#2a2a35',
    bord2: '#33333f',
    text: '#e8e8f0',
    text2: '#9494a8',
    text3: '#5a5a72',
    accent: '#5b7cf6',
    'accent-h': '#7090ff',
    'accent-glow': 'rgba(91,124,246,.14)',
    success: '#3ecf8e',
    danger: '#ef5350',
    warn: '#f5a623',
  },
  light: {
    bg: '#f0f0f5',
    bg2: '#ffffff',
    bg3: '#f5f5fa',
    bg4: '#e8e8f0',
    border: '#d8d8e8',
    bord2: '#c8c8d8',
    text: '#1a1a2e',
    text2: '#5a5a7a',
    text3: '#9a9ab0',
    accent: '#5b7cf6',
    'accent-h': '#7090ff',
    'accent-glow': 'rgba(91,124,246,.12)',
    success: '#27ae60',
    danger: '#e74c3c',
    warn: '#e67e22',
  },
  midnight: {
    bg: '#000000',
    bg2: '#0a0a0a',
    bg3: '#111111',
    bg4: '#1a1a1a',
    border: '#222222',
    bord2: '#2a2a2a',
    text: '#ffffff',
    text2: '#888888',
    text3: '#444444',
    accent: '#7c5cf6',
    'accent-h': '#9b7bff',
    'accent-glow': 'rgba(124,92,246,.2)',
    success: '#00e676',
    danger: '#ff1744',
    warn: '#ff9100',
  },
  ocean: {
    bg: '#0a1628',
    bg2: '#0f2040',
    bg3: '#142855',
    bg4: '#1a3370',
    border: '#1e3d8a',
    bord2: '#2548a8',
    text: '#e0f0ff',
    text2: '#7099cc',
    text3: '#405580',
    accent: '#2196F3',
    'accent-h': '#42a5f5',
    'accent-glow': 'rgba(33,150,243,.15)',
    success: '#4CAF50',
    danger: '#f44336',
    warn: '#FF9800',
  },
};

export function applyTheme(name) {
  const root = document.documentElement;
  if (name === 'custom') {
    const custom = S.settings.customTheme || THEMES.dark;
    Object.entries(custom).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    root.dataset.theme = 'custom';
  } else {
    const theme = THEMES[name] || THEMES.dark;
    Object.entries(theme).forEach(([k, v]) => root.style.setProperty(`--${k}`, v));
    root.dataset.theme = name;
  }
  try {
    window.api.updateTitlebarOverlay(name);
  } catch {}
}
