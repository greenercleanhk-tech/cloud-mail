<template>
  <div class="account-box">
    <div class="head-opt">
      <Icon v-perm="'account:add'" class="icon add" icon="ion:add-outline" width="23" height="23" @click="add"/>
      <Icon class="icon refresh" icon="ion:reload" width="18" height="18" @click="refresh"/>
    </div>
    <el-scrollbar class="scrollbar" ref="scrollbarRef">
      <div v-infinite-scroll="getAccountList" :infinite-scroll-distance="600" :infinite-scroll-immediate="false">
        <el-card class="item" :class="itemBg(item.accountId)" v-for="(item, index) in accounts" :key="item.accountId"
                 @click="changeAccount(item)">
          <div class="account">
            {{ item.email }}
          </div>
          <div class="opt">
            <div class="send-email" @click.stop>
              <Icon @click="setAllReceive(item)" v-if="!item.allReceive" icon="eva:email-fill" width="22" height="22" color="#fccb1a"/>
              <Icon @click="setAllReceive(item)" v-else icon="flat-color-icons:folder" width="22" height="22" color="#23c4f1" />
            </div>
            <div class="settings" @click.stop>
              <Icon icon="fluent-color:clipboard-24" width="22" height="22" @click.stop="copyAccount(item.email)"/>
              <Icon icon="fluent:settings-24-filled" width="21" height="21" color="#909399"
                    v-if="showNullSetting(item)"/>
              <el-dropdown v-else>
                <Icon icon="fluent:settings-24-filled" width="21" height="21" color="#909399"/>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-if="hasPerm('email:send')" @click="openSetName(item)">{{ $t('rename') }}</el-dropdown-item>
                    <el-dropdown-item v-if="item.accountId !== userStore.user.account.accountId" @click="setAsTop(item, index)">{{ $t('pin') }}</el-dropdown-item>
                    <el-dropdown-item v-if="item.accountId !== userStore.user.account.accountId && hasPerm('account:delete')"
                                      @click="remove(item)">{{ $t('delete') }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
        </el-card>

        <!-- Initial Loading Skeleton -->
        <template v-if="loading">
          <el-skeleton v-for="i in skeletonRows" :key="i" animated>
            <template #template>
              <el-card class="item">
                <el-skeleton-item variant="p" style="width: 70%; height: 20px; margin-bottom: 25px"/>
                <div style="display: flex; justify-content: space-between">
                  <el-skeleton-item variant="text" style="width: 20px"/>
                  <el-skeleton-item variant="text" style="width: 20px"/>
                </div>
              </el-card>
            </template>
          </el-skeleton>
        </template>

        <!-- Follow Loading Skeleton -->
        <template v-if="accounts.length > 0 && !noLoading">
          <el-skeleton animated>
            <template #template>
              <el-card class="item">
                <el-skeleton-item variant="p" style="width: 70%; height: 20px; margin-bottom: 20px"/>
                <div style="display: flex; justify-content: space-between">
                  <el-skeleton-item variant="text" style="width: 20px"/>
                  <el-skeleton-item variant="text" style="width: 20px"/>
                </div>
              </el-card>
            </template>
          </el-skeleton>
        </template>

        <div class="noLoading" v-if="noLoading && accounts.length > 0">
          <div>{{ $t('noMoreData') }}</div>
        </div>
        <div class="empty" v-if="noLoading && accounts.length === 0">
          <el-empty :description="$t('noMessagesFound')"/>
        </div>
      </div>

    </el-scrollbar>
    <el-dialog v-model="showAdd" :title="$t('addAccount')" width="520px">
      <!-- 模式切換 -->
      <div class="add-mode-toggle" style="margin-bottom:16px;display:flex;gap:8px;align-items:center;">
        <span style="font-size:13px;color:#666;">{{ $t('addMode') }}：</span>
        <el-radio-group v-model="addMode" size="small">
          <el-radio-button value="single">{{ $t('addModeSingle') }}</el-radio-button>
          <el-radio-button value="batch">{{ $t('addModeBatch') }}</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 單一模式 -->
      <div v-if="addMode === 'single'" class="container">
        <el-input v-model="addForm.email" ref="addRef" type="text" :placeholder="$t('emailAccount')" autocomplete="off">
          <template #append>
            <div @click.stop="openSelect">
              <el-select
                  ref="mySelect"
                  v-model="addForm.suffix"
                  :placeholder="$t('select')"
                  class="select"
              >
                <el-option
                    v-for="item in domainList"
                    :key="item.domainId"
                    :label="item.domain"
                    :value="item"
                />
              </el-select>
              <div>
                <span>{{ addForm.suffix?.domain }}</span>
                <Icon class="setting-icon" icon="mingcute:down-small-fill" width="20" height="20"/>
              </div>
            </div>
          </template>
        </el-input>
      </div>

      <!-- 批量模式 -->
      <div v-if="addMode === 'batch'" class="container">
        <!-- 域名選擇 -->
        <div style="margin-bottom:8px;">
          <el-select v-model="addForm.suffix" :placeholder="$t('selectDomain')" style="width:100%">
            <el-option
                v-for="item in domainList"
                :key="item.domainId"
                :label="item.domain"
                :value="item"
            />
          </el-select>
        </div>
        <!-- 批量輸入框 -->
        <el-input
            v-model="addForm.batchText"
            type="textarea"
            :rows="6"
            :placeholder="$t('batchEmailPlaceholder')"
            style="font-family:monospace"
        />
        <!-- 預覽 -->
        <div v-if="batchPreview.length" style="margin-top:8px;font-size:12px;color:#67c23a;line-height:1.6;word-break:break-all;">
          <div style="color:#999;margin-bottom:4px;">{{ $t('batchPreview') }} ({{ batchPreview.length }}{{ $t('accounts') }}）：</div>
          <span v-for="(email, i) in batchPreview.slice(0, 10)" :key="i">{{ email }}<br/></span>
          <span v-if="batchPreview.length > 10" style="color:#999">...{{ $t('andMore', { n: batchPreview.length - 10 }) }}</span>
        </div>
      </div>

      <div style="margin-top:16px;display:flex;gap:8px;">
        <el-button class="btn" type="primary" @click="submit" :loading="addLoading">{{ $t('add') }}</el-button>
        <el-button @click="showAdd = false">{{ $t('cancel') }}</el-button>
      </div>
      <div
          class="add-email-turnstile"
          :class="verifyShow ? 'turnstile-show' : 'turnstile-hide'"
          :data-sitekey="settingStore.settings.siteKey"
          data-callback="onTurnstileSuccess"
          data-error-callback="onTurnstileError"
      >
        <span style="font-size: 12px;color: #F56C6C" v-if="botJsError">{{ $t('verifyModuleFailed') }}</span>
      </div>
    </el-dialog>
    <el-dialog v-model="setNameShow" :title="$t('changeUserName')">
      <div class="container">
        <el-input v-model="accountName" type="text" :placeholder="$t('username')" autocomplete="off">
        </el-input>
        <el-button class="btn" type="primary" @click="setName" :loading="setNameLoading"
        >{{ $t('save') }}
        </el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script setup>
import {Icon} from "@iconify/vue";
import {computed, nextTick, reactive, ref, watch} from "vue";
import {
  accountList,
  accountAdd,
  accountDelete,
  accountSetName,
  accountSetAllReceive,
  accountSetAsTop
} from "@/request/account.js";
import {sleep} from "@/utils/time-utils.js"
import {isEmail} from "@/utils/verify-utils.js";
import {useSettingStore} from "@/store/setting.js";
import {useAccountStore} from "@/store/account.js";
import {useEmailStore} from "@/store/email.js";
import {useDomainStore} from "@/store/domain.js";
import {useUserStore} from "@/store/user.js";
import {hasPerm} from "@/perm/perm.js"
import {useI18n} from "vue-i18n";
import {AccountAllReceiveEnum} from "@/enums/account-enum.js";

const {t} = useI18n();
const userStore = useUserStore();
const accountStore = useAccountStore();
const settingStore = useSettingStore();
const emailStore = useEmailStore();
const domainStore = useDomainStore();
const showAdd = ref(false)
const addLoading = ref(false);
const domainList = computed(() => domainStore.domainList)
const accounts = reactive([])
const noLoading = ref(false)
const loading = ref(false)
const followLoading = ref(false);
const verifyShow = ref(false)
const setNameShow = ref(false)
const setNameLoading = ref(false)
const accountName = ref(null)
const addRef = ref({})
const scrollbarRef = ref({})
let account = null
let turnstileId = null
const botJsError = ref(false)
let verifyToken = ''
let verifyErrorCount = 0
let first = true
const addMode = ref('single')  // 'single' | 'batch'
const addForm = reactive({
  email: '',
  suffix: null,  // 完整 domain 對象 {domainId, domain}
  batchText: ''  // 批量模式：一行一個前綴
})

// 批量模式預覽
const batchPreview = computed(() => {
  if (addMode.value !== 'batch' || !addForm.batchText.trim() || !addForm.suffix) return [];
  const domain = typeof addForm.suffix === 'string'
    ? addForm.suffix
    : addForm.suffix?.domain || '';
  const domainStr = domain.startsWith('@') ? domain : '@' + domain;
  return addForm.batchText
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
    .map(p => p + domainStr)
    .filter(e => isEmail(e));
});

// 根據 suffix 字串查找對應的 domainId
function getDomainIdBySuffix() {
  return addForm.suffix?.domainId || domainStore.currentDomainId;
}
let skeletonRows = 10
const queryParams = {
  size: 30
}

const mySelect = ref()

if (hasPerm('account:query')) {
  getAccountList()
}

watch(() => accountStore.changeUserAccountName, () => {
  accounts[0].name = accountStore.changeUserAccountName
})

watch(() => domainStore.domainList, (list) => {
  if (!addForm.suffix && list.length > 0) {
    addForm.suffix = list[0]  // 完整 domain 對象
  }
}, {immediate: true})

// 監聽域名切換 → 重新載入該域名的帳號列表
watch(() => domainStore.currentDomainId, (newDomainId) => {
  if (newDomainId) {
    accountStore.currentAccountId = 0;
    accountStore.currentAccount = null;
    accounts.length = 0;
    noLoading.value = false;
    getAccountList();
  }
});


const openSelect = () => {
  mySelect.value.toggleMenu()
}

window.onTurnstileError = (e) => {
  if (verifyErrorCount >= 4) {
    return
  }
  verifyErrorCount++
  console.warn('人机验加载失败', e)
  setTimeout(() => {
    nextTick(() => {
      if (!turnstileId) {
        turnstileId = window.turnstile.render('.add-email-turnstile')
      } else {
        window.turnstile.reset(turnstileId);
      }
    })
  }, 1500)
};

window.onTurnstileSuccess = (token) => {
  verifyToken = token;
};

function getSkeletonRows() {
  if (accounts.length > 20) return skeletonRows = 20
  if (accounts.length === 0) return skeletonRows = 1
  skeletonRows = accounts.length
}

function setName() {

  let name = accountName.value

  if (name === account.name) {
    setNameShow.value = false
    return
  }

  if (!name) {
    ElMessage({
      message: t('emptyUserNameMsg'),
      type: 'error',
      plain: true,
    })
    return;
  }

  setNameLoading.value = true
  accountSetName(account.accountId, name).then(() => {
    account.name = name
    setNameShow.value = false

    if (account.accountId === userStore.user.account.accountId) {
      userStore.user.name = name
    }

    ElMessage({
      message: t('saveSuccessMsg'),
      type: "success",
      plain: true
    })
  }).finally(() => {
    setNameLoading.value = false
  })
}

function openSetName(accountItem) {
  accountName.value = accountItem.name
  account = accountItem
  setNameShow.value = true
}

function setAllReceive(account) {
  let allReceiveAccount = accounts.find(account => account.allReceive === AccountAllReceiveEnum.ENABLED);
  if (allReceiveAccount && allReceiveAccount.accountId !== account.accountId) allReceiveAccount.allReceive = AccountAllReceiveEnum.DISABLED;
  account.allReceive = account.allReceive === AccountAllReceiveEnum.DISABLED ? AccountAllReceiveEnum.ENABLED : AccountAllReceiveEnum.DISABLED;
  accountSetAllReceive(account.accountId).catch(() => {
    account.allReceive = account.allReceive === AccountAllReceiveEnum.DISABLED ? AccountAllReceiveEnum.ENABLED : AccountAllReceiveEnum.DISABLED;
    if (allReceiveAccount) allReceiveAccount.allReceive = AccountAllReceiveEnum.ENABLED;
  }).then(() => {
    if (account.allReceive === AccountAllReceiveEnum.ENABLED) {
      ElMessage({
        message: t('setSuccess'),
        type: 'success',
        plain: true,
      })
    }
    changeAccount(account);
    emailStore.emailScroll?.refreshList();
    emailStore.sendScroll?.refreshList();
  })
}


function showNullSetting(item) {
  return !hasPerm('email:send') && !(item.accountId !== userStore.user.account.accountId && hasPerm('account:delete'))
}

function itemBg(accountId) {
  return accountStore.currentAccountId === accountId ? 'item-choose' : ''
}



function remove(account) {
  ElMessageBox.confirm(t('delConfirm', {msg: account.email}), {
    confirmButtonText: t('confirm'),
    cancelButtonText: t('cancel'),
    type: 'warning'
  }).then(() => {
    accountDelete(account.accountId).then(() => {
      const index = accounts.findIndex(item => item.accountId === account.accountId);
      accounts.splice(index, 1);
      if (accounts.length < queryParams.size) {
        getAccountList()
      }
      ElMessage({
        message: t('delSuccessMsg'),
        type: 'success',
        plain: true,
      })
    })
  });
}

function refresh() {
  if (loading.value) {
    return
  }
  loading.value = false
  followLoading.value = false
  noLoading.value = false
  queryParams.accountId = 0
  queryParams.lastSort = null
  getSkeletonRows();
  scrollbarRef.value.setScrollTop(0)
  accounts.splice(0, accounts.length)
  getAccountList()
}

function changeAccount(account) {
  accountStore.currentAccountId = account.accountId
  accountStore.currentAccount = account
}

function add() {
  addForm.suffix = addForm.suffix || domainStore.domainList[0]
  showAdd.value = true
  setTimeout(() => {
    addRef.value.focus()
  }, 100)
}

function setAsTop(account, index) {
  accountSetAsTop(account.accountId).then(() => {
    ElMessage({
      message: t('setSuccess'),
      type: 'success',
      plain: true,
    })

    const [item] = accounts.splice(index, 1);
    accounts.splice(1, 0, item);

  });
}

async function copyAccount(account) {
  try {
    await navigator.clipboard.writeText(account);
    ElMessage({
      message: t('copySuccessMsg'),
      type: 'success',
      plain: true,
    })
  } catch (err) {
    console.error(`${t('copyFailMsg')}:`, err);
    ElMessage({
      message: t('copyFailMsg'),
      type: 'error',
      plain: true,
    })
  }
}

function getAccountList() {

  if (loading.value || followLoading.value || noLoading.value) return;

  if (accounts.length === 0) {
    loading.value = true
  } else {
    followLoading.value = true
  }

  let start = Date.now();

  const accountId = accounts.length > 0 ? accounts.at(-1).accountId : 0;
  const lastSort = accounts.length > 0 ? accounts.at(-1).sort : null;

  accountList(accountId, queryParams.size, lastSort, domainStore.currentDomainId).then(async list => {

    let end = Date.now();
    let duration = end - start;
    if (duration < 300) {
      await sleep(300 - duration)
    }

    if (list.length < queryParams.size) {
      noLoading.value = true
    }
    if (accounts.length === 0) {
      accountStore.currentAccount = list[0]
      accountStore.currentAccountId = list[0].accountId
    }

    accounts.push(...list)

    loading.value = false
    followLoading.value = false
    first = false
  }).catch(() => {
    loading.value = false
    followLoading.value = false
  })
}


async function submit() {

  // ========== 批量模式 ==========
  if (addMode.value === 'batch') {
    const emails = batchPreview.value;
    if (emails.length === 0) {
      ElMessage({ message: '請輸入有效的郵箱前綴（一行一個），並選擇域名', type: 'error', plain: true });
      return;
    }

    // 驗證turnstile（批量只有一種模式）
    if (!verifyToken && (settingStore.settings.addEmailVerify === 0 || (settingStore.settings.addEmailVerify === 2 && settingStore.settings.addVerifyOpen))) {
      triggerVerify();
      return;
    }

    addLoading.value = true;
    let success = 0, failed = 0;
    for (const fullEmail of emails) {
      try {
        const account = await accountAdd(fullEmail, verifyToken, getDomainIdBySuffix());
        accounts.push(account);
        success++;
        settingStore.settings.addVerifyOpen = account.addVerifyOpen;
      } catch (e) {
        failed++;
      }
      await new Promise(r => setTimeout(r, 500)); // 防流控
    }

    addLoading.value = false;
    showAdd.value = false;
    addForm.batchText = '';
    verifyToken = '';
    verifyShow.value = false;
    userStore.refreshUserInfo();
    ElMessage({ message: `成功添加 ${success} 個郵箱${failed > 0 ? `，失敗 ${failed} 個` : ''}`, type: "success", plain: true });
    return;
  }

  // ========== 單一模式（原有邏輯）==========
  if (!addForm.email) {
    ElMessage({ message: t('emptyEmailMsg'), type: "error", plain: true });
    return;
  }

  if (addForm.email.length < settingStore.settings.minEmailPrefix) {
    ElMessage({ message: t('minEmailPrefix', {msg: settingStore.settings.minEmailPrefix}), type: 'error', plain: true });
    return;
  }

  let suffixRaw = typeof addForm.suffix === 'string' ? addForm.suffix : (addForm.suffix?.domain || '');
  let suffixStr = suffixRaw.startsWith('@') ? suffixRaw : ('@' + suffixRaw);
  if (!suffixStr || suffixStr === '@') {
    if (domainStore.domainList.length > 0) {
      const firstDomain = domainStore.domainList[0].domain || '';
      suffixStr = firstDomain.startsWith('@') ? firstDomain : ('@' + firstDomain);
    }
  }

  const atIndex = addForm.email.indexOf('@');
  const localPart = atIndex >= 0 ? addForm.email.substring(0, atIndex) : addForm.email;
  const fullEmail = localPart + suffixStr;

  if (!suffixStr) {
    ElMessage({ message: '請先選擇域名', type: 'error', plain: true });
    return;
  }

  if (!isEmail(fullEmail)) {
    ElMessage({ message: t('notEmailMsg'), type: "error", plain: true });
    return;
  }

  if (!verifyToken && (settingStore.settings.addEmailVerify === 0 || (settingStore.settings.addEmailVerify === 2 && settingStore.settings.addVerifyOpen))) {
    triggerVerify();
    return;
  }

  addLoading.value = true;
  accountAdd(fullEmail, verifyToken, getDomainIdBySuffix()).then(account => {
    addLoading.value = false;
    showAdd.value = false;
    addForm.email = '';
    accounts.push(account);
    verifyToken = '';
    settingStore.settings.addVerifyOpen = account.addVerifyOpen;
    ElMessage({ message: t('addSuccessMsg'), type: "success", plain: true });
    verifyShow.value = false;
    userStore.refreshUserInfo();
  }).catch(res => {
    if (res.code === 400) {
      verifyToken = '';
      nextTick(() => { turnstileId = window.turnstile.render('.add-email-turnstile'); });
      verifyShow.value = true;
    }
    addLoading.value = false;
  });
}

function triggerVerify() {
  if (!verifyShow.value) {
    verifyShow.value = true;
    nextTick(() => {
      if (!turnstileId) {
        try { turnstileId = window.turnstile.render('.add-email-turnstile'); }
        catch (e) { botJsError.value = true; }
      } else {
        window.turnstile.reset('.add-email-turnstile');
      }
    });
  } else if (!botJsError.value) {
    ElMessage({ message: t('botVerifyMsg'), type: "error", plain: true });
  }
}
</script>
<style>
path[fill="#ffdda1"] {
  fill: #ffdd7d;
}
</style>
<style scoped lang="scss">
.account-box {

  border-right: 1px solid var(--el-border-color) !important;
  background-color: var(--el-bg-color);
  height: 100%;
  overflow: hidden;

  .head-opt {
    display: flex;
    align-items: center;
    height: 38px;
    box-shadow: var(--header-actions-border);
    padding-left: 10px;
    padding-right: 10px;

    .icon {
      cursor: pointer;
    }

    .refresh {
      margin-left: 10px;
    }

    .add {
      margin-left: 2px;
    }

    .head-opt:not(.add) .refresh {
      margin-left: 5px;
    }
  }

  .scrollbar {
    width: 100%;
    height: calc(100% - 38px);
    overflow: auto;
    @media (max-width: 767px) {
      height: calc(100% - 98px);
    }

    .empty {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    }

    .noLoading {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 10px 0;
      color: var(--secondary-text-color);
    }
  }

  .btn {
    width: 100%;
    margin-top: 15px;
  }

  .item {
    background-color: var(--el-bg-color);
    border-radius: 8px;
    padding: 12px 10px;
    margin-bottom: 10px;
    margin-left: 10px;
    margin-right: 10px;
    cursor: pointer;

    .account {
      font-weight: 600;
      margin-bottom: 20px;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .opt {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: #888;

      .settings {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .send-email {
        display: flex;
        align-items: center;
      }
    }

    :deep(.el-card__body) {
      padding: 0;
    }
  }

  .item:first-child {
    margin-top: 10px;
  }

  .item-choose {
    background: var(--choose-account-background);
  }
}


.setting-icon {
  position: relative;
  top: 6px;
}

:deep(.el-input-group__append) {
  padding: 0 !important;
  padding-left: 8px !important;
  background: var(--el-bg-color);
}

:deep(.el-dialog) {
  width: 400px !important;
  @media (max-width: 440px) {
    width: calc(100% - 40px) !important;
    margin-right: 20px !important;
    margin-left: 20px !important;
  }
}

.select {
  position: absolute;
  right: 30px;
  width: 100px;
  opacity: 0;
  pointer-events: none;
}

:deep(.el-pagination .el-select) {
  width: 100px;
  background: var(--el-bg-color);
}

.add-email-turnstile {
  margin-top: 15px;
}

.turnstile-show {
  opacity: 1;
}

.turnstile-hide {
  opacity: 0;
  pointer-events: none;
  position: fixed;
}

</style>
