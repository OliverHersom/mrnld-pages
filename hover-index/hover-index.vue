<script>
const DEFAULT_PROJECTS = [
  { name: 'Ledvance Pavilion', image: 'images/01.jpg', alt: 'An orange staircase lit from above beside a glowing LEDVANCE sign' },
  { name: 'Urbanite Street', image: 'images/02.jpg', alt: 'A woman in on-ear headphones waiting at a sunny crosswalk' },
  { name: 'Brick House', image: 'images/03.jpg', alt: 'A pale brick gabled house at dusk with a large glass door' },
  { name: 'City Run', image: 'images/04.jpg', alt: 'A runner stretching on a stone bench in low evening sun' },
  { name: 'Gameday', image: 'images/05.jpg', alt: 'An athlete training at a machine with a results screen' },
  { name: 'Aira Identity', image: 'images/06.jpg', alt: 'Two hands reaching toward each other around the AIRA wordmark' },
  { name: 'Aira App', image: 'images/07.jpg', alt: 'A phone showing a hot water timer in a dark app' },
  { name: 'Aira Web', image: 'images/08.jpg', alt: 'Two tablets showing the Aira heat pump website' },
  { name: 'Aira Campaign', image: 'images/09.jpg', alt: 'An Aira billboard with floating fabric in a tiled underpass' },
  { name: 'Track Light', image: 'images/10.jpg', alt: 'White and black track spotlights against orange scaffolding' },
  { name: 'Urbanite Still', image: 'images/11.jpg', alt: 'Red and navy headphones resting on a concrete ledge' },
  { name: 'Urbanite Mural', image: 'images/12.jpg', alt: 'A young woman with headphones leaning on a graffiti wall by a bicycle' },
  { name: 'Home Unit', image: 'images/13.jpg', alt: 'A white wall unit in raking light with leaf shadows' },
  { name: 'Gameday Login', image: 'images/14.jpg', alt: 'A hand tapping a training machine screen to log in' },
  { name: 'Qbo', image: 'images/15.jpg', alt: 'A dark coffee machine with a milk jug, capsules and a latte' },
  { name: 'Sport Series', image: 'images/16.jpg', alt: 'Wet sport earphones wrapped around a bottle with a spray of water' },
]
</script>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { gsap } from 'gsap'
import { CustomEase } from 'gsap/CustomEase'

if (typeof window !== 'undefined') {
  gsap.registerPlugin(CustomEase)
  CustomEase.create('annnimate', 'M0,0 C0.3,0.9 0.1,1 1,1')
  CustomEase.create('annnimateInOut', 'M0,0 C0.7,0 0.16,1 1,1')
}

function toNumber(value, fallback) {
  const n = parseFloat(value)
  return isNaN(n) ? fallback : n
}

// Hover Index - A dark work index where your pointer is the lens: every
// project name brightens by how close it sits to the cursor, so the light
// falls off smoothly across the list, and a large preview card in the bottom
// right wipes to the next photo in the direction you move.
const props = defineProps({
  className: { type: String, default: '' },
  // range: How many rows the light falls off over (1.2-3)
  range: { type: Number, default: 2 },
  // dim: How bright the far names stay (4-30)
  dim: { type: Number, default: 14 },
  // follow: How quickly the lens catches up with the pointer (4-16)
  follow: { type: Number, default: 9 },
  // projects: [{ name, image, alt }] - empty uses the built-in list (defineProps cannot see DEFAULT_PROJECTS)
  projects: { type: Array, default: () => [] },
})

const projectList = computed(() => (props.projects && props.projects.length ? props.projects : DEFAULT_PROJECTS))

// --- Template refs ---
const containerRef = ref(null)
const itemNodes = []
function setItem(i, el) {
  itemNodes[i] = el
}
const listRef = ref(null)
const cardRef = ref(null)
const frameRef = ref(null)

let instance = null
let ctx = null
let unmounted = false

function initHoverIndex() {
  // --- 1. Selectors ---
  const container = containerRef.value
  const items = itemNodes.slice(0, projectList.value.length).filter(Boolean)
  const list = listRef.value
  const card = cardRef.value
  const frame = frameRef.value

  if (items.length < 2 || !list) return null

  // --- 2. Config ---
  const range = Math.min(6, Math.max(1.2, toNumber(props.range, 2)))
  const dim = Math.min(40, Math.max(0, toNumber(props.dim, 14))) / 100
  const follow = Math.min(20, Math.max(3, toNumber(props.follow, 9)))

  // --- 3. Constants ---
  // Brightness falls off with distance from the lens on this curve, so the rows next to it stay readable.
  const CURVE = 1.6
  // How much bigger the name under the lens gets (0.15 = 15%).
  const GROW = 0.15
  const WIPE = 0.7
  const SETTLE = 0.001
  const DESKTOP_QUERY = '(min-width: 768px)'
  const RESIZE_DEBOUNCE = 150

  // --- 4. State ---
  const count = items.length
  const state = { f: Math.floor((count - 1) / 2), target: Math.floor((count - 1) / 2) }
  let active = -1
  let centers = []
  let imgs = []
  let wipes = []
  let layer = 1
  let demoTl = null
  let lastTime = 0
  let dirty = true
  let reduced = false
  let resizeTimer = null

  // --- 5. Helpers ---
  function measure() {
    const box = container.getBoundingClientRect()
    centers = items.map((el) => {
      const r = el.getBoundingClientRect()
      return r.top - box.top + r.height / 2
    })
    // The card sits bottom right with its bottom edge on the list's last row.
    if (!card) return
    if (window.matchMedia(DESKTOP_QUERY).matches) {
      card.style.top = (list.getBoundingClientRect().bottom - box.top - card.offsetHeight).toFixed(1) + 'px'
    } else {
      card.style.removeProperty('top')
    }
  }

  // The pointer's height maps onto the list as a continuous row number, so the lens glides between rows.
  function rowAt(y) {
    if (y <= centers[0]) return 0
    for (let i = 1; i < count; i++) {
      if (y <= centers[i]) return i - 1 + (y - centers[i - 1]) / (centers[i] - centers[i - 1])
    }
    return count - 1
  }

  // --- 6. Animation routines ---
  function buildImages() {
    imgs = items.map((item, i) => {
      const img = document.createElement('img')
      img.className = 'hi_img'
      img.src = item.getAttribute('data-image') || ''
      img.alt = ''
      img.decoding = 'async'
      img.style.setProperty('--hi-clip-top', i === Math.round(state.f) ? '0%' : '100%')
      frame.appendChild(img)
      return img
    })
    wipes = imgs.map(() => null)
  }

  // The new photo comes in from the side the lens is moving toward and lands over the last one.
  function showImage(i, dir) {
    const img = imgs[i]
    if (!img) return
    if (wipes[i]) wipes[i].kill()
    img.style.zIndex = String(++layer)
    const fromTop = dir > 0 ? '100%' : '0%'
    const fromBottom = dir > 0 ? '0%' : '100%'
    wipes[i] = gsap.fromTo(img,
      { '--hi-clip-top': fromTop, '--hi-clip-bottom': fromBottom },
      { '--hi-clip-top': '0%', '--hi-clip-bottom': '0%', duration: reduced ? 0 : WIPE, ease: 'annnimate' })
  }

  function setActive(i) {
    if (i === active) return
    const dir = active < 0 ? 1 : Math.sign(i - active)
    active = i
    showImage(i, dir)
  }

  function paint() {
    items.forEach((el, i) => {
      const near = Math.max(0, 1 - Math.abs(i - state.f) / range)
      const glow = Math.pow(near, CURVE)
        el.style.opacity = (dim + (1 - dim) * glow).toFixed(3)
        el.style.transform = 'scale(' + (1 + GROW * glow).toFixed(4) + ')'
    })
    setActive(Math.round(state.f))
  }

  function tick() {
    const now = gsap.ticker.time
    const dt = Math.max(1 / 240, now - lastTime)
    lastTime = now
    const before = state.f
    state.f = reduced ? state.target : state.f + (state.target - state.f) * (1 - Math.exp(-dt * follow))
    if (Math.abs(state.target - state.f) < SETTLE) state.f = state.target
    if (state.f === before && !dirty) return
    dirty = false
    paint()
  }

  // Pre-built and paused (Timeline inspector contract): the lens runs down the list and back.
  function buildDemo() {
    const start = state.target
    demoTl = gsap.timeline({ paused: true })
    demoTl
      .to(state, { target: Math.min(count - 1, start + 3), duration: 1.2, ease: 'annnimateInOut', data: { label: 'Lens moves down the list' } }, 0.01)
      .to(state, { target: start, duration: 1.2, ease: 'annnimateInOut', data: { label: 'Lens moves back up' } }, '+=0.4')
  }

  function demo() {
    if (demoTl && demoTl.isActive()) return null
    demoTl.restart(true, false)
    return demoTl
  }

  // --- 7. Event listeners ---
  function handlePointerMove(e) {
    if (e.pointerType === 'touch') return
    if (demoTl) demoTl.pause()
    state.target = rowAt(e.clientY - container.getBoundingClientRect().top)
  }

  function handlePointerDown(e) {
    const i = items.indexOf(e.target.closest('[data-anm-hi-item]'))
    if (i > -1) state.target = i
  }

  function handleFocusIn(e) {
    const i = items.indexOf(e.target)
    if (i > -1) state.target = i
  }

  function handleKey(e) {
    const i = items.indexOf(document.activeElement)
    if (i < 0) return
    if (e.key === 'ArrowDown' && i < count - 1) { e.preventDefault(); items[i + 1].focus(); }
    else if (e.key === 'ArrowUp' && i > 0) { e.preventDefault(); items[i - 1].focus(); }
  }

  function handleResize() {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => {
      measure()
      dirty = true
    }, RESIZE_DEBOUNCE)
  }

  function handleVisibility() {
    if (document.hidden) gsap.globalTimeline.pause()
    else gsap.globalTimeline.resume()
  }

  container.addEventListener('pointermove', handlePointerMove)
  container.addEventListener('pointerdown', handlePointerDown)
  list.addEventListener('focusin', handleFocusIn)
  list.addEventListener('keydown', handleKey)
  window.addEventListener('resize', handleResize)
  document.addEventListener('visibilitychange', handleVisibility)

  // --- 8. Initial DOM state ---
  if (frame) buildImages()
  measure()
  active = Math.round(state.f)
  paint()
  buildDemo()
  lastTime = gsap.ticker.time
  gsap.ticker.add(tick)
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); dirty = true; })

  // --- 9. Reduced motion ---
  const mm = gsap.matchMedia()
  mm.add({ motion: '(prefers-reduced-motion: no-preference)', reduce: '(prefers-reduced-motion: reduce)' }, (ctx) => {
    reduced = !!ctx.conditions.reduce
    dirty = true
  })

  // --- 10. Public API ---
  function refresh() {
    measure()
    dirty = true
  }

  function kill() {
    gsap.ticker.remove(tick)
    container.removeEventListener('pointermove', handlePointerMove)
    container.removeEventListener('pointerdown', handlePointerDown)
    list.removeEventListener('focusin', handleFocusIn)
    list.removeEventListener('keydown', handleKey)
    window.removeEventListener('resize', handleResize)
    document.removeEventListener('visibilitychange', handleVisibility)
    clearTimeout(resizeTimer)
    mm.revert()
    if (demoTl) demoTl.kill()
    wipes.forEach((tw) => { if (tw) tw.kill(); })
    imgs.forEach((img) => img.remove())
    items.forEach((el) => { el.style.removeProperty('opacity'); el.style.removeProperty('transform') })
    if (card) card.style.removeProperty('top')
  }

  return { refresh, kill, demo }
}

function start() {
  if (unmounted || ctx) return
  ctx = gsap.context(() => {
    instance = initHoverIndex()
  }, containerRef.value)
}

function stop() {
  if (instance) instance.kill()
  instance = null
  if (ctx) ctx.revert()
  ctx = null
}

// --- Public API ---
defineExpose({
  refresh: (...args) => instance?.refresh(...args),
  demo: (...args) => instance?.demo(...args),
})

onMounted(() => {
  if (typeof window === 'undefined' || !containerRef.value) return
  start()
})

// Pre flush tears the old build down before Vue patches; post flush builds once the refs are set.
const rebuildOn = [
  () => props.range,
  () => props.dim,
  () => props.follow,
  () => props.projects,
]
watch(rebuildOn, () => stop(), { flush: 'pre' })
watch(rebuildOn, () => start(), { flush: 'post' })

onBeforeUnmount(() => {
  unmounted = true
  stop()
})
</script>

<template>
  <div
    ref="containerRef"
    :class="['hi_wrap', className]"
    data-anm-hover-index
    :data-anm-range="range"
    :data-anm-dim="dim"
    :data-anm-follow="follow"
  >
    <p class="hi_label">Selected work</p>
    <ol ref="listRef" class="hi_list" data-anm-hi-list>
      <li v-for="(project, i) in projectList" :key="project.name" class="hi_row">
        <button
          :ref="(el) => setItem(i, el)"
          class="hi_name"
          type="button"
          data-anm-hi-item
          :data-image="project.image"
          :data-alt="project.alt"
        >{{ project.name }}</button>
      </li>
    </ol>
    <figure ref="cardRef" class="hi_card" data-anm-hi-card aria-hidden="true">
      <div ref="frameRef" class="hi_frame" data-anm-hi-frame />
    </figure>
  </div>
</template>
