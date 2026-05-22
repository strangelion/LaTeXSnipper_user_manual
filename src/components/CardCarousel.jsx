import React, { useState, useEffect, useCallback, useRef } from 'react'

const DOT_ICONS = {
  'card-0': 'camera',
  'card-1': 'sigma',
  'card-2': 'pen',
  'card-3': 'file',
  'card-4': 'download',
  'card-5': 'monitor',
  'card-6': 'cloud',
  'card-7': 'layers',
  'card-8': 'book',
}

function DotIcon({ name }) {
  const p = { width: 14, height: 14, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (name) {
    case 'camera':   return <svg {...p}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
    case 'sigma':    return <svg {...p}><path d="M18 7V4H6l6 8-6 8h12v-3"/></svg>
    case 'pen':      return <svg {...p}><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
    case 'file':     return <svg {...p}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
    case 'download': return <svg {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
    case 'monitor':  return <svg {...p}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
    case 'cloud':    return <svg {...p}><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
    case 'layers':   return <svg {...p}><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
    case 'book':     return <svg {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
    default:         return null
  }
}

export default function CardCarousel({ cards, isMobile }) {
  const [current, setCurrent] = useState(0)
  const [flipped, setFlipped] = useState({})
  const sectionRef = useRef(null)
  const wrapperRef = useRef(null)
  const trackRef = useRef(null)

  const total = cards.length

  const goTo = useCallback((index) => {
    setCurrent(((index % total) + total) % total)
    setFlipped({})
  }, [total])

  const goNext = useCallback(() => {
    goTo(current + 1)
  }, [current, goTo])

  const goPrev = useCallback(() => {
    goTo(current - 1)
  }, [current, goTo])

  const toggleFlip = (id) => {
    setFlipped(prev => ({ ...prev, [id]: !prev[id] }))
  }

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); goPrev() }
      else if (e.key === 'ArrowRight') { e.preventDefault(); goNext() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [goPrev, goNext])

  // Drag/swipe support (mouse + touch)
  useEffect(() => {
    const track = trackRef.current
    if (!track) return
    let startX = 0
    let startY = 0
    let isDragging = false
    let isHorizontalDrag = false

    const onPointerDown = (e) => {
      startX = 'touches' in e ? e.touches[0].clientX : e.clientX
      startY = 'touches' in e ? e.touches[0].clientY : e.clientY
      isDragging = true
      isHorizontalDrag = false
    }

    const onPointerMove = (e) => {
      if (!isDragging) return
      if (isHorizontalDrag) {
        e.preventDefault()
        return
      }
      const cx = 'touches' in e ? e.touches[0].clientX : e.clientX
      const cy = 'touches' in e ? e.touches[0].clientY : e.clientY
      const dx = cx - startX
      const dy = cy - startY
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) {
        isHorizontalDrag = true
      }
    }

    const onPointerUp = (e) => {
      if (!isDragging) return
      isDragging = false
      if (!isHorizontalDrag) return
      const endX = 'changedTouches' in e ? e.changedTouches[0].clientX : e.clientX
      const dx = endX - startX
      if (dx > 50) goPrev()
      else if (dx < -50) goNext()
      isHorizontalDrag = false
    }

    // Touch events
    track.addEventListener('touchstart', onPointerDown, { passive: true })
    track.addEventListener('touchmove', onPointerMove, { passive: false })
    track.addEventListener('touchend', onPointerUp, { passive: true })

    // Mouse events (desktop only)
    if (!isMobile) {
      track.addEventListener('mousedown', onPointerDown)
      track.addEventListener('mousemove', onPointerMove)
      track.addEventListener('mouseup', onPointerUp)
      // Prevent text selection while dragging
      const preventDrag = (e) => { if (isHorizontalDrag) e.preventDefault() }
      track.addEventListener('dragstart', preventDrag)
      return () => {
        track.removeEventListener('touchstart', onPointerDown)
        track.removeEventListener('touchmove', onPointerMove)
        track.removeEventListener('touchend', onPointerUp)
        track.removeEventListener('mousedown', onPointerDown)
        track.removeEventListener('mousemove', onPointerMove)
        track.removeEventListener('mouseup', onPointerUp)
        track.removeEventListener('dragstart', preventDrag)
      }
    }

    return () => {
      track.removeEventListener('touchstart', onPointerDown)
      track.removeEventListener('touchmove', onPointerMove)
      track.removeEventListener('touchend', onPointerUp)
    }
  }, [goPrev, goNext, isMobile])

  // Scroll-driven entrance/exit
  useEffect(() => {
    if (isMobile) return

    const handleScroll = () => {
      const section = sectionRef.current
      const wrapper = wrapperRef.current
      if (!section || !wrapper) return

      const rect = section.getBoundingClientRect()
      const vh = window.innerHeight
      const sh = section.offsetHeight
      const scrollRange = Math.max(sh - vh, 1)
      const progress = Math.max(0, Math.min(1,
        1 - (rect.top + rect.height) / (vh + rect.height)
      ))

      const easeOut = (t) => 1 - Math.pow(1 - t, 3)
      const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
      const segment = (p, a, b) => clamp((p - a) / (b - a), 0, 1)
      const lerp = (a, b, t) => a + (b - a) * t

      // Entrance: 0-25% → fade in & scale up
      // Active: 25-75% → stable, navigation active
      // Exit: 75-100% → fade out & scale down
      let scale, opacity

      if (progress < 0.25) {
        const t = easeOut(segment(progress, 0, 0.25))
        scale = lerp(0.7, 1, t)
        opacity = t
      } else if (progress < 0.75) {
        scale = 1
        opacity = 1
      } else {
        const t = easeOut(segment(progress, 0.75, 1))
        scale = lerp(1, 0.7, t)
        opacity = 1 - t
      }

      wrapper.style.transform = `scale(${scale.toFixed(4)})`
      wrapper.style.opacity = opacity.toFixed(4)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [isMobile])

  return (
    <section
      className="slide-section carousel-section"
      data-slide="carousel"
      ref={sectionRef}
    >
      <div className="slide-scroll">
        <div className="carousel-container" ref={wrapperRef}>
          {/* Track */}
          <div className="carousel-track" ref={trackRef} style={{ transform: `translateX(-${current * 100}%)` }}>
            {cards.map((card) => (
              <div key={card.id} className="carousel-slide">
                <div className={`carousel-card ${flipped[card.id] ? 'show-detail' : ''}`}>
                  {/* Front face */}
                  <div className="carousel-front">
                    <h3>{card.title}</h3>
                    <p>{card.brief}</p>
                    <button
                      className="carousel-flip-btn"
                      onClick={() => toggleFlip(card.id)}
                    >
                      了解更多 →
                    </button>
                  </div>

                  {/* Detail face */}
                  <div className="carousel-detail">
                    <div className="carousel-detail-inner">
                      <p>{card.detail}</p>
                      <button
                        className="carousel-flip-btn back"
                        onClick={() => toggleFlip(card.id)}
                      >
                        ← 返回
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Nav arrows (always visible for looping) */}
          <button className="carousel-arrow carousel-arrow-left" onClick={goPrev}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="carousel-arrow carousel-arrow-right" onClick={goNext}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>

          {/* Dots */}
          <div className="carousel-dots">
            {cards.map((card, i) => (
              <button
                key={card.id}
                className={`carousel-dot ${i === current ? 'active' : ''}`}
                onClick={() => goTo(i)}
                title={card.title}
                aria-label={`第 ${i + 1} 张卡片`}
              >
                <DotIcon name={DOT_ICONS[card.id] || 'circle'} />
              </button>
            ))}
          </div>

          {/* Counter */}
          <div className="carousel-counter">
            {current + 1} / {total}
          </div>
        </div>
      </div>
    </section>
  )
}
