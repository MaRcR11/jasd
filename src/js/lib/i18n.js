import en from './locales/en.js';
import de from './locales/de.js';
import fr from './locales/fr.js';
import es from './locales/es.js';
import it from './locales/it.js';
import pt from './locales/pt.js';
import ru from './locales/ru.js';
import zh from './locales/zh.js';
import ja from './locales/ja.js';
import ko from './locales/ko.js';
import ar from './locales/ar.js';
import tr from './locales/tr.js';
import pl from './locales/pl.js';
import nl from './locales/nl.js';
import sv from './locales/sv.js';
import cs from './locales/cs.js';
import da from './locales/da.js';
import el from './locales/el.js';
import fi from './locales/fi.js';
import hr from './locales/hr.js';
import hu from './locales/hu.js';
import id from './locales/id.js';
import nb from './locales/nb.js';
import ro from './locales/ro.js';
import sk from './locales/sk.js';
import th from './locales/th.js';
import uk from './locales/uk.js';
import vi from './locales/vi.js';
import ptBR from './locales/pt-BR.js';
import zhTW from './locales/zh-TW.js';

import { S } from '../state.js';

export const I18N = {
  en,
  de,
  fr,
  es,
  it,
  pt,
  ru,
  zh,
  ja,
  ko,
  ar,
  tr,
  pl,
  nl,
  sv,
  cs,
  da,
  el,
  fi,
  hr,
  hu,
  id,
  nb,
  ro,
  sk,
  th,
  uk,
  vi,
  'pt-BR': ptBR,
  'zh-TW': zhTW,
};

export function t(key) {
  return (I18N[S.lang] || I18N.en)[key] || key;
}

export function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (el.classList.contains('helper-note') || el.classList.contains('cookie-hint')) {
      el.innerHTML = val;
    } else {
      el.textContent = val;
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  const sel = document.getElementById('settLang');
  if (sel) sel.value = S.lang;
  document.documentElement.dir = S.lang === 'ar' ? 'rtl' : 'ltr';
}

export function detectSystemLang() {
  const raw = (navigator.language || navigator.userLanguage || 'en').toLowerCase();
  const full = raw.replace('_', '-');
  const normalized = Object.keys(I18N).find((k) => k.toLowerCase() === full);
  if (normalized) return normalized;
  const short = raw.slice(0, 2);
  return I18N[short] ? short : 'en';
}
