// 비교에 담은 제품 (최대 8개, 브라우저에 저장) — 항목: {id, name, local?: 직접 확인한 제품 원본}
const KEY = 'compareCart:v1'
export const MAX_COMPARE = 8

export function getCart() {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((p) => p?.id) : []
  } catch {
    return []
  }
}
function save(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* 무시 */
  }
}
export function inCart(id) {
  return getCart().some((p) => p.id === id)
}
/** 담기. 꽉 찼으면 false */
export function addToCart(product) {
  const list = getCart().filter((p) => p.id !== product.id)
  if (list.length >= MAX_COMPARE) return false
  list.push(product)
  save(list)
  return true
}
export function removeFromCart(id) {
  save(getCart().filter((p) => p.id !== id))
}
export function clearCart() {
  save([])
}
