export class ApiError extends Error {
  constructor(message, { kind = 'server', status } = {}) {
    super(message)
    this.kind = kind // 'network' | 'timeout' | 'server' | 'notfound'
    this.status = status
  }
}
