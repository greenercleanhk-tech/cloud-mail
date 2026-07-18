import http from '@/axios/index.js'

export function accountList(accountId, size, lastSort, domainId) {
    return http.get('/account/list', {params: {accountId, size, lastSort, domainId}});
}

export function accountAdd(email, token, domainId) {
    return http.post('/account/add', {email, token, domainId})
}

export function accountSetName(accountId,name) {
    return http.put('/account/setName', {name,accountId})
}

export function accountDelete(accountId) {
    return http.delete('/account/delete', {params: {accountId}})
}

export function accountSetAllReceive(accountId) {
    return http.put('/account/setAllReceive', {accountId})
}

export function accountSetAsTop(accountId) {
    return http.put('/account/setAsTop', {accountId})
}