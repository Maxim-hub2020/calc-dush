import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Minus,
  Plus,
  ScanLine,
  Send,
  ShowerHead,
  Truck,
} from 'lucide-react'
import { calculateQuote, calculateQuoteDelivery, money, normalizeQuoteDelivery, type CalculatorForm, type QuoteDelivery } from './calculator'
import { calculateMirrorQuote, createInitialMirrorForm, type MirrorForm } from './mirrorCalculator'
import { defaultMirrorCatalog } from './mirrorPricing'
import { defaultCatalog } from './pricing'
import { getConstructionThumbnailStyle } from './constructionThumbnails'
import './PublicCalculator.css'

type PublicProduct = 'shower' | 'mirror'

type PublicConfig = {
  price_version: string
  shower: {
    constructions: Array<{ id: string; title: string; shortTitle: string; fields: Array<{ key: string; label: string; defaultValue: number }> }>
    glass: Array<{ id: string; label: string }>
    hardware: Array<{ id: string; label: string }>
    hardwareClass: Array<{ id: string; label: string }>
  }
  mirror: {
    materials: Array<{ id: string; label: string }>
    services: Array<{ id: string; label: string }>
  }
  delivery: { insideLabel: string; outsideLabel: string }
  legal: { consent_url: string; privacy_url: string }
}

type PublicResult = {
  calculation_id: string
  amount: number
  price_version: string
  message: string
}

const createFallbackConfig = (): PublicConfig => ({
  price_version: 'local',
  shower: {
    constructions: defaultCatalog.constructions.map(({ id, title, shortTitle, fields }) => ({
      id,
      title,
      shortTitle,
      fields: fields.map(({ key, label, defaultValue }) => ({ key, label, defaultValue })),
    })),
    glass: defaultCatalog.glass.map(({ id, label }) => ({ id, label })),
    hardware: defaultCatalog.hardware.map(({ id, label }) => ({ id, label })),
    hardwareClass: defaultCatalog.hardwareClass.map(({ id, label }) => ({ id, label })),
  },
  mirror: {
    materials: defaultMirrorCatalog.materials.map(({ id, label }) => ({ id, label })),
    services: defaultMirrorCatalog.services
      .filter((item) => item.category !== 'delivery' && item.visibleInQuote)
      .map(({ id, label }) => ({ id, label })),
  },
  delivery: { insideLabel: 'По г. Ростов-на-Дону', outsideLabel: 'За городом' },
  legal: { consent_url: '/privacy', privacy_url: '/privacy' },
})

const initialShowerForm = (): CalculatorForm => ({
  constructionId: defaultCatalog.constructions[0].id,
  dimensions: Object.fromEntries(defaultCatalog.constructions[0].fields.map((field) => [field.key, field.defaultValue])),
  glassId: defaultCatalog.glass[0].id,
  hardwareId: defaultCatalog.hardware[0].id,
  hardwareClassId: defaultCatalog.hardwareClass[0].id,
  installation: false,
  delivery: false,
  deliveryZone: 'inside',
  deliveryKm: 0,
  discountEnabled: false,
  discountPercent: 0,
  designerEnabled: false,
  clientName: '',
  clientPhone: '',
  note: '',
})

const apiRequest = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(`/api/public-calculator/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const payload = await response.json() as T & { detail?: string }
  if (!response.ok) throw new Error(payload.detail || 'Не удалось выполнить запрос')
  return payload
}

const productSteps: Record<PublicProduct, string[]> = {
  shower: ['Тип', 'Размеры', 'Материалы', 'Доставка'],
  mirror: ['Размеры', 'Материал', 'Работы', 'Доставка'],
}

const formatPublicPhone = (value: string) => {
  let digits = value.replace(/\D/g, '')
  if (digits.startsWith('7') || digits.startsWith('8')) digits = digits.slice(1)
  digits = digits.slice(0, 10)

  let formatted = '+7'
  if (digits.length > 0) formatted += ` (${digits.slice(0, 3)}`
  if (digits.length >= 3) formatted += ')'
  if (digits.length > 3) formatted += ` ${digits.slice(3, 6)}`
  if (digits.length > 6) formatted += `-${digits.slice(6, 8)}`
  if (digits.length > 8) formatted += `-${digits.slice(8, 10)}`
  return formatted
}

export default function PublicCalculator() {
  const requestedProduct = new URLSearchParams(window.location.search).get('product')
  const isEmbedded = new URLSearchParams(window.location.search).get('embed') === '1'
  const [selectedProduct, setSelectedProduct] = useState<PublicProduct | null>(
    requestedProduct === 'mirror' ? 'mirror' : requestedProduct === 'shower' ? 'shower' : null,
  )
  const product = selectedProduct ?? 'shower'
  const [started, setStarted] = useState(false)
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [showerForm, setShowerForm] = useState<CalculatorForm>(() => initialShowerForm())
  const [mirrorForm, setMirrorForm] = useState<MirrorForm>(() => createInitialMirrorForm(defaultMirrorCatalog))
  const [delivery, setDelivery] = useState<QuoteDelivery>(() => normalizeQuoteDelivery(null))
  const [result, setResult] = useState<PublicResult | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [contact, setContact] = useState({ name: '', phone: '+7', company: '' })

  useEffect(() => {
    let cancelled = false
    apiRequest<PublicConfig>('config/')
      .then((data) => {
        if (cancelled) return
        setConfig(data)
        const construction = data.shower.constructions[0]
        setShowerForm((current) => ({
          ...current,
          constructionId: construction.id,
          dimensions: Object.fromEntries(construction.fields.map((field) => [field.key, field.defaultValue])),
          glassId: data.shower.glass[0].id,
          hardwareId: data.shower.hardware[0].id,
          hardwareClassId: data.shower.hardwareClass[0].id,
        }))
        setMirrorForm((current) => ({ ...current, materialId: data.mirror.materials[0].id }))
      })
      .catch(() => {
        if (cancelled) return
        if (import.meta.env.DEV) setConfig(createFallbackConfig())
        else setError('Не удалось загрузить калькулятор. Обновите страницу или попробуйте позже.')
      })
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  const publicConstruction = config?.shower.constructions.find((item) => item.id === showerForm.constructionId)
    ?? config?.shower.constructions[0]
  const steps = productSteps[product]

  const changeProduct = (next: PublicProduct) => {
    setSelectedProduct(next)
    setStep(0)
    setResult(null)
    setSent(false)
    setError('')
    const url = new URL(window.location.href)
    url.searchParams.set('product', next)
    window.history.replaceState({}, '', url)
  }

  const selectConstruction = (id: string) => {
    const next = config?.shower.constructions.find((item) => item.id === id)
    if (!next) return
    setShowerForm((current) => ({
      ...current,
      constructionId: id,
      dimensions: Object.fromEntries(next.fields.map((field) => [field.key, field.defaultValue])),
    }))
  }

  const setDimension = (key: string, value: number) => {
    setShowerForm((current) => ({ ...current, dimensions: { ...current.dimensions, [key]: Math.max(1, value || 0) } }))
  }

  const setMirrorDimension = (key: 'width' | 'height', value: number) => {
    setMirrorForm((current) => ({ ...current, [key]: Math.max(100, Math.min(4000, value || 0)) }))
  }

  const toggleMirrorService = (serviceId: string) => {
    setMirrorForm((current) => current.options.some((item) => item.serviceId === serviceId)
      ? { ...current, options: current.options.filter((item) => item.serviceId !== serviceId) }
      : { ...current, options: [...current.options, { id: crypto.randomUUID(), serviceId, quantity: 1 }] })
  }

  const localCalculate = (): PublicResult => {
    const item = product === 'shower'
      ? calculateQuote(defaultCatalog, showerForm).total
      : calculateMirrorQuote(defaultMirrorCatalog, mirrorForm).total
    const amount = item + calculateQuoteDelivery(defaultCatalog, delivery)
    return {
      calculation_id: crypto.randomUUID().replaceAll('-', ''),
      amount,
      price_version: 'local',
      message: 'Это расчётная стоимость, максимально близкая к окончательной. Если параметры указаны верно, после проверки и замера сумма обычно меняется не более чем на ±10%.',
    }
  }

  const calculate = async () => {
    setBusy(true)
    setError('')
    const configuration = product === 'shower'
      ? {
          constructionId: showerForm.constructionId,
          dimensions: showerForm.dimensions,
          glassId: showerForm.glassId,
          hardwareId: showerForm.hardwareId,
          hardwareClassId: showerForm.hardwareClassId,
          installation: showerForm.installation,
        }
      : {
          width: mirrorForm.width,
          height: mirrorForm.height,
          materialId: mirrorForm.materialId,
          options: mirrorForm.options,
        }
    try {
      const data = await apiRequest<PublicResult>('calculate/', {
        method: 'POST',
        body: JSON.stringify({ product, configuration, delivery }),
      })
      setResult(data)
    } catch (requestError) {
      if (import.meta.env.DEV) setResult(localCalculate())
      else setError(requestError instanceof Error ? requestError.message : 'Не удалось рассчитать стоимость')
    } finally {
      setBusy(false)
    }
  }

  const next = () => {
    if (step < steps.length - 1) {
      setStep((current) => current + 1)
      return
    }
    void calculate()
  }

  const submitLead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!result) return
    setBusy(true)
    setError('')
    const params = new URLSearchParams(window.location.search)
    const utm = Object.fromEntries([...params.entries()].filter(([key]) => key.startsWith('utm_')))
    try {
      await apiRequest('lead/', {
        method: 'POST',
        body: JSON.stringify({
          calculation_id: result.calculation_id,
          ...contact,
          source: { url: window.location.href, referrer: document.referrer, utm },
        }),
      })
      setSent(true)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Не удалось отправить заявку')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <main className="public-loading"><LoaderCircle className="is-spinning" /><span>Загружаем калькулятор</span></main>
  }

  if (!config) {
    return <main className="public-loading"><strong>Калькулятор временно недоступен</strong><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Попробовать снова</button></main>
  }

  return (
    <div className={`public-shell${isEmbedded ? ' is-embedded' : ''}`}>
      <header className="public-header">
        <a className="public-brand" href="/" aria-label="Амальгама">
          <span aria-hidden="true">A</span>
          <strong>Амальгама<small>Зеркала · душевые · мебель</small></strong>
        </a>
        <a className="public-phone" href="tel:+79298191684">8 929 819-16-84</a>
      </header>

      <main className="public-main">
        <section className="public-workspace">
          <header className="public-intro">
            <div>
              <span>Онлайн-расчёт</span>
              <h1>Рассчитайте стоимость изделия</h1>
              <p>Ответьте на несколько вопросов. Точную стоимость менеджер подтвердит после замера.</p>
            </div>
          </header>

          {!started ? (
            <section className="public-start-card">
              <div className="public-progress-head">
                <div><span>Шаг 1 из 5</span><strong>Что рассчитываем?</strong></div>
                <span>20%</span>
              </div>
              <div className="public-progress"><i style={{ width: '20%' }} /></div>
              <div className="public-product-choice" role="group" aria-label="Тип изделия">
                <button className={selectedProduct === 'shower' ? 'is-active' : ''} type="button" onClick={() => changeProduct('shower')}>
                  <span><ShowerHead /></span>
                  <strong>Душевая</strong>
                  <small>Перегородки, двери и ограждения</small>
                  {selectedProduct === 'shower' ? <Check /> : null}
                </button>
                <button className={selectedProduct === 'mirror' ? 'is-active' : ''} type="button" onClick={() => changeProduct('mirror')}>
                  <span><ScanLine /></span>
                  <strong>Зеркало</strong>
                  <small>По размеру, с подсветкой и работами</small>
                  {selectedProduct === 'mirror' ? <Check /> : null}
                </button>
              </div>
              <footer className="public-step-actions public-start-actions">
                <button className="public-next" disabled={!selectedProduct} type="button" onClick={() => setStarted(true)}>Далее <ArrowRight /></button>
              </footer>
            </section>
          ) : !result ? (
            <div className="public-calculator-grid">
              <section className="public-config-card">
                <div className="public-progress-head">
                  <div><span>Шаг {step + 2} из {steps.length + 1}</span><strong>{steps[step]}</strong></div>
                  <span>{Math.round((step + 2) / (steps.length + 1) * 100)}%</span>
                </div>
                <div className="public-progress"><i style={{ width: `${(step + 2) / (steps.length + 1) * 100}%` }} /></div>

                {product === 'shower' && step === 0 ? (
                  <div className="public-type-grid">
                    {config.shower.constructions.map((item) => {
                      const thumbnailStyle = getConstructionThumbnailStyle(item.id)
                      return (
                        <button className={item.id === showerForm.constructionId ? 'is-active' : ''} key={item.id} type="button" onClick={() => selectConstruction(item.id)}>
                          {thumbnailStyle ? (
                            <span aria-hidden="true" className="public-construction-thumbnail" style={thumbnailStyle} />
                          ) : (
                            <img alt="" src={defaultCatalog.constructions.find((row) => row.id === item.id)?.imageUrl} />
                          )}
                          <span>{item.shortTitle}</span>
                          {item.id === showerForm.constructionId ? <Check /> : null}
                        </button>
                      )
                    })}
                  </div>
                ) : null}

                {product === 'shower' && step === 1 ? (
                  <div className="public-dimensions">
                    {publicConstruction?.fields.map((field) => (
                      <DimensionStepper
                        key={field.key}
                        label={field.label}
                        value={showerForm.dimensions[field.key] ?? field.defaultValue}
                        onChange={(value) => setDimension(field.key, value)}
                      />
                    ))}
                  </div>
                ) : null}

                {product === 'shower' && step === 2 ? (
                  <div className="public-option-stack">
                    <PublicSelect label="Стекло" value={showerForm.glassId} items={config.shower.glass} onChange={(glassId) => setShowerForm((current) => ({ ...current, glassId }))} />
                    <PublicSelect label="Цвет фурнитуры" value={showerForm.hardwareId} items={config.shower.hardware} onChange={(hardwareId) => setShowerForm((current) => ({ ...current, hardwareId }))} />
                    <PublicSelect label="Класс фурнитуры" value={showerForm.hardwareClassId} items={config.shower.hardwareClass} onChange={(hardwareClassId) => setShowerForm((current) => ({ ...current, hardwareClassId }))} />
                    <label className="public-check"><input type="checkbox" checked={showerForm.installation} onChange={(event) => setShowerForm((current) => ({ ...current, installation: event.target.checked }))} /><span><strong>Добавить монтаж</strong><small>Менеджер уточнит условия на объекте</small></span></label>
                  </div>
                ) : null}

                {product === 'mirror' && step === 0 ? (
                  <div className="public-dimensions">
                    <DimensionStepper label="Ширина" value={mirrorForm.width} onChange={(value) => setMirrorDimension('width', value)} />
                    <DimensionStepper label="Высота" value={mirrorForm.height} onChange={(value) => setMirrorDimension('height', value)} />
                  </div>
                ) : null}

                {product === 'mirror' && step === 1 ? (
                  <div className="public-choice-list">
                    {config.mirror.materials.map((item) => <button className={item.id === mirrorForm.materialId ? 'is-active' : ''} key={item.id} type="button" onClick={() => setMirrorForm((current) => ({ ...current, materialId: item.id }))}><span>{item.label}</span>{item.id === mirrorForm.materialId ? <Check /> : null}</button>)}
                  </div>
                ) : null}

                {product === 'mirror' && step === 2 ? (
                  <div className="public-choice-list public-service-list">
                    {config.mirror.services.map((item) => {
                      const checked = mirrorForm.options.some((row) => row.serviceId === item.id)
                      return <button className={checked ? 'is-active' : ''} key={item.id} type="button" onClick={() => toggleMirrorService(item.id)}><span>{item.label}</span><i>{checked ? <Check /> : null}</i></button>
                    })}
                  </div>
                ) : null}

                {step === 3 ? (
                  <div className="public-delivery">
                    <button className={!delivery.enabled ? 'is-active' : ''} type="button" onClick={() => setDelivery(normalizeQuoteDelivery({ enabled: false }))}><Truck /><span><strong>Без доставки</strong></span></button>
                    <button className={delivery.enabled && delivery.zone === 'inside' ? 'is-active' : ''} type="button" onClick={() => setDelivery(normalizeQuoteDelivery({ enabled: true, zone: 'inside' }))}><Truck /><span><strong>{config.delivery.insideLabel}</strong></span></button>
                    <button className={delivery.enabled && delivery.zone === 'outside' ? 'is-active' : ''} type="button" onClick={() => setDelivery(normalizeQuoteDelivery({ enabled: true, zone: 'outside', km: delivery.km }))}><Truck /><span><strong>{config.delivery.outsideLabel}</strong></span></button>
                    {delivery.enabled && delivery.zone === 'outside' ? <DimensionStepper label="Расстояние за городом, км" value={delivery.km} step={1} onChange={(km) => setDelivery(normalizeQuoteDelivery({ ...delivery, km }))} /> : null}
                  </div>
                ) : null}

                {error ? <p className="public-error" role="alert">{error}</p> : null}
                <footer className="public-step-actions">
                  <button className="public-back" type="button" onClick={() => step === 0 ? setStarted(false) : setStep((current) => current - 1)}><ArrowLeft /> Назад</button>
                  <button className="public-next" disabled={busy} type="button" onClick={next}>{busy ? <LoaderCircle className="is-spinning" /> : step === steps.length - 1 ? 'Рассчитать стоимость' : 'Далее'}{!busy ? <ArrowRight /> : null}</button>
                </footer>
              </section>
            </div>
          ) : (
            <section className="public-result-card">
              <div className="public-result-summary">
                <span>Расчётная стоимость</span>
                <strong>{money(result.amount)}</strong>
                <p>{result.message}</p>
                <button type="button" onClick={() => { setResult(null); setStep(0); setStarted(true); setSent(false) }}><ArrowLeft /> Изменить параметры</button>
              </div>
              {sent ? (
                <div className="public-success"><span><Check /></span><h2>Расчёт отправлен</h2><p>Менеджер свяжется с вами, уточнит детали и подготовит точное предложение.</p></div>
              ) : (
                <form className="public-lead-form" onSubmit={(event) => void submitLead(event)}>
                  <div><span>Получить точный расчёт</span><h2>Оставьте контакты</h2><p>Закрепим параметры и ответим по срокам изготовления.</p></div>
                  <label><span>Имя</span><input required minLength={2} autoComplete="name" value={contact.name} onChange={(event) => setContact((current) => ({ ...current, name: event.target.value }))} /></label>
                  <label><span>Телефон</span><input required type="tel" inputMode="tel" autoComplete="tel" pattern="\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}" placeholder="+7 (999) 000-00-00" value={contact.phone} onFocus={(event) => event.currentTarget.setSelectionRange(contact.phone.length, contact.phone.length)} onChange={(event) => setContact((current) => ({ ...current, phone: formatPublicPhone(event.target.value) }))} /></label>
                  <input className="public-honeypot" tabIndex={-1} autoComplete="off" aria-hidden="true" value={contact.company} onChange={(event) => setContact((current) => ({ ...current, company: event.target.value }))} />
                  {error ? <p className="public-error" role="alert">{error}</p> : null}
                  <button className="public-submit" disabled={busy} type="submit">{busy ? <LoaderCircle className="is-spinning" /> : <Send />} Отправить расчёт менеджеру</button>
                  <small>Нажимая кнопку, вы соглашаетесь на <a href={config.legal.consent_url}>обработку данных</a> и принимаете <a href={config.legal.privacy_url}>политику конфиденциальности</a>.</small>
                </form>
              )}
            </section>
          )}
        </section>
      </main>
    </div>
  )
}

type DimensionStepperProps = { label: string; value: number; step?: number; onChange: (value: number) => void }

function DimensionStepper({ label, value, step = 50, onChange }: DimensionStepperProps) {
  return (
    <label className="public-stepper">
      <span>{label}</span>
      <div>
        <button aria-label={`Уменьшить: ${label}`} type="button" onClick={() => onChange(value - step)}><Minus /></button>
        <input aria-label={label} inputMode="numeric" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
        <button aria-label={`Увеличить: ${label}`} type="button" onClick={() => onChange(value + step)}><Plus /></button>
      </div>
    </label>
  )
}

type PublicSelectProps = { label: string; value: string; items: Array<{ id: string; label: string }>; onChange: (value: string) => void }

function PublicSelect({ label, value, items, onChange }: PublicSelectProps) {
  return <label className="public-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{items.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
}
