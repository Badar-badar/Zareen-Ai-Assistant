const KEY = "zareena_token";
export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t: string) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);