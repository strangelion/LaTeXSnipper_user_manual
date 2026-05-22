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
      const progress = Math.max(0, Math.min(1, 1 - (rect.top + rect.height) / (vh + rect.height)))

      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      const lerp = (a, b, t) => a + (b - a) * t
      const segment = (p, a, b) => clamp((p - a) / (b - a), 0, 1)
      // Cinematic easing — folio-2025 style power curves
      const easeOut = (t) => 1 - Math.pow(1 - t, 3)
      const easeInOut = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

      const c = segment(progress, 0, 0.7)

      let wrapScale, wrapOpacity, frontWidth, detailLeft, briefOpacity

      if (c < 0.05) {
        const t = easeOut(c / 0.05)
        wrapScale = lerp(0.5, 1, t)
        wrapOpacity = t
        frontWidth = 100
        detailLeft = 100
        briefOpacity = 1
      } else if (c < 0.18) {
        wrapScale = 1
        wrapOpacity = 1
        frontWidth = 100
        detailLeft = 100
        briefOpacity = 1
      } else if (c < 0.36) {
        const t = easeInOut((c - 0.18) / 0.18)
        wrapScale = 1
        wrapOpacity = 1
        frontWidth = lerp(100, 30, t)
        detailLeft = lerp(100, 30, t)
        briefOpacity = lerp(1, 0, t)
      } else if (c < 0.55) {
        wrapScale = 1
        wrapOpacity = 1
        frontWidth = 30
        detailLeft = 30
        briefOpacity = 0
      } else if (c < 0.7) {
        const t = easeInOut((c - 0.55) / 0.15)
        wrapScale = 1
        wrapOpacity = 1
        frontWidth = lerp(30, 100, t)
        detailLeft = lerp(30, 100, t)
        briefOpacity = lerp(0, 1, t)
      } else {
        const t = easeOut((c - 0.7) / 0.3)
        wrapScale = lerp(1, 0.4, t)
        wrapOpacity = 1 - t
        frontWidth = 100
        detailLeft = 100
        briefOpacity = 1
      }

      wrapperRef.current.style.transform = `scale(${wrapScale.toFixed(4)})`
      wrapperRef.current.style.opacity = wrapOpacity.toFixed(4)
      frontRef.current.style.width = `${frontWidth.toFixed(1)}%`
      detailRef.current.style.left = `${detailLeft.toFixed(1)}%`

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
