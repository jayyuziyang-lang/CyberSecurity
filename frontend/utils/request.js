function getCurrentUserId() {
  const currentUser = wx.getStorageSync('currentUser') || {}
  return currentUser.id || null
}

function getAuthHeaders(extraHeaders = {}) {
  const userId = getCurrentUserId()
  const headers = {
    ...extraHeaders
  }
  if (userId) {
    headers['X-User-Id'] = String(userId)
  }
  return headers
}

module.exports = {
  getCurrentUserId,
  getAuthHeaders
}
