/*
 * dsh-price-indicator — Host half（静态 web profile 版）
 *
 * 价格低谷/高峰的判断与倒计时完全是纯前端逻辑（基于本机时间与可配置的
 * 低谷时段），不需要 Host 侧 RPC 或服务。Host 半端保留为空实现（load 需要
 * 可导入的插件入口）。
 *
 * 启用/停用由插件市场（dsh-market）或插件管理页的开关控制：禁用 = 不加载。
 */
export const inject = []

export function apply() {
  // 无 Host 逻辑
}
