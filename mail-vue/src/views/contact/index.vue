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
        <!-- 搜索框 -->
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
        </div>

        <!-- 聯絡人表格 -->
        <el-table :data="contacts" stripe style="width: 100%" v-loading="loading">
          <el-table-column prop="name" :label="$t('name')" min-width="120" />
          <el-table-column prop="email" :label="$t('email')" min-width="200" />
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
          <el-pagination
            v-model:current-page="page"
            :page-size="50"
            :total="totalCount"
            layout="prev, pager, next"
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
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { useDomainStore } from '@/store/domain.js';
import {
  contactList, contactAdd, contactUpdate, contactDelete,
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
const showAddDialog = ref(false);
const showGroupDialog = ref(false);
const editingContact = ref(null);
const newGroupName = ref('');

const formData = reactive({
  name: '',
  email: '',
  groupId: 0,
  remark: ''
});

async function loadContacts() {
  loading.value = true;
  try {
    const res = await contactList({
      domainId: domainStore.currentDomainId || undefined,
      keyword: keyword.value,
      groupId: selectedGroupId.value,
      page: page.value
    });
    contacts.value = res || [];
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
  loadContacts();
}

function handleSearch() {
  page.value = 1;
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
