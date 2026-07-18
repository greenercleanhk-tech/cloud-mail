/**
 * domain request - 域名 API 封裝
 * 前端調用後端 API 的統一入口
 */
import http from '@/axios/index.js';

export function domainList(params) {
    return http.get('/domain/list', { params });
}

export function domainActive(params) {
    return http.get('/domain/active', { params });
}

export function domainGet(params) {
    return http.get('/domain/get', { params });
}

export function domainAdd(data) {
    return http.post('/domain/add', data);
}

export function domainUpdate(data) {
    return http.put('/domain/update', data);
}

export function domainDelete(params) {
    return http.delete('/domain/delete', { params });
}

export function domainStats(params) {
    return http.get('/domain/stats', { params });
}
