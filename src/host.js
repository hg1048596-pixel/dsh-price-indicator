/*
 * dsh-price-indicator —— Host 半端源码
 *
 * 用法：在 DeepSeek Harness 的 Cordis 插件开发流程中（cordis_define），
 * 把本文件内容整体作为 code.host 传入。该函数体返回一个 Cordis Plugin。
 *
 * 价格低谷/高峰的判断与倒计时是纯前端逻辑，无需 Host 侧 RPC。
 * 此文件为空实现占位，仅满足动态插件的 host 半端形式要求。
 */
return {
  name: 'dsh-price-indicator-host',
  inject: ['timer'],
  apply(ctx) {
    // 纯展示插件，无 Host 逻辑。
  },
}
