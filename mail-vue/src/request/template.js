/**
 * template request - 郵件模板 API 封裝
 */
import http from '@/axios/index.js';

export function templateList(params) {
    return http.get('/template/list', { params });
}

export function templateGet(params) {
    return http.get('/template/get', { params });
}

export function templateAdd(data) {
    return http.post('/template/add', data);
}

export function templateUpdate(data) {
    return http.put('/template/update', data);
}

export function templateDelete(params) {
    return http.delete('/template/delete', { params });
}
