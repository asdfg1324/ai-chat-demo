import { computed, onMounted, onUnmounted, ref } from 'vue'

export function useVirtualScroll(
  getItems: () => any[],
  getContainer: () => HTMLElement | null,
  estimatedHeight = 180,
  threshold = 50
) {
  const scrollTop = ref(0)
  const containerHeight = ref(600)
  const layoutVersion = ref(0)
  const measuredHeights = new Map<number, number>()
  const itemObservers = new Map<number, { element: Element; observer: ResizeObserver }>()
  const items = computed(() => getItems())
  const useVirtual = computed(() => items.value.length > threshold)

  function heightAt(index: number) {
    return measuredHeights.get(index) || estimatedHeight
  }

  function offsetAt(index: number) {
    let offset = 0
    for (let i = 0; i < index; i++) offset += heightAt(i)
    return offset
  }

  const totalHeight = computed(() => {
    layoutVersion.value
    return offsetAt(items.value.length)
  })
  const startIndex = computed(() => {
    layoutVersion.value
    if (!useVirtual.value) return 0
    let index = 0
    let offset = 0
    while (index < items.value.length && offset + heightAt(index) < scrollTop.value) {
      offset += heightAt(index)
      index++
    }
    return Math.max(0, index - 5)
  })
  const endIndex = computed(() => {
    layoutVersion.value
    if (!useVirtual.value) return items.value.length
    const viewportEnd = scrollTop.value + containerHeight.value
    let index = startIndex.value
    let offset = offsetAt(index)
    while (index < items.value.length && offset < viewportEnd) {
      offset += heightAt(index)
      index++
    }
    return Math.min(items.value.length, index + 5)
  })
  const visibleItems = computed(() =>
    items.value.slice(startIndex.value, endIndex.value).map((item, index) => ({
      ...item,
      _vIndex: startIndex.value + index
    }))
  )
  const offsetY = computed(() => useVirtual.value ? offsetAt(startIndex.value) : 0)
  const bottomOffset = computed(() =>
    useVirtual.value ? Math.max(0, totalHeight.value - offsetAt(endIndex.value)) : 0
  )

  function onScroll() {
    const container = getContainer()
    if (container) {
      scrollTop.value = container.scrollTop
      containerHeight.value = container.clientHeight
    }
  }

  function measureItem(element: Element | null, index: number) {
    const existing = itemObservers.get(index)
    if (existing?.element === element) return
    existing?.observer.disconnect()
    itemObservers.delete(index)
    if (!element || typeof ResizeObserver === 'undefined') return

    const observer = new ResizeObserver(([entry]) => {
      const height = entry.borderBoxSize?.[0]?.blockSize || entry.contentRect.height
      if (height > 0 && measuredHeights.get(index) !== height) {
        measuredHeights.set(index, height)
        layoutVersion.value++
        onScroll()
      }
    })
    observer.observe(element)
    itemObservers.set(index, { element, observer })
  }

  let container: HTMLElement | null = null
  let containerObserver: ResizeObserver | null = null

  onMounted(() => {
    container = getContainer()
    if (container) {
      container.addEventListener('scroll', onScroll, { passive: true })
      containerHeight.value = container.clientHeight
      containerObserver = new ResizeObserver(onScroll)
      containerObserver.observe(container)
      onScroll()
    }
  })

  onUnmounted(() => {
    container?.removeEventListener('scroll', onScroll)
    containerObserver?.disconnect()
    for (const { observer } of itemObservers.values()) observer.disconnect()
    itemObservers.clear()
  })

  return { visibleItems, totalHeight, offsetY, bottomOffset, useVirtual, measureItem }
}
