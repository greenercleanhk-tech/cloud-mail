import {useUserStore} from "@/store/user.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useDomainStore} from "@/store/domain.js";
import {loginUserInfo} from "@/request/my.js";
import {permsToRouter} from "@/perm/perm.js";
import router from "@/router";
import {websiteConfig} from "@/request/setting.js";
import {domainActive} from "@/request/domain.js";
import i18n from "@/i18n/index.js";

export async function init() {
    document.title = '\u200B'

    const settingStore = useSettingStore();
    const userStore = useUserStore();
    const accountStore = useAccountStore();
    const domainStore = useDomainStore();

    const token = localStorage.getItem('token');
    if (!settingStore.lang) {
        let lang = navigator.language.split('-')[0]
        lang = lang === 'zh' ? lang : 'en'
        settingStore.lang = lang
    }

    i18n.global.locale.value = settingStore.lang

    let setting = null;

    if (token) {
        const userPromise = loginUserInfo().catch(e => {
            console.error(e);
            return null;
        });

        // 並行：加載網站配置 + 登錄信息 + 域名列表（從數據庫）
        const [s, user, domainList] = await Promise.all([
            websiteConfig(),
            userPromise,
            domainActive().catch(() => [])
        ]);
        setting = s;
        settingStore.settings = setting;
        // settingStore.domainList 保持網站配置中的字符串格式（給 sys-setting / 登錄頁使用）
        settingStore.domainList = setting.domainList;
        // domainStore.domainList 使用數據庫中的域名對象列表（給 account/index.vue 使用）
        domainStore.setDomainList(domainList || []);
        document.title = setting.title;

        if (user) {
            accountStore.currentAccountId = user.account.accountId;
            accountStore.currentAccount = user.account;
            userStore.user = user;

            const routers = permsToRouter(user.permKeys);
            routers.forEach(routerData => {
                router.addRoute('layout', routerData);
            });
        }

    } else {
        setting = await websiteConfig();
        settingStore.settings = setting;
        // 無 token 時保持網站配置中的字符串格式（登錄頁使用）
        document.title = setting.title;
    }
}
