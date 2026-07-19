import http from '@/axios/index.js';

export function loginUserInfo() {
    return http.get('/my/loginUserInfo')
}

export function resetPassword(oldPassword, newPassword) {
    return http.put('/my/resetPassword', {oldPassword, newPassword})
}

export function userDelete() {
    return http.delete('/my/delete')
}

