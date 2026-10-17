import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'

type EditableField = HTMLInputElement | HTMLTextAreaElement

const supportedTypes = new Set(['text', 'tel', 'number', 'email', 'search', 'url', 'password'])

const editableField = (target: EventTarget | null): EditableField | null => {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return null
  if (target.closest('[data-mobile-input-sheet]')) return null
  if (target.disabled || target.readOnly || target.tabIndex < 0) return null
  if (target instanceof HTMLInputElement && !supportedTypes.has(target.type || 'text')) return null
  return target
}

const fieldTitle = (field: EditableField) => {
  const ariaLabel = field.getAttribute('aria-label')?.trim()
  if (ariaLabel) return ariaLabel
  const label = field.closest('label')
  const labelText = label?.querySelector(':scope > span')?.textContent?.trim()
  return labelText || field.placeholder || 'Введите значение'
}

const inputModeFor = (field: EditableField) => {
  if (field.inputMode) return field.inputMode
  if (field instanceof HTMLTextAreaElement) return 'text'
  if (field.type === 'number') return 'decimal'
  if (field.type === 'tel') return 'tel'
  if (field.type === 'email') return 'email'
  if (field.type === 'search') return 'search'
  if (field.type === 'url') return 'url'
  return 'text'
}

const updateNativeValue = (field: EditableField, value: string) => {
  const prototype = field instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set
  setter?.call(field, value)
  field.dispatchEvent(new Event('input', { bubbles: true }))
}

export function MobileInputSheet() {
  const [field, setField] = useState<EditableField | null>(null)
  const [value, setValue] = useState('')
  const [entered, setEntered] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [dragY, setDragY] = useState(0)
  const sheetFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const fieldRef = useRef<EditableField | null>(null)
  const revealTimerRef = useRef<number | null>(null)
  const closeTimerRef = useRef<number | null>(null)
  const blurTimerRef = useRef<number | null>(null)
  const gestureRef = useRef<{ field: EditableField | null, x: number, y: number, moved: boolean } | null>(null)
  const pendingOpenRef = useRef<EditableField | null>(null)
  const openedAtRef = useRef(0)
  const suppressClickRef = useRef(false)
  const dragRef = useRef({ pointerId: -1, startY: 0, startedAt: 0 })

  fieldRef.current = field

  const openFor = (nextField: EditableField) => {
    if (!window.matchMedia('(max-width: 767px)').matches) return
    openedAtRef.current = performance.now()
    nextField.blur()
    flushSync(() => {
      setValue(nextField.value)
      setDragY(0)
      setDragging(false)
      setEntered(false)
      setField(nextField)
    })
  }

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const nextField = editableField(event.target)
      if (!nextField || !window.matchMedia('(max-width: 767px)').matches) {
        gestureRef.current = null
        return
      }
      suppressClickRef.current = false
      gestureRef.current = { field: nextField, x: event.clientX, y: event.clientY, moved: false }
    }
    const onPointerMove = (event: PointerEvent) => {
      const gesture = gestureRef.current
      if (!gesture) return
      if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 10) gesture.moved = true
    }
    const onPointerUp = (event: PointerEvent) => {
      const gesture = gestureRef.current
      gestureRef.current = null
      if (!gesture?.field) return
      if (gesture.moved) {
        suppressClickRef.current = true
        window.setTimeout(() => { suppressClickRef.current = false }, 400)
        return
      }
      event.preventDefault()
      pendingOpenRef.current = gesture.field
      window.setTimeout(() => {
        const pendingField = pendingOpenRef.current
        if (!pendingField) return
        pendingOpenRef.current = null
        openFor(pendingField)
      }, 0)
    }
    const onClick = (event: MouseEvent) => {
      const nextField = editableField(event.target)
      if (!nextField || !window.matchMedia('(max-width: 767px)').matches) return
      event.preventDefault()
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      pendingOpenRef.current = null
      openFor(nextField)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerUp, true)
    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerUp, true)
      document.removeEventListener('click', onClick, true)
    }
  }, [])

  useLayoutEffect(() => {
    if (!field) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    sheetFieldRef.current?.focus({ preventScroll: true })

    const reveal = () => {
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
      revealTimerRef.current = window.setTimeout(() => {
        window.requestAnimationFrame(() => setEntered(true))
      }, 60)
    }
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', reveal)
    revealTimerRef.current = window.setTimeout(() => {
      window.requestAnimationFrame(() => setEntered(true))
    }, 120)

    return () => {
      viewport?.removeEventListener('resize', reveal)
      if (revealTimerRef.current) window.clearTimeout(revealTimerRef.current)
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current)
      if (blurTimerRef.current) window.clearTimeout(blurTimerRef.current)
      document.body.style.overflow = previousOverflow
    }
  }, [field])

  if (!field) return null

  const close = () => {
    if (closeTimerRef.current) return
    setDragging(false)
    setEntered(false)
    blurTimerRef.current = window.setTimeout(() => sheetFieldRef.current?.blur(), 90)
    closeTimerRef.current = window.setTimeout(() => {
      fieldRef.current?.dispatchEvent(new Event('change', { bubbles: true }))
      fieldRef.current?.blur()
      closeTimerRef.current = null
      setField(null)
      setDragY(0)
    }, 280)
  }

  const closeFromBackdrop = () => {
    if (performance.now() - openedAtRef.current < 500) return
    close()
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startedAt: performance.now() }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    setDragging(true)
  }
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return
    setDragY(Math.max(0, event.clientY - dragRef.current.startY))
  }
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return
    const distance = Math.max(0, event.clientY - dragRef.current.startY)
    const elapsed = Math.max(1, performance.now() - dragRef.current.startedAt)
    dragRef.current.pointerId = -1
    setDragging(false)
    if (distance > 90 || distance / elapsed > 0.65) close()
    else setDragY(0)
  }

  const multiline = field instanceof HTMLTextAreaElement
  const title = fieldTitle(field)
  const sharedProps = {
    ref: sheetFieldRef as never,
    value,
    placeholder: field.placeholder,
    inputMode: inputModeFor(field) as React.HTMLAttributes<HTMLInputElement>['inputMode'],
    autoComplete: field.autocomplete,
    maxLength: field.maxLength,
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setValue(event.target.value)
      updateNativeValue(field, event.target.value)
    },
    onKeyDown: (event: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (!multiline && event.key === 'Enter') {
        event.preventDefault()
        close()
      }
    },
  }

  return createPortal(
    <div className="mobile-input-sheet" data-mobile-input-sheet role="presentation">
      <div aria-label="Закрыть ввод" className="mobile-input-sheet-backdrop" role="button" style={{ opacity: entered ? 1 : 0 }} onClick={closeFromBackdrop} />
      <section
        aria-label={title}
        aria-modal="true"
        className="mobile-input-sheet-panel"
        role="dialog"
        style={{
          transform: entered ? `translate3d(0, ${dragY}px, 0)` : 'translate3d(0, 100%, 0)',
          transition: dragging ? 'none' : 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        <div className="mobile-input-sheet-handle" onPointerCancel={finishDrag} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}>
          <span />
          <h2>{title}</h2>
        </div>
        {multiline
          ? <textarea {...sharedProps} ref={sheetFieldRef as React.Ref<HTMLTextAreaElement>} rows={5} />
          : <input {...sharedProps} ref={sheetFieldRef as React.Ref<HTMLInputElement>} type={field instanceof HTMLInputElement && field.type === 'password' ? 'password' : 'text'} />}
      </section>
    </div>,
    document.body,
  )
}
