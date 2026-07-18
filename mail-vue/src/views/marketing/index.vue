<template>
  <div class="marketing-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h2>{{ $t('marketingCenter') }}</h2>
    </div>

    <!-- Tab 切換 -->
    <el-tabs v-model="activeTab" class="marketing-tabs">
      <!-- ========== Tab 1：郵件模板 ========== -->
      <el-tab-pane :label="$t('emailTemplates')" name="template">
        <div class="tab-toolbar">
          <el-button type="primary" @click="openTemplateDialog()">
            <Icon icon="carbon:add" />
            {{ $t('addTemplate') }}
          </el-button>
        </div>

        <el-table :data="templateList" stripe v-loading="templateLoading" style="width: 100%">
          <el-table-column prop="name" :label="$t('templateName')" min-width="150" />
          <el-table-column prop="subject" :label="$t('subject')" min-width="200" show-overflow-tooltip />
          <el-table-column prop="createTime" :label="$t('createTime')" width="160" />
          <el-table-column :label="$t('actions')" width="160" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openTemplateDialog(row)">{{ $t('edit') }}</el-button>
              <el-button link type="danger" @click="handleDeleteTemplate(row)">{{ $t('delete') }}</el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <!-- ========== Tab 2：發件排程 ========== -->
      <el-tab-pane :label="$t('sendSchedule')" name="schedule">
        <!-- 新建排程表單 -->
        <div class="schedule-form">
          <el-card shadow="never" class="form-card">
            <el-form :model="scheduleForm" label-width="110px" :rules="scheduleRules" ref="scheduleFormRef">
              <el-form-item :label="$t('taskName')" prop="name">
                <el-input v-model="scheduleForm.name" :placeholder="$t('taskNamePlaceholder')" />
              </el-form-item>

              <el-form-item :label="$t('selectDomain')" prop="domainId">
                <el-select v-model="scheduleForm.domainId" :placeholder="$t('selectDomainPlaceholder')" @change="onDomainChange">
                  <el-option v-for="d in domainList" :key="d.domainId" :label="d.displayName || d.domain" :value="d.domainId" />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('selectTemplate')" prop="templateId">
                <el-select v-model="scheduleForm.templateId" :placeholder="$t('selectTemplatePlaceholder')">
                  <el-option v-for="t in templateOptions" :key="t.templateId" :label="t.name" :value="t.templateId" />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('selectContactGroup')" prop="contactGroupId">
                <el-select v-model="scheduleForm.contactGroupId" :placeholder="$t('selectContactGroupPlaceholder')">
                  <el-option v-for="g in contactGroupList" :key="g.groupId" :label="g.name" :value="g.groupId" />
                </el-select>
              </el-form-item>

              <el-form-item :label="$t('recipientCount')" prop="totalRecipients">
                <el-input-number v-model="scheduleForm.totalRecipients" :min="1" />
              </el-form-item>

              <el-form-item :label="$t('sendTime')" prop="scheduledAt">
                <el-date-picker
                  v-model="scheduleForm.scheduledAt"
                  type="datetime"
                  :placeholder="$t('selectSendTimePlaceholder')"
                  format="YYYY-MM-DD HH:mm"
                  value-format="YYYY-MM-DD HH:mm:ss"
                />
              </el-form-item>

              <el-form-item>
                <el-button type="primary" @click="handleCreateSchedule" :loading="scheduleSubmitting">
                  {{ $t('addToSchedule') }}
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </div>

        <!-- 排程列表 -->
        <div class="schedule-list">
          <div class="list-title">{{ $t('scheduleList') }}</div>
          <el-table :data="scheduleList" stripe v-loading="scheduleLoading" style="width: 100%">
            <el-table-column prop="name" :label="$t('taskName')" min-width="140" />
            <el-table-column :label="$t('domain')" width="160">
              <template #default="{ row }">
                {{ getDomainName(row.domainId) }}
              </template>
            </el-table-column>
            <el-table-column :label="$t('progress')" width="200">
              <template #default="{ row }">
                <el-progress
                  :percentage="getProgress(row)"
                  :status="getProgressStatus(row.status)"
                  :stroke-width="10"
                />
                <span class="progress-text">{{ row.sentCount }} / {{ row.totalRecipients }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('sendTime')" width="160">
              <template #default="{ row }">
                {{ row.scheduledAt ? row.scheduledAt.slice(0, 16) : '-' }}
              </template>
            </el-table-column>
            <el-table-column :label="$t('status')" width="100">
              <template #default="{ row }">
                <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="$t('actions')" width="140" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.status === 'pending' || row.status === 'running'"
                  link type="danger"
                  @click="handleCancelSchedule(row)"
                >{{ $t('cancel') }}</el-button>
                <el-tag v-else-if="row.status === 'completed'" type="success" size="small">{{ $t('completed') }}</el-tag>
                <el-tag v-else-if="row.status === 'cancelled'" type="info" size="small">{{ $t('cancelled') }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ========== 模板新增/編輯 Dialog ========== -->
    <el-dialog
      v-model="showTemplateDialog"
      :title="editingTemplate ? $t('editTemplate') : $t('addTemplate')"
      width="600px"
    >
      <el-form :model="templateForm" label-width="100px">
        <el-form-item :label="$t('templateName')">
          <el-input v-model="templateForm.name" :placeholder="$t('templateNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('subject')">
          <el-input v-model="templateForm.subject" :placeholder="$t('subjectPlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('content')">
          <tinyEditor :def-value="templateForm.content" ref="templateEditor" @change="onTemplateContentChange" style="height: 320px; display: block" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showTemplateDialog = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="handleSaveTemplate" :loading="templateSubmitting">
          {{ $t('confirm') }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import tinyEditor from '@/components/tiny-editor/index.vue';
import { templateList as fetchTemplateList, templateAdd, templateUpdate, templateDelete } from '@/request/template.js';
import { scheduleList as fetchScheduleList, scheduleAdd, scheduleCancel } from '@/request/schedule.js';
import { domainList as getDomainList } from '@/request/domain.js';
import { groupList as getGroupList } from '@/request/contact.js';
import { useDomainStore } from '@/store/domain.js';

const domainStore = useDomainStore();

// ========== Tab 控制 ==========
const activeTab = ref('template');

// ========== 模板相關 ==========
const templateLoading = ref(false);
const templateSubmitting = ref(false);
const showTemplateDialog = ref(false);
const editingTemplate = ref(null);
const templateEditor = ref({});
const templateList = ref([]);

const templateForm = reactive({
  name: '',
  subject: '',
  content: '',
  domainId: null
});

async function loadTemplates() {
  if (!domainStore.currentDomainId) return;
  templateLoading.value = true;
  try {
    const res = await fetchTemplateList({ domainId: domainStore.currentDomainId });
    templateList.value = res || [];
  } catch (e) {
    ElMessage.error('載入模板失敗');
  } finally {
    templateLoading.value = false;
  }
}

function openTemplateDialog(row = null) {
  editingTemplate.value = row;
  if (row) {
    Object.assign(templateForm, {
      name: row.name,
      subject: row.subject,
      content: row.content,
      domainId: row.domainId
    });
  } else {
    Object.assign(templateForm, {
      name: '',
      subject: '',
      content: '',
      domainId: domainStore.currentDomainId
    });
  }
  setTimeout(() => {
    if (templateEditor.value) {
      templateEditor.value.setContent?.(templateForm.content || '');
    }
  }, 100);
  showTemplateDialog.value = true;
}

function onTemplateContentChange(content) {
  templateForm.content = content;
}

async function handleSaveTemplate() {
  if (!templateForm.name || !templateForm.subject) {
    ElMessage.warning('請填寫名稱和標題');
    return;
  }
  templateSubmitting.value = true;
  try {
    if (editingTemplate.value) {
      await templateUpdate({ templateId: editingTemplate.value.templateId, ...templateForm });
      ElMessage.success('更新成功');
    } else {
      await templateAdd(templateForm);
      ElMessage.success('新增成功');
    }
    showTemplateDialog.value = false;
    loadTemplates();
  } catch (e) {
    ElMessage.error(e.message || '操作失敗');
  } finally {
    templateSubmitting.value = false;
  }
}

async function handleDeleteTemplate(row) {
  try {
    await ElMessageBox.confirm(`確定要刪除模板「${row.name}」嗎？`, '確認刪除', { type: 'warning' });
    await templateDelete({ templateId: row.templateId });
    ElMessage.success('刪除成功');
    loadTemplates();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('刪除失敗');
  }
}

// ========== 排程相關 ==========
const scheduleLoading = ref(false);
const scheduleSubmitting = ref(false);
const scheduleFormRef = ref({});
const scheduleList = ref([]);
const domainList = ref([]);
const contactGroupList = ref([]);
const templateOptions = ref([]);

const scheduleForm = reactive({
  name: '',
  domainId: null,
  templateId: null,
  contactGroupId: null,
  totalRecipients: 0,
  scheduledAt: null
});

const scheduleRules = {
  name: [{ required: true, message: '請輸入任務名稱', trigger: 'blur' }],
  domainId: [{ required: true, message: '請選擇域名', trigger: 'change' }],
  templateId: [{ required: true, message: '請選擇模板', trigger: 'change' }],
  contactGroupId: [{ required: true, message: '請選擇通訊組', trigger: 'change' }],
  totalRecipients: [{ required: true, message: '請輸入收件人數量', trigger: 'blur' }],
  scheduledAt: [{ required: true, message: '請選擇發送時間', trigger: 'change' }]
};

async function loadSchedules() {
  scheduleLoading.value = true;
  try {
    const res = await fetchScheduleList({});
    scheduleList.value = res || [];
  } catch (e) {
    ElMessage.error('載入排程失敗');
  } finally {
    scheduleLoading.value = false;
  }
}

async function loadDomains() {
  try {
    const res = await getDomainList();
    domainList.value = res || [];
  } catch (e) {
    console.error('載入域名失敗', e);
  }
}

async function loadContactGroups() {
  try {
    const res = await getGroupList({ domainId: domainStore.currentDomainId || 0 });
    contactGroupList.value = res || [];
  } catch (e) {
    console.error('載入通訊組失敗', e);
  }
}

async function onDomainChange(domainId) {
  // 切換域名時，重新載入該域名的模板和通訊組
  scheduleForm.templateId = null;
  scheduleForm.contactGroupId = null;
  templateOptions.value = [];
  contactGroupList.value = [];

  if (!domainId) return;

  try {
    const [tmpl, groups] = await Promise.all([
      fetchTemplateList({ domainId }),
      getGroupList({ domainId })
    ]);
    templateOptions.value = tmpl || [];
    contactGroupList.value = groups || [];
  } catch (e) {
    console.error('載入失敗', e);
  }
}

async function handleCreateSchedule() {
  try {
    await scheduleFormRef.value.validate();
  } catch (e) {
    return;
  }

  scheduleSubmitting.value = true;
  try {
    await scheduleAdd({ ...scheduleForm });
    ElMessage.success('排程已建立');
    // 重置表單
    Object.assign(scheduleForm, { name: '', domainId: null, templateId: null, contactGroupId: null, totalRecipients: 0, scheduledAt: null });
    templateOptions.value = [];
    contactGroupList.value = [];
    loadSchedules();
  } catch (e) {
    ElMessage.error(e.message || '建立失敗');
  } finally {
    scheduleSubmitting.value = false;
  }
}

async function handleCancelSchedule(row) {
  try {
    await ElMessageBox.confirm(`確定要取消任務「${row.name}」嗎？`, '確認取消', { type: 'warning' });
    await scheduleCancel({ jobId: row.jobId });
    ElMessage.success('已取消');
    loadSchedules();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error('取消失敗');
  }
}

// ========== 工具函數 ==========
function getDomainName(domainId) {
  return domainList.value.find(d => d.domainId === domainId)?.displayName || '-';
}

function getProgress(row) {
  if (!row.totalRecipients) return 0;
  return Math.round((row.sentCount / row.totalRecipients) * 100);
}

function getProgressStatus(status) {
  if (status === 'completed') return 'success';
  if (status === 'running') return 'primary';
  if (status === 'cancelled') return 'info';
  return 'warning';
}

function getStatusType(status) {
  if (status === 'pending') return 'warning';
  if (status === 'running') return 'primary';
  if (status === 'completed') return 'success';
  if (status === 'cancelled') return 'info';
  return '';
}

function getStatusText(status) {
  const map = { pending: '待發送', running: '發送中', completed: '已完成', cancelled: '已取消' };
  return map[status] || status;
}

// ========== 初始化 ==========
onMounted(async () => {
  await loadDomains();
  await loadTemplates();
  await loadSchedules();
  await loadContactGroups();
});

// 切換 Tab 時自動刷新
import { watch } from 'vue';
watch(activeTab, (tab) => {
  if (tab === 'template') loadTemplates();
  if (tab === 'schedule') { loadSchedules(); loadDomains(); }
});
</script>

<style scoped>
.marketing-container {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
  }
}

.tab-toolbar {
  margin-bottom: 15px;
}

.schedule-form {
  margin-bottom: 30px;
}

.form-card {
  max-width: 700px;
}

.schedule-list .list-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}

.progress-text {
  font-size: 12px;
  color: #999;
  margin-left: 4px;
}
</style>
