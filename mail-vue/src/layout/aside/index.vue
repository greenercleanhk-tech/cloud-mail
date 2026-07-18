<template>
  <el-scrollbar class="scroll">
    <div>
      <!-- 網站標題 -->
      <div class="title">
        <Icon icon="mdi:email-outline" width="24" height="24" />
        <div>{{ settingStore.settings.title }}</div>
      </div>

      <el-menu
        :collapse="false"
        text-color="#fff"
        active-text-color="#fff"
        style="margin-top: 10px"
        :default-active="activeIndex"
      >
        <!-- ========== 全局設置（固定，位於頂部）========== -->
        <div class="manage-title">
          <div>{{ $t('globalSettings') }}</div>
        </div>

        <!-- 營銷中心 -->
        <el-menu-item
          @click="router.push({ name: 'marketing' })"
          :class="{ 'choose-item': route.meta.name === 'marketing' }"
        >
          <Icon icon="heroicons:megaphone-20-solid" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{ $t('marketingCenter') }}</span>
        </el-menu-item>

        <!-- 通訊錄 -->
        <el-menu-item
          @click="router.push({ name: 'contacts' })"
          :class="{ 'choose-item': route.meta.name === 'contact' }"
        >
          <Icon icon="carbon:user-multiple" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{ $t('contacts') }}</span>
        </el-menu-item>

        <!-- 域名管理 -->
        <el-menu-item
          @click="router.push({ name: 'domain' })"
          :class="{ 'choose-item': route.meta.name === 'domain' }"
        >
          <Icon icon="mdi:web" width="20" height="20" />
          <span class="menu-name" style="margin-left: 21px">{{ $t('domainManagement') }}</span>
        </el-menu-item>

        <!-- 全部郵件（可選，跨域名）-->
        <el-menu-item
          v-perm="'all-email:query'"
          @click="router.push({ name: 'all-email' })"
          :class="{ 'choose-item': route.meta.name === 'all-email' }"
        >
          <Icon icon="fluent:mail-list-28-regular" width="22" height="22" />
          <span class="menu-name" style="margin-left: 20px">{{ $t('allMail') }}</span>
        </el-menu-item>

        <!-- 系統設置 -->
        <el-menu-item
          v-perm="'setting:query'"
          @click="router.push({ name: 'sys-setting' })"
          :class="{ 'choose-item': route.meta.name === 'sys-setting' }"
        >
          <Icon icon="eos-icons:system-ok-outlined" width="18" height="18" style="margin-left: 2px" />
          <span class="menu-name" style="margin-left: 22px">{{ $t('systemSettings') }}</span>
        </el-menu-item>

        <!-- ========== 分隔線 ========== -->
        <div class="menu-divider"></div>

        <!-- ========== 動態域名列表 ========== -->
        <template v-for="domainGroup in domainGroups" :key="domainGroup.domainId">

          <!-- 域名分组标题（可折叠）-->
          <div
            class="domain-group-title"
            :class="{ 'domain-group-active': isCurrentDomain(domainGroup.domainId) }"
            @click="toggleDomain(domainGroup.domainId)"
          >
            <Icon icon="mdi:web" width="18" height="18" />
            <span class="domain-label">
              {{ domainGroup.displayName || domainGroup.domain }}
            </span>
            <Icon
              :icon="expandedDomains.includes(domainGroup.domainId) ? 'carbon:chevron-up' : 'carbon:chevron-down'"
              width="16"
              height="16"
              class="chevron-icon"
            />
          </div>

          <!-- 域名下的子菜單（可折疊）-->
          <el-collapse-transition>
            <div v-show="expandedDomains.includes(domainGroup.domainId)" class="domain-submenu">
              <el-menu-item
                @click="goToEmail(domainGroup.domainId)"
                :class="{ 'choose-item': isCurrentPage('email', domainGroup.domainId) }"
              >
                <Icon icon="hugeicons:mailbox-01" width="20" height="20" />
                <span class="menu-name" style="margin-left: 21px">{{ $t('inbox') }}</span>
              </el-menu-item>

              <el-menu-item
                @click="goToSend(domainGroup.domainId)"
                :class="{ 'choose-item': isCurrentPage('send', domainGroup.domainId) }"
              >
                <Icon icon="cil:send" width="20" height="20" />
                <span class="menu-name" style="margin-left: 21px">{{ $t('sent') }}</span>
              </el-menu-item>

              <el-menu-item
                @click="goToDraft(domainGroup.domainId)"
                :class="{ 'choose-item': isCurrentPage('draft', domainGroup.domainId) }"
              >
                <Icon icon="ep:document" width="19" height="19" />
                <span class="menu-name" style="margin-left: 22px">{{ $t('drafts') }}</span>
              </el-menu-item>

              <el-menu-item
                @click="goToStar(domainGroup.domainId)"
                :class="{ 'choose-item': isCurrentPage('star', domainGroup.domainId) }"
              >
                <Icon icon="solar:star-line-duotone" width="20" height="20" />
                <span class="menu-name" style="margin-left: 21px">{{ $t('starred') }}</span>
              </el-menu-item>
            </div>
          </el-collapse-transition>

        </template>

      </el-menu>
    </div>
  </el-scrollbar>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import router from '@/router/index.js';
import { useRoute } from 'vue-router';
import { Icon } from '@iconify/vue';
import { useSettingStore } from '@/store/setting.js';
import { useDomainStore } from '@/store/domain.js';
import { domainActive } from '@/request/domain.js';

const settingStore = useSettingStore();
const route = useRoute();
const domainStore = useDomainStore();

// 動態域名列表
const domainGroups = ref([]);

// 已展開的域名
const expandedDomains = ref([]);

// 當前選中的域名
const currentDomainId = computed(() => domainStore.currentDomainId);

// 當前路由名
const activeIndex = computed(() => route.meta.name);

// 載入域名列表
async function loadDomains() {
  try {
    const res = await domainActive();
    domainGroups.value = res || [];

    // 如果還沒設置當前域名，且有域名列表，自動選第一個
    if (!domainStore.currentDomainId && domainGroups.value.length > 0) {
      const firstDomain = domainGroups.value[0];
      domainStore.setCurrentDomain(firstDomain.domainId);
      expandedDomains.value = [firstDomain.domainId];
    } else if (domainStore.currentDomainId) {
      // 確保當前域名在展開列表中
      if (!expandedDomains.value.includes(domainStore.currentDomainId)) {
        expandedDomains.value.push(domainStore.currentDomainId);
      }
    }
  } catch (e) {
    console.error('載入域名失敗', e);
  }
}

// 切換域名展開/折疊
function toggleDomain(domainId) {
  const index = expandedDomains.value.indexOf(domainId);
  if (index === -1) {
    expandedDomains.value.push(domainId);
  } else {
    expandedDomains.value.splice(index, 1);
  }
}

// 判斷是否為當前選中的域名
function isCurrentDomain(domainId) {
  return currentDomainId.value === domainId;
}

// 判斷是否為當前頁面
function isCurrentPage(pageName, domainId) {
  return route.meta.name === pageName && currentDomainId.value === domainId;
}

// 跳轉到收件箱
function goToEmail(domainId) {
  domainStore.setCurrentDomain(domainId);
  router.push({ name: 'email', query: { domainId } });
}

// 跳轉到已發送
function goToSend(domainId) {
  domainStore.setCurrentDomain(domainId);
  router.push({ name: 'send', query: { domainId } });
}

// 跳轉到草稿
function goToDraft(domainId) {
  domainStore.setCurrentDomain(domainId);
  router.push({ name: 'draft', query: { domainId } });
}

// 跳轉到收藏
function goToStar(domainId) {
  domainStore.setCurrentDomain(domainId);
  router.push({ name: 'star', query: { domainId } });
}

// 跳轉到分析
function goToAnalysis(domainId) {
  domainStore.setCurrentDomain(domainId);
  router.push({ name: 'analysis', query: { domainId } });
}

onMounted(() => {
  loadDomains();
});

// 監聽 settingStore.domainList 變化（域名新增/編輯/刪除後同步）
// 注意：settingStore.domainList 是字串陣列（如 ["@parkin.hk"]），
// domainGroups 是對象陣列，兩者格式不同，不要直接覆蓋
watch(
  () => settingStore.domainList,
  (newList) => {
    if (newList && newList.length > 0) {
      // 確保是有效的域名對象才更新（預防 settingQuery 返回空值時清掉側邊欄）
      const first = newList[0];
      if (typeof first === 'object' && first !== null && first.domainId) {
        domainGroups.value = newList;
        if (domainGroups.value.length === 1) {
          const firstDomain = domainGroups.value[0];
          domainStore.setCurrentDomain(firstDomain.domainId);
          if (!expandedDomains.value.includes(firstDomain.domainId)) {
            expandedDomains.value = [firstDomain.domainId];
          }
        }
      }
    }
  },
  { deep: true }
);
</script>

<style lang="scss" scoped>
.title {
  margin: 15px 10px;
  height: 45px;
  border-radius: 6px;
  display: flex;
  position: relative;
  font-size: 16px;
  font-weight: bold;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #ffffff;
  background: linear-gradient(135deg, #1890ff, #3a80dd);
  transition: all 0.3s ease;
  max-width: 240px;
  padding: 0 10px;

  > div {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    max-width: calc(240px - 20px - 30px);
  }
}

.domain-group-title {
  display: flex;
  align-items: center;
  padding: 8px 20px;
  margin: 5px 10px;
  border-radius: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  transition: all 0.2s;
  gap: 8px;

  &:hover {
    background: rgba(255, 255, 255, 0.08);
    color: #fff;
  }

  .domain-label {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chevron-icon {
    flex-shrink: 0;
  }
}

.domain-group-active {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-weight: 500;
}

.domain-submenu {
  margin-left: 10px;
}

.menu-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 10px 20px;
}

.manage-title {
  margin-top: 10px;
  padding-left: 20px;
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
}

.el-menu-item {
  margin: 5px 10px !important;
  border-radius: 6px;
  height: 36px;
  padding: 10px !important;
}

.choose-item {
  font-weight: bold;
  background: rgba(255, 255, 255, 0.08) !important;
  backdrop-filter: blur(4px);
}

@media (hover: hover) {
  .el-menu-item:hover {
    background: rgba(255, 255, 255, 0.08) !important;
  }
}

.menu-name {
  user-select: none;
}

:deep(.el-scrollbar__wrap--hidden-default) {
  background: var(--aside-backgound) !important;
}

:deep(.el-menu-item) {
  background: var(--aside-backgound);
}

:deep(.el-menu) {
  background: var(--aside-backgound);
}

.el-menu {
  border-right: 0;
  width: 260px;
}

.scroll {
  // default scrollbar styles handled by element-plus
}
</style>
