<template>
  <div class="domain-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h2>{{ $t('domainManagement') }}</h2>
      <el-button type="primary" @click="showAddDialog = true">
        <Icon icon="carbon:add" />
        {{ $t('addDomain') }}
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
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { domainList, domainAdd, domainUpdate, domainDelete } from '@/request/domain.js';

const loading = ref(false);
const submitting = ref(false);
const domainList = ref([]);
const showAddDialog = ref(false);
const editingDomain = ref(null);

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
    const res = await domainList();
    domainList.value = res.data.data || [];
  } catch (e) {
    ElMessage.error('載入域名失敗');
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
