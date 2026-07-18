<template>
  <el-drawer
    v-model="visible"
    :title="$t('selectRecipients')"
    size="450px"
    direction="rtl"
  >
    <div class="picker-container">
      <!-- 搜索 -->
      <el-input
        v-model="keyword"
        :placeholder="$t('searchContact')"
        clearable
        class="search-input"
        @input="handleSearch"
      >
        <template #prefix>
          <Icon icon="carbon:search" />
        </template>
      </el-input>

      <!-- 群組列表 -->
      <div class="section-title">{{ $t('groups') }}</div>
      <div class="group-chips">
        <el-tag
          v-for="g in groups"
          :key="g.groupId"
          class="group-chip"
          :type="selectedGroupId === g.groupId ? 'primary' : 'info'"
          @click="selectGroup(g.groupId)"
          style="cursor: pointer"
        >
          {{ g.name }} ({{ g.memberCount }})
        </el-tag>
      </div>

      <!-- 聯絡人列表 -->
      <div class="section-title">{{ $t('contacts') }}</div>
      <el-scrollbar style="height: calc(100vh - 320px)">
        <div class="contact-list">
          <div
            v-for="c in contacts"
            :key="c.contactId"
            class="contact-item"
            :class="{ selected: isSelected(c) }"
            @click="toggleContact(c)"
          >
            <el-checkbox :model-value="isSelected(c)" />
            <div class="contact-info">
              <div class="contact-name">{{ c.name }}</div>
              <div class="contact-email">{{ c.email }}</div>
            </div>
          </div>
          <el-empty v-if="contacts.length === 0 && !loading" :description="$t('noContacts')" />
        </div>
      </el-scrollbar>

      <!-- 已選擇預覽 -->
      <div class="selected-preview" v-if="selectedContacts.length > 0">
        <div class="section-title">{{ $t('selected') }} ({{ selectedContacts.length }})</div>
        <div class="selected-tags">
          <el-tag
            v-for="c in selectedContacts"
            :key="c.contactId"
            closable
            @close="removeContact(c)"
            style="margin: 3px"
          >
            {{ c.name || c.email }}
          </el-tag>
        </div>
      </div>

      <!-- 操作按鈕 -->
      <div class="picker-actions">
        <el-button @click="visible = false">{{ $t('cancel') }}</el-button>
        <el-button type="primary" @click="confirm">
          {{ $t('confirmAdd') }} {{ selectedContacts.length > 0 ? `(${selectedContacts.length})` : '' }}
        </el-button>
      </div>
    </div>
  </el-drawer>
</template>

<script setup>
import { nextTick, ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import { useDomainStore } from '@/store/domain.js';
import { contactList, groupList } from '@/request/contact.js';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  // 已選擇的郵箱列表（字符串數組）
  selectedEmails: { type: Array, default: () => [] }
});

const emit = defineEmits(['update:modelValue', 'confirm']);

const domainStore = useDomainStore();
const visible = ref(false);
const keyword = ref('');
const selectedGroupId = ref(0);
const contacts = ref([]);
const groups = ref([]);
const selectedContacts = ref([]);
const loading = ref(false);

// 同步 modelValue
watch(() => props.modelValue, (val) => {
  visible.value = val;
  if (val) {
    loadContacts();
    loadGroups();
  }
});

function syncSelectedFromProp() {
  // 根據已選郵箱字符串，找出對應的 contact 對象並預選
  const selected = [];
  contacts.value.forEach(c => {
    if (props.selectedEmails.includes(c.email)) {
      selected.push(c);
    }
  });
  selectedContacts.value = selected;
}

watch(visible, (val) => {
  emit('update:modelValue', val);
});

async function loadContacts() {
  loading.value = true;
  try {
    const res = await contactList({
      domainId: domainStore.currentDomainId || undefined,
      keyword: keyword.value,
      groupId: selectedGroupId.value || undefined
    });
    contacts.value = res || [];
    // 同步外部已選中的郵箱 → 轉為 contact 對象並預選
    syncSelectedFromProp();
  } catch (e) {
    console.error('載入聯絡人失敗', e);
  } finally {
    loading.value = false;
  }
}

async function loadGroups() {
  try {
    const res = await groupList({ domainId: domainStore.currentDomainId });
    groups.value = res || [];
  } catch (e) {
    console.error('載入群組失敗', e);
  }
}

function handleSearch() {
  selectedGroupId.value = 0;
  loadContacts();
}

function selectGroup(groupId) {
  selectedGroupId.value = selectedGroupId.value === groupId ? 0 : groupId;
  loadContacts();
}

function isSelected(c) {
  return selectedContacts.value.some(x => x.contactId === c.contactId);
}

function toggleContact(c) {
  const idx = selectedContacts.value.findIndex(x => x.contactId === c.contactId);
  if (idx === -1) {
    selectedContacts.value.push(c);
  } else {
    selectedContacts.value.splice(idx, 1);
  }
}

function removeContact(c) {
  const idx = selectedContacts.value.findIndex(x => x.contactId === c.contactId);
  if (idx !== -1) selectedContacts.value.splice(idx, 1);
}

function confirm() {
  // 返回選中的郵箱地址數組
  const emails = selectedContacts.value.map(c => c.email);
  emit('confirm', emails, selectedContacts.value);
  visible.value = false;
  // 清空選擇
  selectedContacts.value = [];
}
</script>

<style lang="scss" scoped>
.picker-container {
  padding: 0 15px;
}

.search-input {
  margin-bottom: 15px;
}

.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #666;
  margin-bottom: 10px;
}

.group-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 20px;

  .group-chip {
    cursor: pointer;
  }
}

.contact-list {
  .contact-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.2s;

    &:hover { background: #f5f5f5; }
    &.selected { background: #e6f0ff; }
  }

  .contact-info {
    flex: 1;
    min-width: 0;
  }

  .contact-name {
    font-size: 14px;
    font-weight: 500;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .contact-email {
    font-size: 12px;
    color: #999;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.selected-preview {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;

  .selected-tags {
    display: flex;
    flex-wrap: wrap;
  }
}

.picker-actions {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 15px;
  background: #fff;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
