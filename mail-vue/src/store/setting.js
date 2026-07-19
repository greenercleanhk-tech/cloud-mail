import { defineStore } from 'pinia'

export const useSettingStore = defineStore('setting', {
    state: () => ({
        domainList: [],
        settings: {
            r2Domain: '',
            loginOpacity: 1.00,
            loginDomain: 1,  // 1=隱藏域名下拉框，用戶輸入完整郵箱
        },
        lang: '',
    }),
    actions: {
        setDomainList(list) {
            this.domainList = list;
        },
    },
    persist: {
        pick: ['lang'],
    },
})
