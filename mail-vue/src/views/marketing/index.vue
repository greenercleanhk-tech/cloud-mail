<template>
  <div class="marketing-container">
    <!-- 頁面標題 -->
    <div class="page-header">
      <h2>{{ $t('marketingCenter') }}</h2>
    </div>

    <!-- Tab 切換 -->
    <el-tabs v-model="activeTab" class="marketing-tabs">

      <!-- ========== Tab 1：發件排程 ========== -->
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

              <el-form-item :label="$t('selectContactGroup')" prop="contactGroupIds">
                <el-select
                  v-model="scheduleForm.contactGroupIds"
                  multiple
                  collapse-tags
                  collapse-tags-tooltip
                  :placeholder="$t('selectContactGroupPlaceholder')"
                  @change="onContactGroupChange"
                >
                  <el-option
                    v-for="g in contactGroupList"
                    :key="g.groupId"
                    :label="g.name + (g.memberCount ? ' (' + g.memberCount + '人)' : '')"
                    :value="g.groupId"
                  />
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

      <!-- ========== Tab 2：郵件模板 ========== -->
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

      <!-- ========== Tab 3：數據分析 ========== -->
      <el-tab-pane :label="$t('analytics')" name="analytics">
        <div class="analytics-wrapper">
          <div class="number">
            <div class="number-item">
              <div class="top">
                <div class="left">
                  <div>{{ $t('totalReceived') }}</div>
                  <div>
                    <el-statistic :formatter="value => Math.round(value)" :value="receiveData"/>
                  </div>
                </div>
                <div class="right">
                  <div class="count-icon">
                    <Icon icon="hugeicons:mailbox-01" width="25" height="25"></Icon>
                  </div>
                </div>
              </div>
              <div class="delete-ratio">
                <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalReceiveTotal }}</span></div>
                <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delReceiveTotal }}</span></div>
              </div>
            </div>
            <div class="number-item">
              <div class="top">
                <div class="left">
                  <div>{{ $t('totalSent') }}</div>
                  <div>
                    <el-statistic :formatter="value => Math.round(value)" :value="sendData"/>
                  </div>
                </div>
                <div class="right">
                  <div class="count-icon">
                    <Icon icon="cil:send" width="25" height="25"></Icon>
                  </div>
                </div>
              </div>
              <div class="delete-ratio">
                <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalSendTotal }}</span></div>
                <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delSendTotal }}</span></div>
              </div>
            </div>
            <div class="number-item">
              <div class="top">
                <div class="left">
                  <div>{{ $t('totalMailboxes') }}</div>
                  <div>
                    <el-statistic :formatter="value => Math.round(value)" :value="accountData"/>
                  </div>
                </div>
                <div class="right">
                  <div class="count-icon">
                    <Icon icon="lets-icons:e-mail" width="23" height="23"></Icon>
                  </div>
                </div>
              </div>
              <div class="delete-ratio">
                <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalAccountTotal }}</span></div>
                <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delAccountTotal }}</span></div>
              </div>
            </div>
            <div class="number-item">
              <div class="top">
                <div class="left">
                  <div>{{ $t('totalUsers') }}</div>
                  <div>
                    <el-statistic :formatter="value => Math.round(value)" :value="userData"/>
                  </div>
                </div>
                <div class="right">
                  <div class="count-icon">
                    <Icon icon="iconoir:user" width="25" height="25"></Icon>
                  </div>
                </div>
              </div>
              <div class="delete-ratio">
                <div>{{ $t('active') }} <span class="normal">{{ numberCount.normalUserTotal }}</span></div>
                <div>{{ $t('deleted') }} <span class="deleted">{{ numberCount.delUserTotal }}</span></div>
              </div>
            </div>
          </div>
          <div class="picture">
            <div class="picture-item">
              <div class="title">{{ $t('emailSource') }}</div>
              <div class="sender-pie"></div>
            </div>
            <div class="picture-item">
              <div class="title">{{ $t('userGrowth') }}</div>
              <div class="increase-line"></div>
            </div>
          </div>
          <div class="picture-cs">
            <div class="picture-cs-item">
              <div class="title">{{ $t('emailGrowth') }}</div>
              <div class="email-column"></div>
            </div>
            <div class="picture-cs-item">
              <div class="title">{{ $t('sentToday') }}</div>
              <div class="send-count"></div>
            </div>
          </div>
        </div>
      </el-tab-pane>
    </el-tabs>

    <!-- ========== 模板新增/編輯 Dialog ========== -->
    <el-dialog
      v-model="showTemplateDialog"
      :title="editingTemplate ? $t('editTemplate') : $t('addTemplate')"
      width="900px"
      class="template-dialog"
    >
      <el-form :model="templateForm" label-width="100px">
        <el-form-item :label="$t('templateName')">
          <el-input v-model="templateForm.name" :placeholder="$t('templateNamePlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('subject')">
          <el-input v-model="templateForm.subject" :placeholder="$t('subjectPlaceholder')" />
        </el-form-item>
        <el-form-item :label="$t('content')">
          <tinyEditor :def-value="templateForm.content" ref="templateEditor" @change="onTemplateContentChange" style="height: 480px; display: block" />
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
import { ref, reactive, onMounted, onActivated, watch, nextTick } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import tinyEditor from '@/components/tiny-editor/index.vue';
import { templateList as fetchTemplateList, templateAdd, templateUpdate, templateDelete } from '@/request/template.js';
import { scheduleList as fetchScheduleList, scheduleAdd, scheduleCancel } from '@/request/schedule.js';
import { domainList as getDomainList } from '@/request/domain.js';
import { groupList as getGroupList } from '@/request/contact.js';
import { analysisEcharts } from '@/request/analysis.js';
import { useDomainStore } from '@/store/domain.js';
import echarts from '@/echarts/index.js';
import dayjs from 'dayjs';
import { useTransition } from '@vueuse/core';

const domainStore = useDomainStore();

// ========== Tab 控制 ==========
const activeTab = ref('schedule');

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
  contactGroupIds: [],
  totalRecipients: 0,
  scheduledAt: null
});

const scheduleRules = {
  name: [{ required: true, message: '請輸入任務名稱', trigger: 'blur' }],
  domainId: [{ required: true, message: '請選擇域名', trigger: 'change' }],
  templateId: [{ required: true, message: '請選擇模板', trigger: 'change' }],
  contactGroupIds: [{ required: true, message: '請選擇通訊組', trigger: 'change' }],
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

async function loadContactGroups(domainId) {
  try {
    const res = await getGroupList({ domainId: domainId || 0 });
    contactGroupList.value = res || [];
  } catch (e) {
    console.error('載入通訊組失敗', e);
  }
}

async function onDomainChange(domainId) {
  scheduleForm.templateId = null;
  scheduleForm.contactGroupIds = [];
  scheduleForm.totalRecipients = 0;
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

function onContactGroupChange(groupIds) {
  if (!groupIds || groupIds.length === 0) {
    scheduleForm.totalRecipients = 0;
    return;
  }
  const total = contactGroupList.value
    .filter(g => groupIds.includes(g.groupId))
    .reduce((sum, g) => sum + (g.memberCount || 0), 0);
  scheduleForm.totalRecipients = total;
}

async function handleCreateSchedule() {
  try {
    await scheduleFormRef.value.validate();
  } catch (e) {
    return;
  }

  scheduleSubmitting.value = true;
  try {
    // 發送 contactGroupIds 數組
    await scheduleAdd({ ...scheduleForm, contactGroupIds: scheduleForm.contactGroupIds });
    ElMessage.success('排程已建立');
    Object.assign(scheduleForm, { name: '', domainId: null, templateId: null, contactGroupIds: [], totalRecipients: 0, scheduledAt: null });
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

// ========== 分析相關（Tab 3） ==========
const receiveData = ref(0);
const sendData = ref(0);
const accountData = ref(0);
const userData = ref(0);

const receiveDataAnim = useTransition(receiveData, { duration: 1500 });
const sendDataAnim = useTransition(sendData, { duration: 1500 });
const accountDataAnim = useTransition(accountData, { duration: 1500 });
const userDataAnim = useTransition(userData, { duration: 1500 });

const numberCount = reactive({
  normalReceiveTotal: 0, normalSendTotal: 0, normalAccountTotal: 0, normalUserTotal: 0,
  delReceiveTotal: 0, delSendTotal: 0, delAccountTotal: 0, delUserTotal: 0
});

const senderData = ref(null);
const userLineData = { xdata: [], sdata: [] };
const emailColumnData = { receiveData: [], sendData: [], daysData: [] };
let daySendTotal = 0;
let senderPie = null, increaseLine = null, emailColumn = null, sendGauge = null;
let analyticsLoaded = false;

async function loadAnalytics() {
  if (analyticsLoaded) return;
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const data = await analysisEcharts(timeZone);

    receiveData.value = data.numberCount.receiveTotal;
    sendData.value = data.numberCount.sendTotal;
    accountData.value = data.numberCount.accountTotal;
    userData.value = data.numberCount.userTotal;

    Object.assign(numberCount, {
      normalReceiveTotal: data.numberCount.normalReceiveTotal,
      normalSendTotal: data.numberCount.normalSendTotal,
      normalAccountTotal: data.numberCount.normalAccountTotal,
      normalUserTotal: data.numberCount.normalUserTotal,
      delReceiveTotal: data.numberCount.delReceiveTotal,
      delSendTotal: data.numberCount.delSendTotal,
      delAccountTotal: data.numberCount.delAccountTotal,
      delUserTotal: data.numberCount.delUserTotal
    });

    senderData.value = data.receiveRatio.nameRatio.map(item => ({
      name: item.name || ' ',
      value: item.total
    }));

    userLineData.xdata = data.userDayCount.map(item => dayjs(item.date).format('M.D'));
    userLineData.sdata = data.userDayCount.map(item => item.total);
    emailColumnData.daysData = data.emailDayCount.receiveDayCount.map(item => dayjs(item.date).format('M.D'));
    emailColumnData.receiveData = data.emailDayCount.receiveDayCount.map(item => item.total);
    emailColumnData.sendData = data.emailDayCount.sendDayCount.map(item => item.total);
    daySendTotal = data.daySendTotal;

    analyticsLoaded = true;
    await nextTick();
    initAnalyticsCharts();
  } catch (e) {
    console.error('載入分析數據失敗', e);
  }
}

function initAnalyticsCharts() {
  createSenderPie();
  createIncreaseLine();
  createEmailColumnChart();
  createSendGauge();
}

function createSenderPie() {
  if (senderPie) senderPie.dispose();
  senderPie = echarts.init(document.querySelector('.sender-pie'));
  senderPie.setOption({
    tooltip: { trigger: 'item', formatter: params => `${params.marker} ${params.name}：${params.value} (${params.percent}%)` },
    legend: { type: 'scroll', orient: 'vertical', left: 10, top: 20 },
    series: [{ data: senderData.value, type: 'pie', radius: ['40%', '65%'], center: ['75%', '45%'], itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 }, label: { show: false }, color: ['#3CB2FF', '#13DEB9', '#FBBF24', '#FF7F50', '#BAE6FD', '#C084FC'] }]
  });
}

function createIncreaseLine() {
  if (increaseLine) increaseLine.dispose();
  increaseLine = echarts.init(document.querySelector('.increase-line'));
  increaseLine.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
    grid: { top: '8%', right: 20, left: 35, bottom: 35 },
    xAxis: { type: 'category', data: userLineData.xdata, boundaryGap: false, axisLine: { lineStyle: { color: '#909399' } } },
    yAxis: { type: 'value', axisLine: { show: true, lineStyle: { color: '#909399' } }, splitLine: { lineStyle: { type: 'dashed', color: '#D4D7DE' } } },
    series: [{ data: userLineData.sdata, type: 'line', smooth: 0.1, symbol: 'none', lineStyle: { color: '#1D84FF', width: 2.5 }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(29,132,255,0.3)' }, { offset: 1, color: 'rgba(29,132,255,0.03)' }]) } }]
  });
}

function createEmailColumnChart() {
  if (emailColumn) emailColumn.dispose();
  emailColumn = echarts.init(document.querySelector('.email-column'));
  emailColumn.setOption({
    tooltip: { trigger: 'axis' },
    legend: { data: ['收到郵件', '發送郵件'], top: 0 },
    grid: { left: 18, right: 18, bottom: 15, top: 50 },
    xAxis: { type: 'category', data: emailColumnData.daysData, axisLine: { lineStyle: { color: '#909399' } } },
    yAxis: { type: 'value', axisLine: { show: true, lineStyle: { color: '#909399' } }, splitLine: { lineStyle: { type: 'dashed' } } },
    series: [
      { name: '收到郵件', type: 'bar', stack: 'total', barWidth: '60%', data: emailColumnData.receiveData, itemStyle: { color: '#3CB2FF' } },
      { name: '發送郵件', type: 'bar', stack: 'total', data: emailColumnData.sendData, itemStyle: { color: '#13deb9' } }
    ]
  });
}

function createSendGauge() {
  if (sendGauge) sendGauge.dispose();
  sendGauge = echarts.init(document.querySelector('.send-count'));
  sendGauge.setOption({
    series: [{
      type: 'gauge', max: 100,
      progress: { show: true, roundCap: true, itemStyle: { color: '#3CB2FF' } },
      pointer: { itemStyle: { color: '#3CB2FF' } },
      axisLine: { roundCap: true, lineStyle: { color: [[1, '#E6EBF8']] } },
      splitLine: { lineStyle: { color: '#CFD3DC' } },
      axisTick: { lineStyle: { color: '#909399' } },
      detail: { valueAnimation: true, formatter: '{value}', color: '#303133' },
      data: [{ value: daySendTotal, name: '總計' }]
    }],
    color: ['#3CB2FF']
  });
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
  await loadSchedules();
  await loadContactGroups(domainStore.currentDomainId);
});

watch(activeTab, (tab) => {
  if (tab === 'template') loadTemplates();
  if (tab === 'schedule') { loadSchedules(); loadDomains(); }
  if (tab === 'analytics') loadAnalytics();
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

/* ========== Analytics Tab ========== */
.analytics-wrapper {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.analytics-wrapper .number {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.analytics-wrapper .number-item {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  padding: 21px 20px;
}

.analytics-wrapper .number-item .top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.analytics-wrapper .number-item .left > div:first-child {
  font-size: 15px;
  color: var(--el-text-color-regular);
}

.analytics-wrapper .number-item .delete-ratio {
  display: flex;
  gap: 20px;
  font-size: 14px;
}

.analytics-wrapper .number-item .delete-ratio .normal { color: var(--el-color-success); font-weight: bold; }
.analytics-wrapper .number-item .delete-ratio .deleted { color: var(--el-color-danger); font-weight: bold; }

.analytics-wrapper .count-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px;
  border-radius: 8px;
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.analytics-wrapper .picture {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.analytics-wrapper .picture-item {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  padding: 20px;
}

.analytics-wrapper .picture-item .title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 15px;
}

.analytics-wrapper .sender-pie { height: 300px; }
.analytics-wrapper .increase-line { height: 300px; }

.analytics-wrapper .picture-cs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.analytics-wrapper .picture-cs-item {
  background: var(--el-bg-color);
  border-radius: 8px;
  border: 1px solid var(--el-border-color);
  padding: 20px;
}

.analytics-wrapper .picture-cs-item .title {
  font-size: 16px;
  font-weight: 500;
  margin-bottom: 15px;
}

.analytics-wrapper .email-column { height: 300px; }
.analytics-wrapper .send-count { height: 300px; }

@media (max-width: 1024px) {
  .analytics-wrapper .number { grid-template-columns: 1fr 1fr; }
  .analytics-wrapper .picture, .analytics-wrapper .picture-cs { grid-template-columns: 1fr; }
}
</style>
