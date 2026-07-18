import http from '@/axios/index.js'

export function analysisEcharts(params) {
    return http.get('/analysis/echarts', { params });
}