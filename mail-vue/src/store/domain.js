/**
 * domain store - 域名狀態管理
 * 使用 Pinia 管理當前選中的域名
 */
import { defineStore } from 'pinia';

export const useDomainStore = defineStore('domain', {
  state: () => ({
    // 當前選中的域名 ID
    currentDomainId: null,
    // 當前選中的域名信息
    currentDomain: null,
    // 域名列表（從 API 獲取）
    domainList: []
  }),

  getters: {
    // 是否已選擇域名
    hasSelectedDomain: (state) => !!state.currentDomainId,

    // 獲取當前域名顯示名
    currentDomainName: (state) => {
      return state.currentDomain?.displayName || state.currentDomain?.domain || '';
    }
  },

  actions: {
    // 設置當前域名
    setCurrentDomain(domainId, domainInfo = null) {
      this.currentDomainId = domainId;
      if (domainInfo) {
        this.currentDomain = domainInfo;
      }
    },

    // 更新域名列表
    setDomainList(list) {
      this.domainList = list;
    },

    // 清除當前選擇
    clearCurrentDomain() {
      this.currentDomainId = null;
      this.currentDomain = null;
    },

    // 根據 ID 查找域名信息
    getDomainById(domainId) {
      return this.domainList.find(d => d.domainId === domainId) || null;
    }
  },

  // 持久化到 localStorage（可選）
  persist: false
});
