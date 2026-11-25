import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enLocale from '../../locales/en.json';
import esLocale from '../../locales/es.json';
import { getInitialLanguage, useRovStore } from '../store/rovStore';
import type { Language } from '../types/domain';

const initialLng: Language = getInitialLanguage();

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: {
      es: { translation: esLocale },
      en: { translation: enLocale },
    },
    lng: initialLng,
    fallbackLng: 'es',
    interpolation: {
      escapeValue: false,
    },
  });
}

let syncing = false;

useRovStore.subscribe((state, prevState) => {
  if (state.language !== prevState.language && !syncing && i18n.language !== state.language) {
    syncing = true;
    try {
      void i18n.changeLanguage(state.language);
    } finally {
      syncing = false;
    }
  }
});

i18n.on('languageChanged', (lng) => {
  if (syncing) return;
  const normalized: Language = lng.startsWith('en') ? 'en' : 'es';
  if (useRovStore.getState().language !== normalized) {
    syncing = true;
    try {
      useRovStore.getState().setLanguage(normalized);
    } finally {
      syncing = false;
    }
  }
});

export default i18n;
