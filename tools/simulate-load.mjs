// 模拟 DSH __ModuleLoader__ 环境，加载 plugin/client.js 验证能注册、apply 不抛错、
// 三个 slot 都能注册、指示器组件能渲染出正确文本。
import { readFileSync } from 'node:fs'

// --- 最小 React stub ---
let effects = []
function createElement(type, props, ...children) {
  return { type, props: props || {}, children }
}
function useState(initial) {
  const get = typeof initial === 'function' ? null : initial
  return [typeof initial === 'function' ? initial() : initial, () => {}]
}
function useEffect(fn, deps) {
  effects.push(fn) // 记录但不执行副作用（模拟环境无 interval）；渲染不受影响
  return undefined
}
const React = { createElement, useState, useEffect }

// --- 模拟 __ModuleLoader__ ---
let registered = null
globalThis.window = {
  __ModuleLoader__: {
    load(handoff) { registered = { id: handoff.id, factory: handoff.factory } },
  },
}

// --- 模拟 localStorage ---
const storeKeys = {}
globalThis.localStorage = {
  getItem: (k) => (k in storeKeys ? storeKeys[k] : null),
  setItem: (k, v) => { storeKeys[k] = String(v) },
  removeItem: (k) => { delete storeKeys[k] },
}

// --- 模拟 document ---
const head = { _children: [], appendChild(n) { this._children.push(n) }, removeChild() {} }
const styleEl = { dataset: {}, styleTag: true, _text: '', set textContent(v){ this._text = v }, get textContent(){ return this._text }, remove() {} }
globalThis.document = {
  head,
  createElement(tag) {
    if (tag === 'style') return { ...styleEl }
    return { dataset: {}, styleTag: false, remove() {}, set textContent(v){}, appendChild(){} }
  },
}

// --- 模拟 require ---
const requireFn = (spec) => {
  if (spec === 'react') return React
  throw new Error('unexpected require: ' + spec)
}

// 读取并执行 client bundle
const code = readFileSync(new URL('../plugin/client.js', import.meta.url), 'utf8')
new Function('require', code)(requireFn)

if (!registered) { console.error('FAIL: __ModuleLoader__.load 未被调用'); process.exit(1) }
console.log('registered id:', registered.id)

const exportsObj = registered.factory(requireFn)
console.log('exports keys:', Object.keys(exportsObj))
console.log('inject:', JSON.stringify(exportsObj.inject))

if (!exportsObj.inject.includes('slots') || !exportsObj.inject.includes('timer')) {
  console.error('FAIL: inject 缺失 slots/timer'); process.exit(1)
}

// --- 模拟 ctx（捕获多次 slots.register） ---
const registeredSlots = []
const slotsMock = {
  inject: (name, cb) => { cb() },
  register: (spec, comp) => { registeredSlots.push({ spec, comp }); return () => {} },
}
const ctx = {
  get: (key) => { if (key === 'slots') return slotsMock; return undefined },
  effect: () => () => {},
  interval: () => () => {},
  timeout: () => () => {},
}

try { exportsObj.apply(ctx); console.log('apply OK') } catch (e) { console.error('FAIL: apply 抛错', e); process.exit(1) }

const names = registeredSlots.map((s) => s.spec.name)
console.log('registered slots:', JSON.stringify(names))

function mustHaveSlot(name, id) {
  const hit = registeredSlots.find((s) => s.spec.name === name && (!id || s.spec.id === id))
  if (!hit) { console.error(`FAIL: 未注册 to ${name}${id ? ' id='+id : ''}`); process.exit(1) }
  return hit
}

const header = mustHaveSlot('conversation.session.header.actions', 'price-indicator')
mustHaveSlot('sidebar.footer.action', 'price-indicator')
mustHaveSlot('shell.overlay', 'price-indicator-menu')
console.log('all 3 slots registered OK')

// --- 渲染 header 指示器并检查文本 ---
const flatten = (n) => {
  if (n == null) return []
  if (typeof n === 'string' || typeof n === 'number') return [String(n)]
  if (typeof n === 'object' && n !== null) {
    if (typeof n.type === 'function') {
      // 函数组件：调用它以展开子树
      return flatten(n.type(n.props || {}))
    }
    const arr = []
    if (n.type) arr.push('<' + (typeof n.type === 'string' ? n.type : 'Comp') + '>')
    if (n.children) for (const c of n.children) arr.push(...flatten(c))
    return arr
  }
  return []
}

try {
  const tree = header.comp({})
  const parts = flatten(tree).join(' ')
  console.log('indicator render:', parts)
  if (parts.includes('梁文谷') || parts.includes('梁文峰')) console.log('INDICATOR RENDER OK')
  else { console.error('FAIL: 指示器未渲染 梁文峰/梁文谷'); process.exit(1) }
} catch (e) { console.error('FAIL: 指示器渲染抛错', e && e.stack ? e.stack : e); process.exit(1) }

// --- 渲染 foot 按钮（wide 与 rail 两种） ---
try {
  const footWide = flatten(registeredSlots.find((s) => s.spec.name === 'sidebar.footer.action').comp({ wide: true })).join(' ')
  const footRail = flatten(registeredSlots.find((s) => s.spec.name === 'sidebar.footer.action').comp({ wide: false })).join(' ')
  console.log('foot wide:', footWide)
  console.log('foot rail:', footRail)
  if (footWide.includes('价格') && footRail.includes('📈')) console.log('FOOT BUTTON OK')
  else { console.error('FAIL: footer 按钮渲染异常'); process.exit(1) }
} catch (e) { console.error('FAIL: footer 渲染抛错', e && e.stack ? e.stack : e); process.exit(1) }

console.log('\nALL CHECKS PASSED')
