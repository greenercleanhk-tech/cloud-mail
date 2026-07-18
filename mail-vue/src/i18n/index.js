import { createI18n } from 'vue-i18n';
import en from './en.js'
import zh from './zh.js'
import cn from './cn.js'
const i18n = createI18n({
    legacy: false,
    messages: {
        zh,
        en,
        cn
    },
});

export default i18n;