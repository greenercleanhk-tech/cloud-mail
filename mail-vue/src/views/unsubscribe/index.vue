<template>
  <div class="unsubscribe-page">
    <div class="unsubscribe-card">
      <!-- 加載中 -->
      <div v-if="status === 'loading'" class="status-box">
        <div class="spinner"></div>
        <p>{{ $t('unsubscribeProcessing') }}</p>
      </div>

      <!-- 成功 -->
      <div v-else-if="status === 'success'" class="status-box success">
        <div class="icon-box">✓</div>
        <h2>{{ $t('unsubscribeSuccess') }}</h2>
        <p>{{ $t('unsubscribeSuccessDesc') }}</p>
      </div>

      <!-- 失敗 -->
      <div v-else-if="status === 'error'" class="status-box error">
        <div class="icon-box">✗</div>
        <h2>{{ $t('unsubscribeFailed') }}</h2>
        <p>{{ $t('unsubscribeFailedDesc') }}</p>
        <button class="retry-btn" @click="doUnsubscribe">{{ $t('retry') }}</button>
      </div>

      <!-- 無效連結 -->
      <div v-else-if="status === 'invalid'" class="status-box error">
        <div class="icon-box">✗</div>
        <h2>{{ $t('unsubscribeInvalid') }}</h2>
        <p>{{ $t('unsubscribeInvalidDesc') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const status = ref('loading');
const token = ref('');
const apiBase = import.meta.env.VITE_BASE_URL || 'https://cloud-mail.lauskiing520.workers.dev';

async function doUnsubscribe() {
  if (!token.value) {
    status.value = 'invalid';
    return;
  }
  status.value = 'loading';
  try {
    const res = await axios.get(`${apiBase}/contact/unsubscribe?token=${encodeURIComponent(token.value)}`);
    // Worker 返回的是 HTML，這裡我們簡單假設成功
    status.value = 'success';
  } catch (e) {
    status.value = 'error';
  }
}

onMounted(() => {
  const params = new URLSearchParams(window.location.search);
  token.value = params.get('token') || '';
  doUnsubscribe();
});
</script>

<style scoped>
.unsubscribe-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  font-family: 'PingFang HK', 'Microsoft YaHei', sans-serif;
}

.unsubscribe-card {
  background: #fff;
  border-radius: 16px;
  padding: 48px 40px;
  max-width: 440px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
  text-align: center;
}

.status-box .icon-box {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  margin: 0 auto 20px;
}

.success .icon-box {
  background: #f0f9eb;
  color: #67c23a;
}

.error .icon-box {
  background: #fef0f0;
  color: #f56c6c;
}

.status-box h2 {
  margin: 0 0 12px;
  font-size: 22px;
  font-weight: 600;
  color: #303133;
}

.status-box p {
  margin: 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e8e8e8;
  border-top-color: #409eff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin: 0 auto 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 16px;
  padding: 10px 24px;
  background: #409eff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #66b1ff;
}
</style>
