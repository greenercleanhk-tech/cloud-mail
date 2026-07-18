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
      <el-table-column prop="domain" :label="$t('domain')" min-width="180">
        <template #default="{ row }">
          <div class="domain-cell">
            <span class="domain-name">{{ row.domain }}</span>
            <el-tag v-if="row.isActive === 1" type="success" size="small">{{ $t('active') }}</el-tag>
            <el-tag v-else type="info" size="small">{{ $t('inactive') }}</el-tag>
          </div>
        </template>
      </el-table-column>

      <el-table-column prop="displayName" :label="$t('displayName')" min-width="120" />

      <el-table-column :label="$t('dnsStatus')" min-width="200">
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

      <el-table-column prop="createTime" :label="$t('createTime')" width="160" />

      <el-table-column :label="$t('actions')" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="handleEdit(row)">{{ $t('edit') }}</el-button>
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
import { domainList as getDomainList, domainAdd, domainUpdate, domainDelete } from '@/request/domain.js';
import { accountAdd } from '@/request/account.js';
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

// 重置表單
function resetForm() {
  Object.assign(formData, {
    domain: '',
    displayName: '',
    resendApiKey: '',
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
</style>
