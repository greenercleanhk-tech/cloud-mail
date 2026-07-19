<template>
  <div class="contact-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h2>{{ $t('contactManagement') }}</h2>
      <div class="header-actions">
        <el-button @click="showGroupDialog = true">
          <Icon icon="carbon:folder" />
          {{ $t('manageGroups') }}
        </el-button>
        <el-button type="primary" @click="showAddDialog = true">
          <Icon icon="carbon:add" />
          {{ $t('addContact') }}
        </el-button>
        <el-button type="success" @click="showImportDialog = true">
          <Icon icon="carbon:document-import" />
          {{ $t('importCsv') }}
        </el-button>
      </div>
    </div>

    <div class="contact-layout">
      <!-- 左側：群組列表 -->
      <div class="group-panel">
        <div class="panel-title">{{ $t('groups') }}</div>
        <el-scrollbar style="height: calc(100vh - 200px)">
          <div
            class="group-item"
            :class="{ active: selectedGroupId === 0 }"
            @click="selectGroup(0)"
          >
            <Icon icon="carbon:user" width="18" />
            <span>{{ $t('allContacts') }}</span>
            <span class="count">{{ totalCount }}</span>
          </div>
          <div
            v-for="group in groups"
            :key="group.groupId"
            class="group-item"
            :class="{ active: selectedGroupId === group.groupId }"
            @click="selectGroup(group.groupId)"
          >
            <Icon icon="carbon:folder" width="18" />
            <span>{{ group.name }}</span>
            <span class="count">{{ group.memberCount }}</span>
          </div>
        </el-scrollbar>
      </div>

      <!-- 右側：聯絡人列表 -->
      <div class="contact-panel">
        <!-- 搜索框 + 批量操作 -->
        <div class="search-bar">
          <el-input
            v-model="keyword"
            :placeholder="$t('searchPlaceholder')"
            clearable
            @input="handleSearch"
          >
            <template #prefix>
              <Icon icon="carbon:search" />
            </template>
          </el-input>
          <el-button
            v-if="selectedContacts.length > 0"
            type="danger"
            @click="handleBatchDelete"
            style="margin-left: 12px;"
          >
            <Icon icon="carbon:trash-can" />
            刪除所選 ({{ selectedContacts.length }})
          </el-button>
          <el-button
            v-if="totalCount > 0"
            type="warning"
            @click="handleSelectAll"
            style="margin-left: 8px;"
          >
            {{ allCurrentPageSelected ? '取消全選' : '全選本頁' }}
          </el-button>
          <el-button
            v-if="totalCount > 0"
            type="danger"
            plain
            @click="handleDeleteAll"
            style="margin-left: 8px;"
          >
            <Icon icon="carbon:trash-can" />
            刪除全部 ({{ totalCount }})
          </el-button>
        </div>

        <!-- 聯絡人表格 -->
        <el-table ref="tableRef" :data="contacts" stripe style="width: 100%" v-loading="loading" @selection-change="handleSelectionChange">
          <el-table-column type="selection" width="40" />
          <el-table-column prop="name" :label="$t('name')" min-width="120" />
          <el-table-column prop="email" :label="$t('email')" min-width="180" show-overflow-tooltip />
          <el-table-column :label="$t('group')" width="120">
            <template #default="{ row }">
              {{ getGroupName(row.groupId) }}
            </template>
          </el-table-column>
          <el-table-column prop="remark" :label="$t('remark')" min-width="150" show-overflow-tooltip />
          <el-table-column :label="$t('actions')" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="handleEdit(row)">{{ $t('edit') }}</el-button>
              <el-button link type="danger" @click="handleDelete(row)">{{ $t('delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分頁 -->
        <div class="pagination">
          <span class="total-hint">共 {{ totalCount }} 條</span>
          <el-pagination
            v-model:current-page="page"
            :page-size="50"
            :total="totalCount"
            layout="prev, pager, next, total"
            @current-change="loadContacts"
          />
        </div>
      </div>
    </div>

    <!-- 添加/編輯聯絡人對話框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingContact ? $t('editContact') : $t('addContact')"
      width="500px"
    >
      <el-form :model="formData" label-width="80px">
        <el-form-item :label="$t('name')">
          <el-input v-model="formData.name" />
        </el-form-item>
        <el-form-item :label="$t('email')">
          <el-input v-model="formData.email" />
        </el-form-item>
        <el-form-item :label="$t('group')">
          <el-select v-model="formData.groupId" :placeholder="$t('selectGroup')">
            <el-option :value="0" :label="$t('noGroup')" />
            <el-option v-for="g in groups" :key="g.groupId" :value="g.groupId" :label="g.name" />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('remark')">
          <el-input v-model="formData.remark" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ $t('confirm') }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 群組管理對話框 -->
    <el-dialog v-model="showGroupDialog" :title="$t('manageGroups')" width="400px">
      <div class="group-list">
        <div v-for="group in groups" :key="group.groupId" class="group-list-item">
          <span>{{ group.name }}</span>
          <div>
            <el-button link type="primary" @click="editGroup(group)">{{ $t('edit') }}</el-button>
            <el-button link type="danger" @click="deleteGroup(group.groupId)">{{ $t('delete') }}</el-button>
          </div>
        </div>
      </div>
      <div class="add-group">
        <el-input v-model="newGroupName" :placeholder="$t('groupNamePlaceholder')" style="flex: 1" />
        <el-button type="primary" @click="handleAddGroup" :loading="groupSubmitting">
          {{ $t('add') }}
        </el-button>
      </div>
      <template #footer>
        <el-button @click="showGroupDialog = false">{{ $t('close') }}</el-button>
      </template>
    </el-dialog>

    <!-- CSV 批量導入對話框 -->
    <el-dialog v-model="showImportDialog" :title="$t('importCsv')" width="620px">
      <!-- 第一步：選擇群組 -->
      <div style="margin-bottom: 16px;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;">{{ $t('assignGroup') }}</div>
        <el-select v-model="importForm.groupId" style="width: 100%;">
          <el-option :value="0" :label="$t('noGroup')" />
          <el-option v-for="g in groups" :key="g.groupId" :value="g.groupId" :label="g.name" />
        </el-select>
      </div>

      <!-- 第二步：上傳 CSV -->
      <div style="margin-bottom: 12px;">
        <el-upload
          ref="uploadRef"
          :auto-upload="false"
          :limit="1"
          accept="text/csv,text/comma-separated-values,.csv"
          :on-change="handleFileChange"
          :on-remove="handleFileRemove"
          drag
        >
          <Icon icon="carbon:document-csv" width="40" height="40" style="color:#67c23a;" />
          <div style="font-size:13px;color:#666;margin-top:8px;">{{ $t('csvUploadTip') }}</div>
          <div style="font-size:12px;color:#999;margin-top:4px;">{{ $t('csvFormatTip') }}</div>
        </el-upload>
      </div>

      <!-- 第三步：預覽 -->
      <div v-if="importPreview.length" style="margin-top:12px;">
        <div style="font-size:13px;color:#666;margin-bottom:6px;">
          {{ $t('importPreview') }} ({{ importPreview.length }}{{ $t('contacts') }})：
        </div>
        <el-table :data="importPreview" stripe size="small" max-height="200" style="font-size:12px;">
          <el-table-column prop="name" :label="$t('name')" min-width="100" show-overflow-tooltip />
          <el-table-column prop="email" :label="$t('email')" min-width="180" show-overflow-tooltip />
          <el-table-column prop="remark" :label="$t('remark')" min-width="120" show-overflow-tooltip />
        </el-table>
        <div v-if="importInvalidCount > 0" style="margin-top:6px;font-size:12px;color:#f56c6c;">
          ⚠️ {{ $t('invalidRows', { n: importInvalidCount }) }}
        </div>
      </div>

      <template #footer>
        <el-button @click="showImportDialog = false">{{ $t('cancel') }}</el-button>
        <el-button
          type="success"
          @click="handleImport"
          :loading="importLoading"
          :disabled="importPreview.length === 0"
        >
          {{ $t('confirmImport') }} ({{ importPreview.length }})
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { useDomainStore } from '@/store/domain.js';
import {
  contactList, contactAdd, contactUpdate, contactDelete, contactBatchAdd,
  contactBatchDelete, contactBatchDeleteByFilter,
  groupList, groupAdd, groupUpdate, groupDelete
} from '@/request/contact.js';

const domainStore = useDomainStore();

const loading = ref(false);
const submitting = ref(false);
const groupSubmitting = ref(false);
const contacts = ref([]);
const groups = ref([]);
const totalCount = ref(0);
const page = ref(1);
const keyword = ref('');
const selectedGroupId = ref(0);
const selectedContacts = ref([]);
const allCurrentPageSelected = ref(false);
const showAddDialog = ref(false);
const showGroupDialog = ref(false);
const editingContact = ref(null);
const newGroupName = ref('');
const showImportDialog = ref(false);
const importLoading = ref(false);
const uploadRef = ref();
const tableRef = ref();
const importPreview = ref([]);
const importInvalidCount = ref(0);
const importForm = reactive({
  groupId: 0,
  rawContacts: []
});

const formData = reactive({
  name: '',
  email: '',
  groupId: 0,
  remark: ''
});

async function loadContacts() {
  loading.value = true;
  selectedContacts.value = [];
  allCurrentPageSelected.value = false;
  try {
    const res = await contactList({
      domainId: domainStore.currentDomainId || undefined,
      keyword: keyword.value,
      groupId: selectedGroupId.value,
      page: page.value
    });
    contacts.value = res?.list || res || [];
    totalCount.value = res?.total || 0;
  } catch (e) {
    ElMessage.error('載入失敗');
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  try {
    const res = await groupList({ domainId: domainStore.currentDomainId || undefined });
    groups.value = res || [];
  } catch (e) {
    console.error('載入群組失敗', e);
  }
}

function selectGroup(groupId) {
  selectedGroupId.value = groupId;
  page.value = 1;
  selectedContacts.value = [];
  allCurrentPageSelected.value = false;
  loadContacts();
}

function handleSearch() {
  page.value = 1;
  selectedContacts.value = [];
  allCurrentPageSelected.value = false;
  loadContacts();
}

function handleEdit(row) {
  editingContact.value = row;
  Object.assign(formData, {
    name: row.name,
    email: row.email,
    groupId: row.groupId,
    remark: row.remark || ''
  });
  showAddDialog.value = true;
}

async function handleSubmit() {
  if (!formData.email) {
    ElMessage.warning('請輸入郵箱');
    return;
  }
  submitting.value = true;
  try {
    const data = {
      ...formData,
      domainId: domainStore.currentDomainId
    };
    if (editingContact.value) {
      data.contactId = editingContact.value.contactId;
      await contactUpdate(data);
      ElMessage.success('更新成功');
    } else {
      await contactAdd(data);
      ElMessage.success('添加成功');
    }
    showAddDialog.value = false;
    editingContact.value = null;
    resetForm();
    loadContacts();
    loadGroups();
  } catch (e) {
    ElMessage.error(e.message || '操作失敗');
  } finally {
    submitting.value = false;
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`確定要刪除 ${row.name || row.email} 嗎？`, '確認刪除', { type: 'warning' });
    await contactDelete({ contactId: row.contactId });
    ElMessage.success('刪除成功');
    loadContacts();
    loadGroups();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('刪除失敗');
  }
}

function handleSelectionChange(rows) {
  selectedContacts.value = rows;
  allCurrentPageSelected.value = rows.length === contacts.value.length && contacts.value.length > 0;
}

async function handleBatchDelete() {
  if (!selectedContacts.value.length) return;
  try {
    await ElMessageBox.confirm(
      `確定要刪除所選的 ${selectedContacts.value.length} 個聯絡人嗎？`,
      '批量刪除',
      { type: 'warning' }
    );
    const ids = selectedContacts.value.map(r => r.contactId);
    await contactBatchDelete({ contactIds: ids });
    ElMessage.success(`已刪除 ${ids.length} 個聯絡人`);
    selectedContacts.value = [];
    loadContacts();
    loadGroups();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '刪除失敗');
  }
}

function handleSelectAll() {
  if (allCurrentPageSelected.value) {
    tableRef.value?.clearSelection();
    allCurrentPageSelected.value = false;
  } else {
    contacts.value.forEach(row => tableRef.value?.toggleRowSelection(row, true));
    allCurrentPageSelected.value = true;
  }
}

async function handleDeleteAll() {
  if (!totalCount.value) return;
  const filterDesc = selectedGroupId.value > 0
    ? `群組「${groups.value.find(g => g.groupId === selectedGroupId.value)?.name}」內`
    : keyword.value ? `關鍵字「${keyword.value}」篩選` : '所有';
  try {
    await ElMessageBox.confirm(
      `確定要刪除 ${filterDesc}的全部 ${totalCount.value} 個聯絡人嗎？此操作不可恢復！`,
      '危險操作',
      { type: 'warning', confirmButtonClass: 'el-button--danger' }
    );
    const params = {
      domainId: domainStore.currentDomainId
    };
    if (selectedGroupId.value > 0) params.groupId = selectedGroupId.value;
    if (keyword.value) params.keyword = keyword.value;
    const result = await contactBatchDeleteByFilter(params);
    const deleted = result?.count || totalCount.value;
    ElMessage.success(`已刪除 ${deleted} 個聯絡人`);
    selectedContacts.value = [];
    page.value = 1;
    loadContacts();
    loadGroups();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '刪除失敗');
  }
}

async function handleAddGroup() {
  if (!newGroupName.value) return;
  groupSubmitting.value = true;
  try {
    await groupAdd({
      name: newGroupName.value,
      domainId: domainStore.currentDomainId
    });
    ElMessage.success('添加成功');
    newGroupName.value = '';
    loadGroups();
  } catch (e) {
    ElMessage.error('添加失敗');
  } finally {
    groupSubmitting.value = false;
  }
}

function editGroup(group) {
  ElMessageBox.prompt('請輸入新名稱', '編輯群組', {
    confirmButtonText: '確認',
    cancelButtonText: '取消',
    inputValue: group.name
  }).then(async ({ value }) => {
    await groupUpdate({ groupId: group.groupId, name: value });
    ElMessage.success('更新成功');
    loadGroups();
  }).catch(() => {});
}

async function deleteGroup(groupId) {
  try {
    await ElMessageBox.confirm('確定要刪除該群組嗎？成員會移到「無群組」。', '確認刪除', { type: 'warning' });
    await groupDelete({ groupId });
    ElMessage.success('刪除成功');
    loadGroups();
    loadContacts();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('刪除失敗');
  }
}

function getGroupName(groupId) {
  if (!groupId || groupId === 0) return '—';
  const g = groups.value.find(x => x.groupId === groupId);
  return g ? g.name : '—';
}

// ========== CSV 導入 ==========
function handleFileChange(uploadFile, uploadFiles) {
  const rawFile = uploadFile.raw || uploadFile.rawFile || uploadFile;
  console.debug('[CSV Import] rawFile type:', rawFile?.constructor?.name, 'size:', rawFile?.size);
  const reader = new FileReader();
  reader.onload = (e) => {
    let text = e.target.result;
    // 移除常見 BOM：UTF-8 (\uFEFF)、UTF-16
    if (text.charCodeAt(0) === 0xFEFF || text.charCodeAt(0) === 0xFFFE) {
      text = text.slice(1);
    }
    text = text.replace(/^\uFEFF/, '');

    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length === 0) {
      ElMessage.warning('CSV 文件內容為空');
      importPreview.value = [];
      importInvalidCount.value = 0;
      importForm.rawContacts = [];
      return;
    }

    // 自動檢測分隔符：tab（Excel導出常見）> 逗號 > 分號
    const firstLine = lines[0];
    const tabCnt = (firstLine.match(/\t/g) || []).length;
    const commaCnt = (firstLine.match(/,/g) || []).length;
    const semiCnt = (firstLine.match(/;/g) || []).length;
    const delimiter = tabCnt > 0 ? '\t' : (commaCnt > 0 ? ',' : (semiCnt > 0 ? ';' : ','));
    console.debug(`[CSV Import] 分隔符: "${delimiter === '\t' ? 'TAB' : delimiter}", 行數: ${lines.length}, 首行: "${firstLine.substring(0, 80)}"`);

    // 解析：split by delimiter, handle quoted fields
    const rows = lines.map(line => {
      const cells = [];
      let current = '';
      let inQuote = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuote = !inQuote;
        } else if (ch === delimiter && !inQuote) {
          cells.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
      cells.push(current.trim());
      return cells;
    });

    // 檢測第一行是否為標題（name/email/備注 等關鍵字）
    const first = rows[0];
    const isHeaderCell = (cell) => /^(name|姓名|email|郵箱|remark|備注|note)$/i.test(cell.replace(/["\s]/g, ''));
    const hasHeader = isHeaderCell(first[0]) || (first[1] && isHeaderCell(first[1]));
    const dataRows = hasHeader ? rows.slice(1) : rows;

    // 判斷是否為純郵箱 CSV（只有一列且每行都是郵箱格式）
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const isEmailOnly = (() => {
      if (first.length >= 2) return false; // 多列就不是純郵箱
      if (dataRows.length === 0) return false;
      return dataRows.every(cells => emailRegex.test(cells[0]));
    })();

    const parsed = [];
    let invalid = 0;
    for (const cells of dataRows) {
      let email = '';
      let name = '';
      if (isEmailOnly) {
        email = cells[0];
      } else {
        // 多列模式：name, email, remark（email 可能在第1列或第2列）
        // 先嘗試第2列是郵箱，再嘗試第1列是郵箱
        if (cells[1] && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cells[1])) {
          name = cells[0] || '';
          email = cells[1];
        } else if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cells[0])) {
          email = cells[0];
        }
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalid++;
        continue;
      }
      parsed.push({
        name,
        email,
        remark: '',
        groupId: importForm.groupId
      });
    }

    importForm.rawContacts = parsed;
    importPreview.value = parsed.slice(0, 20);
    importInvalidCount.value = invalid;

    if (parsed.length === 0 && invalid > 0) {
      ElMessage.warning(`CSV 中所有 ${invalid} 行都無法識別，請確認格式為：姓名,郵箱,備注`);
    } else if (parsed.length === 0) {
      ElMessage.warning('CSV 中找不到任何有效郵箱');
    }
  };
  reader.onerror = () => {
    ElMessage.error('文件讀取失敗，請確認是有效的 CSV 文件');
    importPreview.value = [];
    importForm.rawContacts = [];
  };
  reader.readAsText(rawFile, 'UTF-8');
}

function handleFileRemove() {
  importPreview.value = [];
  importInvalidCount.value = 0;
  importForm.rawContacts = [];
}

async function handleImport() {
  if (!importForm.rawContacts.length) return;
  importLoading.value = true;
  try {
    // 全部應用同一個 groupId
    const contacts = importForm.rawContacts.map(c => ({
      name: c.name,
      email: c.email,
      remark: c.remark,
      groupId: importForm.groupId
    }));
    await contactBatchAdd({
      contacts,
      domainId: domainStore.currentDomainId
    });
    ElMessage.success(`成功導入 ${contacts.length} 個聯絡人`);
    showImportDialog.value = false;
    importPreview.value = [];
    importInvalidCount.value = 0;
    importForm.rawContacts = [];
    uploadRef.value?.clearFiles();
    loadContacts();
    loadGroups();
  } catch (e) {
    ElMessage.error(e.message || '導入失敗');
  } finally {
    importLoading.value = false;
  }
}

function resetForm() {
  Object.assign(formData, { name: '', email: '', groupId: 0, remark: '' });
}

onMounted(() => {
  loadContacts();
  loadGroups();
});
</script>

<style lang="scss" scoped>
.contact-container {
  padding: 20px;
  height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 { margin: 0; font-size: 18px; font-weight: 600; }
  .header-actions { display: flex; gap: 10px; }
}

.contact-layout {
  display: flex;
  gap: 20px;
  height: calc(100vh - 140px);
}

.group-panel {
  width: 200px;
  flex-shrink: 0;
  background: #fff;
  border-radius: 8px;
  padding: 15px;

  .panel-title {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #666;
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    transition: all 0.2s;

    &:hover { background: #f5f5f5; }
    &.active { background: #e6f0ff; color: #1890ff; font-weight: 500; }

    .count {
      margin-left: auto;
      font-size: 12px;
      color: #999;
    }
  }
}

.contact-panel {
  flex: 1;
  min-width: 0;

  .search-bar { margin-bottom: 15px; }
}

.pagination {
  margin-top: 15px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.total-hint {
  font-size: 13px;
  color: #909399;
}

.group-list {
  margin-bottom: 15px;
  .group-list-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }
}

.add-group {
  display: flex;
  gap: 10px;
}
</style>
