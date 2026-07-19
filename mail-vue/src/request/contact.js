/**
 * contact request - 通訊錄 API 封裝
 */
import http from '@/axios/index.js';

export function contactList(params) {
    return http.get('/contact/list', { params });
}

export function contactAdd(data) {
    return http.post('/contact/add', data);
}

export function contactBatchAdd(data) {
    return http.post('/contact/batchAdd', data);
}

export function contactUpdate(data) {
    return http.put('/contact/update', data);
}

export function contactDelete(params) {
    return http.delete('/contact/delete', { params });
}

export function contactBatchDelete(data) {
    return http.post('/contact/batchDelete', data);
}

export function contactBatchDeleteByFilter(data) {
    return http.post('/contact/batchDelete/byFilter', data);
}

export function groupList(params) {
    return http.get('/contact/group/list', { params });
}

export function groupAdd(data) {
    return http.post('/contact/group/add', data);
}

export function groupUpdate(data) {
    return http.put('/contact/group/update', data);
}

export function groupDelete(params) {
    return http.delete('/contact/group/delete', { params });
}

export function contactResubscribe(data) {
    return http.post('/contact/resubscribe', data);
}
