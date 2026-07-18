/**
 * schedule request - 排程任務 API 封裝
 */
import http from '@/axios/index.js';

export function scheduleList(params) {
    return http.get('/schedule/list', { params });
}

export function scheduleGet(params) {
    return http.get('/schedule/get', { params });
}

export function scheduleAdd(data) {
    return http.post('/schedule/add', data);
}

export function scheduleCancel(params) {
    return http.delete('/schedule/cancel', { params });
}
