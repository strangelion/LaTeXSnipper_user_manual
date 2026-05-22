import React, { useEffect, useRef } from 'react'

export default function CardSlide({ card, isMobile }) {
  const sectionRef = useRef(null)
  const wrapperRef = useRef(null)
  const frontRef = useRef(null)
  const detailRef = useRef(null)

  // —— 移动端：滚动驱动的平滑渐入 + 视差 ——
  useEffect(() => {
    if (!isMobile) return
    const wrapper = wrapperRef.current
    if (!wrapper) return

    let raf = null

    const update = () => {
      raf = null
      const rect = wrapper.getBoundingClientRect()
      const vh = window.innerHeight

      // 计算卡片在视口中的可见比例
      const visible = Math.max(0, Math.min(1,
        (vh - rect.top) / (vh + rect.height)
      ))

      // 缓动：先快后慢
      const easeOut = (t) => 1 - Math.pow(1 - t, 2.5)
      const p = easeOut(Math.min(visible * 1.5, 1))

      // 透明度：从 0 → 1
      const opacity = Math.min(1, p * 1.3)
      // 上滑：从 50px → 0
      const translateY = (1 - p) * 50
      // 微缩放：从 0.92 → 1.0
      const scale = 0.92 + p * 0.08

      wrapper.style.opacity = opacity.toFixed(4)
      wrapper.style.transform = `translateY(${translateY.toFixed(1)}px) scale(${scale.toFixed(4)})`
    }

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    // 初始检查：如果已在视口中则立刻显示
    update()

    return () => {
      window.removeEventListener('scroll', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [isMobile])

  useEffect(() => {
    if (isMobile) return

    const handleScroll = () => {
      if (!sectionRef.current || !wrapperRef.current || !frontRef.current || !detailRef.current) return

      const rect = sectionRef.current.getBoundingClientRect()
      const vh = window.innerHeight
      const sectionHeight = sectionRef.current.offsetHeight
      const scrollRange = Math.max(sectionHeight - vh, 1)

      // 根据页面高度 / 视口高度动态计算分段边界
      // ratio 越小表示滚动空间越大，各阶段可分配更多进度
      const ratio = vh / scrollRange
      const scaleFactor = Math.min(1, Math.max(0.3, ratio * 1.2))
      // 各阶段占 active 区域的比例（基于滚动空间动态调整）
      const entranceP = 0.06 * scaleFactor
      const holdP = entranceP + 0.10 * scaleFactor
      const slideInP = holdP + 0.22 * scaleFactor
      const detailHoldP = slideInP + 0.18 * scaleFactor
      const slideOutP = detailHoldP + 0.20 * scaleFactor
      const exitStartP = slideOutP + 0.08 * scaleFactor
      // active 范围结束位置 = exitStartP，剩余为退场

      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      const lerp = (a, b, t) => a + (b - a) * t
      const segment = (p, a, b) => clamp((p - a) / (b - a), 0, 1)
      const easeOut = (t) => 1 - Math.pow(1 - t, 3)
      const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

      const progress = Math.max(0, Math.min(1, 1 - (rect.top + rect.height) / (vh + rect.height)))

      let wrapScale, wrapOpacity, frontX, detailX, briefOpacity

      if (progress < entranceP) {
        const t = easeOut(segment(progress, 0, entranceP))
        wrapScale = lerp(0.5, 1, t)
        wrapOpacity = t
        frontX = 0
        detailX = 100
        briefOpacity = 1
      } else if (progress < holdP) {
        wrapScale = 1
        wrapOpacity = 1
        frontX = 0
        detailX = 100
        briefOpacity = 1
      } else if (progress < slideInP) {
        const t = easeInOut(segment(progress, holdP, slideInP))
        wrapScale = 1
        wrapOpacity = 1
        // front 向左滑出，detail 从右侧滑入 → 左右滑动效果
        frontX = lerp(0, -100, t)
        detailX = lerp(100, 0, t)
        briefOpacity = lerp(1, 0, t)
      } else if (progress < detailHoldP) {
        wrapScale = 1
        wrapOpacity = 1
        frontX = -100
        detailX = 0
        briefOpacity = 0
      } else if (progress < slideOutP) {
        const t = easeInOut(segment(progress, detailHoldP, slideOutP))
        wrapScale = 1
        wrapOpacity = 1
        frontX = lerp(-100, 0, t)
        detailX = lerp(0, 100, t)
        briefOpacity = lerp(0, 1, t)
      } else if (progress < exitStartP) {
        wrapScale = 1
        wrapOpacity = 1
        frontX = 0
        detailX = 100
        briefOpacity = 1
      } else {
        const t = easeOut(segment(progress, exitStartP, 1))
        wrapScale = lerp(1, 0.4, t)
        wrapOpacity = 1 - t
        frontX = 0
        detailX = 100
        briefOpacity = 1
      }

      wrapperRef.current.style.transform = `scale(${wrapScale.toFixed(4)})`
      wrapperRef.current.style.opacity = wrapOpacity.toFixed(4)
      frontRef.current.style.transform = `translateX(${frontX.toFixed(1)}%)`
      detailRef.current.style.transform = `translateX(${detailX.toFixed(1)}%)`

      const brief = frontRef.current.querySelector('p')
      if (brief) brief.style.opacity = briefOpacity.toFixed(4)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  return (
    <section className="slide-section card-slide" data-slide={card.id} ref={sectionRef}>
      <div className="slide-scroll">
        <div className="card-wrapper" ref={wrapperRef}>
          <div className="card-viewport">
            <div className="card-front" ref={frontRef}>
              <h3>{card.title}</h3>
              <p>{card.brief}</p>
            </div>
            <div className="card-detail" ref={detailRef}>
              <div className="card-detail-inner">
                <p>{card.detail}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
