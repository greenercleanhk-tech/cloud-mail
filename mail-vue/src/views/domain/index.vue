<template>
  <div class="domain-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h2>{{ $t('domainManagement') }}</h2>
      <el-button type="primary" @click="showAddDialog = true">
        <Icon icon="carbon:add" />
        {{ $t('addDomain') }}
      </el-button>
      <el-button type="success" @click="showBatchAddDialog = true" :disabled="domainList.length === 0">
        <Icon icon="carbon:add" />
        {{ $t('batchAddAccounts') }}
      </el-button>
    </div>

    <!-- 域名列表 -->
    <el-table :data="domainList" stripe style="width: 100%" v-loading="loading">
      <el-table-column prop="domain" :label="$t('domain')" min-width="150">
        <template #default="{ row }">
          <div class="domain-cell">
            <span class="domain-name">{{ row.domain }}</span>
            <el-tag v-if="row.isActive === 1" type="success" size="small">{{ $t('active') }}</el-tag>
            <el-tag v-else type="info" size="small">{{ $t('inactive') }}</el-tag>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="displayName" :label="$t('displayName')" width="130" />

      <el-table-column :label="$t('dnsStatus')" min-width="160">
        <template #default="{ row }">
          <div class="dns-status">
            <span class="dns-item">
              <span class="dns-label">MX:</span>
              <span :class="getStatusClass(row.mxStatus)">{{ row.mxStatus }}</span>
            </span>
            <span class="dns-item">
              <span class="dns-label">SPF:</span>
              <span :class="getStatusClass(row.spfStatus)">{{ row.spfStatus }}</span>
            </span>
            <span class="dns-item">
              <span class="dns-label">DKIM:</span>
              <span :class="getStatusClass(row.dkimStatus)">{{ row.dkimStatus }}</span>
            </span>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="createTime" :label="$t('createTime')" width="150" />

      <el-table-column :label="$t('mailboxCount')" width="72" align="center">
        <template #default="{ row }">
          <el-tag type="info" size="small">{{ row.mailboxCount ?? 0 }}</el-tag>
        </template>
      </el-table-column>

      <el-table-column :label="$t('activeJobCount')" width="72" align="center">
        <template #default="{ row }">
          <el-tag v-if="(row.activeJobCount ?? 0) > 0" type="warning" size="small">{{ row.activeJobCount }}</el-tag>
          <span v-else style="color:#c0c4cc">0</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('completedJobCount')" width="72" align="center">
        <template #default="{ row }">
          <el-tag v-if="(row.completedJobCount ?? 0) > 0" type="success" size="small">{{ row.completedJobCount }}</el-tag>
          <span v-else style="color:#c0c4cc">0</span>
        </template>
      </el-table-column>

      <el-table-column :label="$t('actions')" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">{{ $t('edit') }}</el-button>
          <el-button link type="success" @click="handleMailboxes(row)">{{ $t('mailboxes') }}</el-button>
          <el-button link type="danger" @click="handleDelete(row)">{{ $t('delete') }}</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加/編輯域名對話框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingDomain ? $t('editDomain') : $t('addDomain')"
      width="500px"
    >
      <el-form :model="formData" label-width="100px">
        <el-form-item :label="$t('domain')">
          <el-input v-model="formData.domain" :placeholder="$t('domainPlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('displayName')">
          <el-input v-model="formData.displayName" :placeholder="$t('displayNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('resendApiKey')">
          <el-input v-model="formData.resendApiKey" :placeholder="$t('resendApiKeyPlaceholder')" show-password />
        </el-form-item>
        <el-form-item :label="$t('customDomain')">
          <el-input v-model="formData.customDomain" :placeholder="$t('customDomainPlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('dailyLimit')">
          <el-input-number v-model="formData.dailyLimit" :min="1" :max="10000" />
          <span style="margin-left:8px;color:#999;font-size:12px">{{ $t('dailyLimitUnit') }}</span>
        </el-form-item>
        <el-form-item :label="$t('status')">
          <el-switch v-model="formData.isActive" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ $t('confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 域名郵箱統計對話框 -->
    <el-dialog v-model="showMailboxesDialog" :title="`${statsDomain?.domain ?? ''} - ${$t('mailboxStats')}`" width="900px">
      <div v-if="!mailboxesStats" style="text-align:center;padding:40px;color:#999">載入中...</div>
      <div v-else>
        <!-- 域名總覽 -->
        <div class="domain-stats-summary">
          <div class="stat-card" :class="getHealthClass(mailboxesStats.health)">
            <div class="stat-value">{{ mailboxesStats.health }}%</div>
            <div class="stat-label">{{ $t('domainHealth') }}</div>
          </div>
          <div class="stat-card stat-sent">
            <div class="stat-value">{{ mailboxesStats.totalSent }}</div>
            <div class="stat-label">{{ $t('totalSent') }}</div>
          </div>
          <div class="stat-card stat-delivered">
            <div class="stat-value">{{ mailboxesStats.totalDelivered }}</div>
            <div class="stat-label">{{ $t('totalDelivered') }}</div>
          </div>
          <div class="stat-card stat-bounced">
            <div class="stat-value">{{ mailboxesStats.totalBounced }}</div>
            <div class="stat-label">{{ $t('totalBounced') }}</div>
          </div>
          <div class="stat-card stat-unsub">
            <div class="stat-value">{{ mailboxesStats.totalUnsubscribed }}</div>
            <div class="stat-label">{{ $t('totalUnsubscribed') }}</div>
          </div>
        </div>

        <!-- 郵箱列表 -->
        <el-table :data="mailboxesStats.accounts" stripe size="small" style="margin-top:16px">
          <el-table-column prop="email" :label="$t('email')" min-width="200" />
          <el-table-column prop="name" :label="$t('senderName')" width="120" />
          <el-table-column :label="$t('status')" width="100" align="center">
            <template #default="{ row }">
              <el-switch
                :model-value="row.status === 'active'"
                @change="handleStatusChange(row, $event)"
                :loading="statusLoading === row.accountId"
                size="small"
                active-text="啟用"
                inactive-text="停用"
                inline-prompt
              />
            </template>
          </el-table-column>
          <el-table-column :label="$t('health')" width="100">
            <template #default="{ row }">
              <el-tag :type="getHealthTagType(row.health)" size="small">
                {{ row.health }}%
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="sent" :label="$t('sent')" width="80" align="center" />
          <el-table-column prop="delivered" :label="$t('delivered')" width="80" align="center" />
          <el-table-column prop="bounced" :label="$t('bounced')" width="80" align="center">
            <template #default="{ row }">
              <span :style="{ color: row.bounced > 0 ? '#E64340' : '' }">{{ row.bounced }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="unsubscribed" :label="$t('unsubscribed')" width="100" align="center" />
        </el-table>
      </div>
    </el-dialog>

    <!-- 批量添加郵箱對話框 -->
    <el-dialog v-model="showBatchAddDialog" :title="$t('batchAddAccounts')" width="580px">
      <div style="margin-bottom: 12px;">
        <span style="font-size:13px;color:#666;margin-right:8px;">{{ $t('selectDomain') }}：</span>
        <el-select v-model="batchForm.domainId" style="width: 260px;">
          <el-option
            v-for="d in domainList"
            :key="d.domainId"
            :label="d.domain"
            :value="d.domainId"
          />
        </el-select>
      </div>

      <el-input
        v-model="batchForm.prefixes"
        type="textarea"
        :rows="8"
        :placeholder="$t('batchEmailPlaceholder')"
        style="font-family: monospace"
      />

      <!-- 預覽 -->
      <div v-if="batchPreview.length" style="margin-top: 10px; font-size: 12px; color: #67c23a; line-height: 1.6; word-break: break-all;">
        <div style="color:#999; margin-bottom:4px;">{{ $t('batchPreview') }} ({{ batchPreview.length }}{{ $t('accounts') }})：</div>
        <span v-for="(e, i) in batchPreview.slice(0, 15)" :key="i">{{ e }}<br/></span>
        <span v-if="batchPreview.length > 15" style="color:#999">...{{ $t('andMore', { n: batchPreview.length - 15 }) }}</span>
      </div>

      <template #footer>
        <el-button @click="showBatchAddDialog = false">{{ $t('cancel') }}</el-button>
        <el-button type="success" @click="handleBatchAdd" :loading="batchLoading" :disabled="batchPreview.length === 0">
          {{ $t('confirmAdd') }} ({{ batchPreview.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { domainList as getDomainList, domainAdd, domainUpdate, domainDelete, domainStats } from '@/request/domain.js';
import { accountAdd, setAccountStatus } from '@/request/account.js';
import { useSettingStore } from '@/store/setting.js';
import { useDomainStore } from '@/store/domain.js';

const settingStore = useSettingStore();
const domainStore = useDomainStore();

const loading = ref(false);
const submitting = ref(false);
const domainList = ref([]);
const showAddDialog = ref(false);
const editingDomain = ref(null);
const showBatchAddDialog = ref(false);
const batchLoading = ref(false);

// 郵箱統計對話框
const showMailboxesDialog = ref(false);
const mailboxesStats = ref(null);
const statsDomain = ref(null);
const batchForm = reactive({
  domainId: null,
  prefixes: ''
});

// 批量預覽：把前綴加上域名後綴
const batchPreview = computed(() => {
  if (!batchForm.prefixes.trim() || !batchForm.domainId) return [];
  const domainRow = domainList.value.find(d => d.domainId === batchForm.domainId);
  if (!domainRow) return [];
  const suffix = '@' + domainRow.domain;
  return batchForm.prefixes
    .split('\n')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('#'))
    .map(p => (p.includes('@') ? p : p + suffix))
    .filter(e => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e));
});

const formData = reactive({
  domain: '',
  displayName: '',
  resendApiKey: '',
  customDomain: '',
  dailyLimit: 500,
  isActive: 1
});

// 獲取狀態樣式類
function getStatusClass(status) {
  const map = {
    ok: 'status-ok',
    pending: 'status-pending',
    failed: 'status-failed'
  };
  return map[status] || 'status-pending';
}

// 載入域名列表
async function loadDomains() {
  loading.value = true;
  try {
    const res = await getDomainList();
    // 確保是陣列，防後端返回 null 時表格變空
    const list = Array.isArray(res) ? res : [];
    domainList.value = list;
    // 同步到 settingStore，觸發側邊欄自動刷新
    settingStore.setDomainList(list);
    // 如果還沒有選中域名，自動選第一個
    if (!domainStore.currentDomainId && list.length > 0) {
      domainStore.setCurrentDomain(list[0].domainId);
    }
    // 除錯：載入後即時比對長度
    console.debug('[domain] loadDomains =>', list.length, 'domains', list.map(d => d.domain));
  } catch (e) {
    ElMessage.error('載入域名失敗：' + (e.message || String(e)));
  } finally {
    loading.value = false;
  }
}

// 打開編輯
function handleEdit(row) {
  editingDomain.value = row;
  Object.assign(formData, {
    domain: row.domain,
    displayName: row.displayName,
    resendApiKey: row.resendApiKey || '',
    customDomain: row.customDomain || '',
    dailyLimit: row.dailyLimit || 500,
    isActive: row.isActive
  });
  showAddDialog.value = true;
}

// 提交表單
async function handleSubmit() {
  if (!formData.domain) {
    ElMessage.warning('請輸入域名');
    return;
  }

  submitting.value = true;
  try {
    if (editingDomain.value) {
      await domainUpdate({
        domainId: editingDomain.value.domainId,
        ...formData
      });
      ElMessage.success('更新成功');
    } else {
      await domainAdd(formData);
      ElMessage.success('添加成功');
    }
    showAddDialog.value = false;
    editingDomain.value = null;
    resetForm();
    loadDomains();
  } catch (e) {
    ElMessage.error(e.message || '操作失敗');
  } finally {
    submitting.value = false;
  }
}

// 刪除
async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      `確定要刪除域名 ${row.domain} 嗎？`,
      '確認刪除',
      { type: 'warning' }
    );
    await domainDelete({ domainId: row.domainId });
    ElMessage.success('刪除成功');
    loadDomains();
  } catch (e) {
    if (e !== 'cancel') {
      ElMessage.error('刪除失敗');
    }
  }
}

// 域名健康度顏色
function getHealthClass(health) {
  if (health >= 90) return 'health-good';
  if (health >= 70) return 'health-warn';
  return 'health-bad';
}

function getHealthTagType(health) {
  if (health >= 90) return 'success';
  if (health >= 70) return 'warning';
  return 'danger';
}

// 打開名下郵箱統計
async function handleMailboxes(row) {
  statsDomain.value = row;
  mailboxesStats.value = null;
  showMailboxesDialog.value = true;
  try {
    const res = await domainStats({ domainId: row.domainId });
    mailboxesStats.value = res || null;
  } catch (e) {
    ElMessage.error('載入郵箱統計失敗：' + (e.message || String(e)));
  }
}

// 切換郵箱啟用/停用狀態
const statusLoading = ref(null);
async function handleStatusChange(row, enabled) {
  const newStatus = enabled ? 'active' : 'disabled';
  statusLoading.value = row.accountId;
  try {
    await setAccountStatus(row.accountId, newStatus);
    row.status = newStatus;
    // 同步更新 mailboxesStats 內的 accounts 狀態
    if (mailboxesStats.value?.accounts) {
      const acc = mailboxesStats.value.accounts.find(a => a.accountId === row.accountId);
      if (acc) acc.status = newStatus;
    }
    ElMessage.success(enabled ? '已啟用' : '已停用');
  } catch (e) {
    ElMessage.error('狀態更新失敗：' + (e.message || String(e)));
  } finally {
    statusLoading.value = null;
  }
}

// 重置表單
function resetForm() {
  Object.assign(formData, {
    domain: '',
    displayName: '',
    resendApiKey: '',
    customDomain: '',
    isActive: 1
  });
}

// 批量添加郵箱
async function handleBatchAdd() {
  const emails = batchPreview.value;
  if (!emails.length) {
    ElMessage.warning('請輸入有效的郵箱前綴');
    return;
  }
  batchLoading.value = true;
  let success = 0, failed = 0;
  const failedList = [];
  for (const email of emails) {
    try {
      await accountAdd(email, '', batchForm.domainId);
      success++;
    } catch (e) {
      failed++;
      failedList.push(email);
    }
    // 防流控
    await new Promise(r => setTimeout(r, 300));
  }
  batchLoading.value = false;
  showBatchAddDialog.value = false;
  batchForm.prefixes = '';
  ElMessage({
    message: `成功添加 ${success} 個${failed > 0 ? `，失敗 ${failed} 個` : ''}`,
    type: failed > 0 ? 'warning' : 'success',
    plain: true,
  });
  if (failedList.length) {
    console.warn('失敗郵箱：', failedList);
  }
}

onMounted(() => {
  loadDomains();
});
</script>

<style lang="scss" scoped>
.domain-container {
  padding: 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.domain-cell {
  display: flex;
  align-items: center;
  gap: 8px;

  .domain-name {
    font-weight: 500;
  }
}

.dns-status {
  display: flex;
  gap: 12px;

  .dns-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
  }

  .dns-label {
    color: #999;
  }
}

.status-ok { color: #67c23a; }
.status-pending { color: #e6a23c; }
.status-failed { color: #f56c6c; }

.domain-stats-summary {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-card {
  flex: 1;
  min-width: 100px;
  padding: 16px 12px;
  border-radius: 8px;
  text-align: center;
  background: #f5f7fa;
  border: 1px solid #ebeef5;

  .stat-value {
    font-size: 24px;
    font-weight: 700;
    color: #303133;
    line-height: 1.2;
  }

  .stat-label {
    font-size: 12px;
    color: #909399;
    margin-top: 6px;
  }

  &.health-good { background: #f0f9eb; border-color: #c2e7b0; .stat-value { color: #67c23a; } }
  &.health-warn  { background: #fdf6ec; border-color: #f5dab1; .stat-value { color: #e6a23c; } }
  &.health-bad   { background: #fef0f0; border-color: #fbc4c4; .stat-value { color: #f56c6c; } }
  &.stat-sent    { background: #ecf5ff; border-color: #b3d8fd; }
  &.stat-delivered { background: #f0f9eb; border-color: #c2e7b0; }
  &.stat-bounced  { background: #fef0f0; border-color: #fbc4c4; }
  &.stat-unsub    { background: #fdf6ec; border-color: #f5dab1; }
}
</style>
