<template>
  <div class="schedule-detail">
    <!-- 返回按鈕 -->
    <div class="back-bar">
      <el-button @click="$router.push('/marketing')" size="small">
        ← {{ $t('back') }}
      </el-button>
    </div>

    <div v-if="loading" style="text-align:center;padding:60px">
      <el-icon class="is-loading"><Loading /></el-icon>
    </div>

    <div v-else-if="!job" style="text-align:center;padding:60px;color:#999">
      {{ $t('notFound') }}
    </div>

    <div v-else>
      <!-- 基本信息卡片 -->
      <el-card shadow="never" class="info-card">
        <div class="job-header">
          <div>
            <h2 class="job-name">{{ job.name }}</h2>
            <div class="job-meta">
              <el-tag type="info" size="small">{{ job.domainDisplay }}</el-tag>
              <span class="meta-sep">|</span>
              <span>{{ $t('sendTemplate') }}: {{ job.templateName || ('#' + job.templateId) }}</span>
              <span class="meta-sep">|</span>
              <span>{{ $t('totalRecipients') }}: {{ job.totalRecipients }}</span>
              <span class="meta-sep">|</span>
              <span>{{ $t('dailyLimitLabel') }}: {{ job.dailyLimit }}</span>
            </div>
          </div>
          <el-tag :type="getStatusType(job.status)" size="large">{{ getStatusText(job.status) }}</el-tag>
        </div>

        <!-- 整體進度條 -->
        <div class="overall-progress">
          <div class="progress-label">
            <span>{{ $t('overallProgress') }}</span>
            <span>{{ jobCursor }} / {{ job.totalRecipients }}</span>
          </div>
          <el-progress
            :percentage="overallPct"
            :status="getProgressStatus(job.status)"
            :stroke-width="14"
          />
        </div>

        <!-- 已發/失敗統計 -->
        <div class="stat-row">
          <div class="stat-item">
            <div class="stat-value success">{{ totalSent }}</div>
            <div class="stat-label">{{ $t('sentCount') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value danger">{{ totalFailed }}</div>
            <div class="stat-label">{{ $t('failedCount') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ job.totalRecipients }}</div>
            <div class="stat-label">{{ $t('totalRecipients') }}</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ remaining }}</div>
            <div class="stat-label">{{ $t('remaining') }}</div>
          </div>
        </div>
      </el-card>

      <!-- 發送進度（按郵箱） -->
      <el-card shadow="never" class="mailbox-card">
        <template #header>
          <span>{{ $t('mailboxProgress') }}</span>
          <el-button size="small" @click="loadData" :loading="loading" style="float:right">
            {{ $t('refresh') }}
          </el-button>
        </template>

        <el-table :data="tasks" stripe v-loading="loading2">
          <!-- 狀態 -->
          <el-table-column :label="$t('status')" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="getStatusType(row.status)" size="small">{{ getStatusText(row.status) }}</el-tag>
            </template>
          </el-table-column>

          <!-- 當前郵箱 -->
          <el-table-column :label="$t('currentMailbox')" min-width="160" show-overflow-tooltip>
            <template #default="{ row }">
              <span>{{ row.currentMailboxEmail }}</span>
              <el-tag v-if="row.currentMailboxStatus === 'active'" type="success" size="small" style="margin-left:6px">Active</el-tag>
              <el-tag v-else type="info" size="small" style="margin-left:6px">{{ row.currentMailboxStatus }}</el-tag>
            </template>
          </el-table-column>

          <!-- 進度 -->
          <el-table-column :label="$t('progress')" min-width="150">
            <template #default="{ row }">
              <el-progress
                :percentage="row.progressPct"
                :status="getProgressStatus(row.status)"
                :stroke-width="8"
              />
              <span style="font-size:12px;color:#999">{{ row.cursor }} / {{ row.totalRecipients }}</span>
            </template>
          </el-table-column>

          <!-- 今日已發 -->
          <el-table-column :label="$t('sentToday')" width="120" align="center">
            <template #default="{ row }">
              <span style="font-size:14px">{{ row.sentToday ?? 0 }}</span>
              <span style="font-size:11px;color:#999"> / {{ row.perMailboxLimit }}</span>
            </template>
          </el-table-column>

          <!-- cursor -->
          <el-table-column :label="'Cursor'" width="80" align="center">
            <template #default="{ row }">
              <span style="font-family:monospace;font-size:13px">{{ row.cursor }}</span>
            </template>
          </el-table-column>

          <!-- Pool Index -->
          <el-table-column :label="$t('poolIndex')" width="80" align="center">
            <template #default="{ row }">
              <span style="font-family:monospace;font-size:13px">{{ row.accountPoolIndex }}</span>
            </template>
          </el-table-column>

          <!-- 最後發送日 -->
          <el-table-column :label="$t('lastSentDate')" width="120">
            <template #default="{ row }">
              <span style="font-size:13px;color:#666">{{ row.lastSentDate || '-' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { scheduleGet } from '@/request/schedule.js'

const route = useRoute()
const jobId = route.params.jobId

const loading = ref(true)
const loading2 = ref(false)
const job = ref(null)

const tasks = computed(() => job.value?.tasks || [])
const jobCursor = computed(() => tasks.value.reduce((sum, t) => sum + (t.cursor || 0), 0))
const totalSent = computed(() => tasks.value.reduce((sum, t) => sum + (t.sentCount || 0), 0))
const totalFailed = computed(() => tasks.value.reduce((sum, t) => sum + (t.failedCount || 0), 0))
const overallPct = computed(() => {
  const total = job.value?.totalRecipients || 0
  if (!total) return 0
  return Math.round((jobCursor.value / total) * 100)
})
const remaining = computed(() => (job.value?.totalRecipients || 0) - jobCursor.value)

async function loadData() {
  loading2.value = true
  try {
    const res = await scheduleGet({ jobId })
    job.value = res?.data || res || null
  } catch (e) {
    ElMessage.error('載入詳情失敗')
  } finally {
    loading2.value = false
    loading.value = false
  }
}

function getStatusType(status) {
  if (status === 'pending') return 'warning'
  if (status === 'running') return 'primary'
  if (status === 'completed') return 'success'
  if (status === 'cancelled') return 'info'
  if (status === 'waiting_limit') return 'warning'
  if (status === 'waiting_mailbox') return 'warning'
  return ''
}

function getStatusText(status) {
  const map = {
    pending: '待發送',
    running: '發送中',
    completed: '已完成',
    cancelled: '已取消',
    waiting_limit: '已達日上限',
    waiting_mailbox: '郵箱配額用盡',
  }
  return map[status] || status
}

function getProgressStatus(status) {
  if (status === 'completed') return 'success'
  if (status === 'running') return 'primary'
  if (status === 'cancelled') return 'info'
  if (status === 'waiting_limit' || status === 'waiting_mailbox') return 'warning'
  return ''
}

onMounted(loadData)
</script>

<style scoped>
.schedule-detail {
  padding: 20px;
  max-width: 1100px;
}

.back-bar {
  margin-bottom: 16px;
}

.info-card {
  margin-bottom: 16px;
}

.job-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 20px;
}

.job-name {
  margin: 0 0 8px;
  font-size: 18px;
}

.job-meta {
  font-size: 13px;
  color: #666;
}

.meta-sep {
  margin: 0 8px;
  color: #ddd;
}

.overall-progress {
  margin-bottom: 20px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #666;
  margin-bottom: 6px;
}

.stat-row {
  display: flex;
  gap: 0;
}

.stat-item {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  border-right: 1px solid #f0f0f0;
}

.stat-item:last-child {
  border-right: none;
}

.stat-value {
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.stat-value.success { color: #67c23a; }
.stat-value.danger { color: #f56c6c; }

.stat-label {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.mailbox-card {
  margin-top: 0;
}
</style>
