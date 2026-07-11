import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Calculator,
  Check,
  ChevronRight,
  Copy,
  FileDown,
  RotateCcw,
  Save,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react'
import './App.css'
import {
  calculateQuote,
  createInitialForm,
  createQuote,
  getConstruction,
  getOption,
  money,
  resetDimensionsForConstruction,
  shortMoney,
  type CalculatorForm,
  type CalculationResult,
  type Quote,
} from './calculator'
import {
  createDefaultDimensions,
  defaultCatalog,
  type Construction,
  type PriceOption,
  type PricingCatalog,
} from './pricing'
import { loadCatalog, loadQuotes, resetCatalog, saveCatalog, saveQuotes } from './storage'
import { shareQuotePdf } from './quotePdf'

type TabId = 'calculator' | 'archive' | 'prices'

const tabs: Array<{ id: TabId; label: string; icon: typeof Calculator }> = [
  { id: 'calculator', label: 'Расчет', icon: Calculator },
  { id: 'archive', label: 'Архив', icon: Archive },
  { id: 'prices', label: 'Цены', icon: Settings2 },
]

const statuses: Record<Quote['status'], string> = {
  new: 'Новое',
  sent: 'Отправлено',
  accepted: 'Принято',
  archived: 'Архив',
}

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))

const cloneForm = (form: CalculatorForm): CalculatorForm => ({
  ...form,
  dimensions: { ...form.dimensions },
})

function App() {
  const [catalog, setCatalog] = useState<PricingCatalog>(() => loadCatalog())
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes())
  const [form, setForm] = useState<CalculatorForm>(() => createInitialForm(loadCatalog()))
  const [activeTab, setActiveTab] = useState<TabId>('calculator')
  const [notice, setNotice] = useState('')
  const [pdfQuoteId, setPdfQuoteId] = useState('')

  const result = useMemo(() => calculateQuote(catalog, form), [catalog, form])
  const construction = getConstruction(catalog, form.constructionId)

  useEffect(() => saveCatalog(catalog), [catalog])
  useEffect(() => saveQuotes(quotes), [quotes])

  const updateForm = (patch: Partial<CalculatorForm>) => {
    setForm((current) => ({ ...current, ...patch }))
  }

  const updateDimension = (key: string, value: number) => {
    setForm((current) => ({
      ...current,
      dimensions: { ...current.dimensions, [key]: value },
    }))
  }

  const selectConstruction = (id: string) => {
    const nextConstruction = getConstruction(catalog, id)
    setForm((current) => ({
      ...current,
      constructionId: id,
      dimensions: resetDimensionsForConstruction(nextConstruction),
    }))
  }

  const saveCurrentQuote = () => {
    if (Object.keys(result.errors).length > 0) {
      setNotice('Проверьте размеры')
      return
    }
    const quote = createQuote(catalog, cloneForm(form), result)
    setQuotes((current) => [quote, ...current])
    setNotice(`${quote.number} сохранено`)
    setActiveTab('archive')
  }

  const downloadQuotePdf = async (quote: Quote) => {
    setPdfQuoteId(quote.id)
    try {
      await shareQuotePdf(quote)
      setNotice(`${quote.number}: PDF готов`)
    } catch {
      setNotice('Не удалось сформировать PDF')
    } finally {
      setPdfQuoteId('')
    }
  }

  const downloadCurrentQuotePdf = () => {
    if (Object.keys(result.errors).length > 0) {
      setNotice('Проверьте размеры')
      return
    }
    const quote = createQuote(catalog, cloneForm(form), result)
    setQuotes((current) => [quote, ...current])
    void downloadQuotePdf(quote)
  }

  const loadQuoteToCalculator = (quote: Quote) => {
    setForm(cloneForm(quote.form))
    setActiveTab('calculator')
    setNotice(`${quote.number} открыт`)
  }

  const updateQuoteStatus = (id: string, status: Quote['status']) => {
    setQuotes((current) => current.map((quote) => (quote.id === id ? { ...quote, status } : quote)))
  }

  const deleteQuote = (id: string) => {
    setQuotes((current) => current.filter((quote) => quote.id !== id))
  }

  const resetPrices = () => {
    const nextCatalog = resetCatalog()
    setCatalog(nextCatalog)
    const nextConstruction = getConstruction(nextCatalog, form.constructionId)
    setForm((current) => ({
      ...current,
      dimensions: createDefaultDimensions(nextConstruction),
    }))
    setNotice('Цены сброшены')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Калькулятор душевых</h1>
          <p>{construction.shortTitle}</p>
        </div>
        <div className="header-total">
          <span>Итого</span>
          <strong>{shortMoney(result.total)} ₽</strong>
        </div>
      </header>

      <main className="app-main">
        {notice ? (
          <button className="notice" type="button" onClick={() => setNotice('')}>
            <Check size={16} />
            {notice}
          </button>
        ) : null}

        {activeTab === 'calculator' ? (
          <CalculatorScreen
            catalog={catalog}
            form={form}
            result={result}
            isPdfBusy={pdfQuoteId !== ''}
            onDimension={updateDimension}
            onForm={updateForm}
            onPdf={downloadCurrentQuotePdf}
            onSave={saveCurrentQuote}
            onSelectConstruction={selectConstruction}
          />
        ) : null}

        {activeTab === 'archive' ? (
          <ArchiveScreen
            quotes={quotes}
            pdfQuoteId={pdfQuoteId}
            onDelete={deleteQuote}
            onLoad={loadQuoteToCalculator}
            onPdf={(quote) => void downloadQuotePdf(quote)}
            onStatus={updateQuoteStatus}
          />
        ) : null}

        {activeTab === 'prices' ? (
          <PricesScreen catalog={catalog} onCatalog={setCatalog} onReset={resetPrices} />
        ) : null}
      </main>

      <nav className="bottom-tabs" aria-label="Главная навигация">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              className={activeTab === tab.id ? 'tab-button is-active' : 'tab-button'}
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}

type CalculatorScreenProps = {
  catalog: PricingCatalog
  form: CalculatorForm
  result: CalculationResult
  isPdfBusy: boolean
  onDimension: (key: string, value: number) => void
  onForm: (patch: Partial<CalculatorForm>) => void
  onPdf: () => void
  onSave: () => void
  onSelectConstruction: (id: string) => void
}

function CalculatorScreen({
  catalog,
  form,
  result,
  isPdfBusy,
  onDimension,
  onForm,
  onPdf,
  onSave,
  onSelectConstruction,
}: CalculatorScreenProps) {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const hasErrors = Object.keys(result.errors).length > 0

  return (
    <div className="screen-stack calculator-screen">
      <section className="section-block">
        <div className="section-title">
          <h2>Конструкция</h2>
          <span>{catalog.constructions.length} типов</span>
        </div>
        <div className="construction-strip" aria-label="Тип конструкции">
          {catalog.constructions.map((item) => (
            <button
              className={item.id === form.constructionId ? 'construction-card is-selected' : 'construction-card'}
              key={item.id}
              type="button"
              onClick={() => onSelectConstruction(item.id)}
            >
              <ConstructionPreview construction={item} />
              <span>{item.shortTitle}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Размеры</h2>
          {result.hasSurcharge ? <span className="warn">+30% высота</span> : <span>мм</span>}
        </div>
        <div className="dimension-list">
          {construction.fields.map((field) => (
            <label className="field-row" key={field.key}>
              <span>
                {field.label}
                <small>
                  {field.min}-{field.max}
                </small>
              </span>
              <input
                inputMode="numeric"
                min={field.min}
                max={field.max}
                type="number"
                value={form.dimensions[field.key] ?? ''}
                onChange={(event) => onDimension(field.key, Number(event.target.value))}
              />
              {result.errors[field.key] ? <em>{result.errors[field.key]}</em> : null}
            </label>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Внешний вид</h2>
          <span>{glass.label}</span>
        </div>
        <OptionGrid
          activeId={form.glassId}
          items={catalog.glass}
          priceSuffix="₽/м²"
          onSelect={(glassId) => onForm({ glassId })}
        />
        <div className="inline-selects">
          <OptionSelect
            label="Фурнитура"
            value={form.hardwareId}
            items={catalog.hardware}
            suffix="%"
            onChange={(hardwareId) => onForm({ hardwareId })}
          />
          <OptionSelect
            label="Класс"
            value={form.hardwareClassId}
            items={catalog.hardwareClass}
            suffix="₽"
            onChange={(hardwareClassId) => onForm({ hardwareClassId })}
          />
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Услуги</h2>
          <span>{hardware.label}, {hardwareClass.label}</span>
        </div>
        <div className="service-list">
          <ToggleRow
            checked={form.installation}
            label="Монтаж"
            value={money(catalog.services.installation)}
            onChange={(installation) => onForm({ installation })}
          />
          <ToggleRow
            checked={form.delivery}
            label="Доставка"
            value={money(catalog.services.deliveryBase)}
            onChange={(delivery) => onForm({ delivery })}
          />
          {form.delivery ? (
            <div className="delivery-box">
              <div className="segmented">
                <button
                  className={form.deliveryZone === 'inside' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onForm({ deliveryZone: 'inside', deliveryKm: 0 })}
                >
                  МКАД
                </button>
                <button
                  className={form.deliveryZone === 'outside' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onForm({ deliveryZone: 'outside' })}
                >
                  За МКАД
                </button>
              </div>
              {form.deliveryZone === 'outside' ? (
                <label className="km-field">
                  <span>Км от МКАД</span>
                  <input
                    inputMode="numeric"
                    min={0}
                    type="number"
                    value={form.deliveryKm}
                    onChange={(event) => onForm({ deliveryKm: Number(event.target.value) })}
                  />
                </label>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Клиент</h2>
          <span>КП</span>
        </div>
        <div className="client-grid">
          <label className="text-field">
            <span>Имя</span>
            <input value={form.clientName} onChange={(event) => onForm({ clientName: event.target.value })} />
          </label>
          <label className="text-field">
            <span>Телефон</span>
            <input value={form.clientPhone} onChange={(event) => onForm({ clientPhone: event.target.value })} />
          </label>
          <label className="text-field is-wide">
            <span>Комментарий</span>
            <input value={form.note} onChange={(event) => onForm({ note: event.target.value })} />
          </label>
        </div>
      </section>

      <SummaryDock result={result} hasErrors={hasErrors} isPdfBusy={isPdfBusy} onPdf={onPdf} onSave={onSave} />
    </div>
  )
}

type OptionGridProps = {
  activeId: string
  items: PriceOption[]
  priceSuffix: string
  onSelect: (id: string) => void
}

function OptionGrid({ activeId, items, priceSuffix, onSelect }: OptionGridProps) {
  return (
    <div className="option-grid">
      {items.map((item) => (
        <button
          className={item.id === activeId ? 'option-chip is-active' : 'option-chip'}
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
        >
          <i className={`glass-swatch swatch-${item.id}`} aria-hidden="true" />
          <span>{item.label}</span>
          <small>
            {shortMoney(item.price)} {priceSuffix}
          </small>
        </button>
      ))}
    </div>
  )
}

type OptionSelectProps = {
  label: string
  value: string
  items: PriceOption[]
  suffix: string
  onChange: (value: string) => void
}

function OptionSelect({ label, value, items, suffix, onChange }: OptionSelectProps) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.label} · {shortMoney(item.price)} {suffix}
          </option>
        ))}
      </select>
    </label>
  )
}

type ToggleRowProps = {
  checked: boolean
  label: string
  value: string
  onChange: (checked: boolean) => void
}

function ToggleRow({ checked, label, value, onChange }: ToggleRowProps) {
  return (
    <label className="toggle-row">
      <span>
        {label}
        <small>{value}</small>
      </span>
      <input checked={checked} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
    </label>
  )
}

type SummaryDockProps = {
  result: CalculationResult
  hasErrors: boolean
  isPdfBusy: boolean
  onPdf: () => void
  onSave: () => void
}

function SummaryDock({ result, hasErrors, isPdfBusy, onPdf, onSave }: SummaryDockProps) {
  return (
    <aside className="summary-dock">
      <div className="summary-lines">
        {result.lines.map((line) => (
          <div key={line.label}>
            <span>{line.label}</span>
            <strong>{money(line.value)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-total">
        <span>Итого</span>
        <strong>{money(result.total)}</strong>
      </div>
      <div className="summary-actions">
        <button className="pdf-action" disabled={hasErrors || isPdfBusy} type="button" onClick={onPdf}>
          <FileDown size={19} />
          {isPdfBusy ? 'Формируем...' : 'PDF клиенту'}
        </button>
        <button className="primary-action" disabled={hasErrors} type="button" onClick={onSave}>
          <Save size={19} />
          Сохранить КП
        </button>
      </div>
    </aside>
  )
}

type ArchiveScreenProps = {
  quotes: Quote[]
  pdfQuoteId: string
  onDelete: (id: string) => void
  onLoad: (quote: Quote) => void
  onPdf: (quote: Quote) => void
  onStatus: (id: string, status: Quote['status']) => void
}

function ArchiveScreen({ quotes, pdfQuoteId, onDelete, onLoad, onPdf, onStatus }: ArchiveScreenProps) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLowerCase()
  const filtered = quotes.filter((quote) => {
    const haystack = [
      quote.number,
      quote.constructionTitle,
      quote.form.clientName,
      quote.form.clientPhone,
      quote.glassLabel,
      statuses[quote.status],
      String(quote.result.total),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalized)
  })

  return (
    <div className="screen-stack archive-screen">
      <section className="section-block">
        <div className="search-field">
          <Search size={18} />
          <input
            placeholder="Поиск по КП, клиенту, телефону"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="archive-count">
          <span>{filtered.length} найдено</span>
          <strong>{quotes.length} всего</strong>
        </div>
      </section>

      <section className="quote-list">
        {filtered.map((quote) => (
          <article className="quote-card" key={quote.id}>
            <div className="quote-head">
              <div>
                <strong>{quote.number}</strong>
                <span>{formatDate(quote.createdAt)}</span>
              </div>
              <select value={quote.status} onChange={(event) => onStatus(quote.id, event.target.value as Quote['status'])}>
                {Object.entries(statuses).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button className="quote-main" type="button" onClick={() => onLoad(quote)}>
              <ConstructionPreview construction={getConstruction(defaultCatalog, quote.form.constructionId)} />
              <span>
                <b>{quote.constructionTitle}</b>
                <small>
                  {quote.form.clientName || 'Без имени'} · {money(quote.result.total)}
                </small>
              </span>
              <ChevronRight size={19} />
            </button>
            <div className="quote-meta">
              <span>{quote.glassLabel}</span>
              <span>{quote.hardwareLabel}</span>
              <span>{quote.hardwareClassLabel}</span>
            </div>
            <div className="quote-actions">
              <button type="button" onClick={() => onLoad(quote)}>
                <Copy size={16} />
                Повторить
              </button>
              <button disabled={pdfQuoteId === quote.id} type="button" onClick={() => onPdf(quote)}>
                <FileDown size={16} />
                {pdfQuoteId === quote.id ? 'Готовим...' : 'PDF'}
              </button>
              <button className="danger" type="button" onClick={() => onDelete(quote.id)}>
                <Trash2 size={16} />
                Удалить
              </button>
            </div>
          </article>
        ))}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Archive size={28} />
            <strong>КП не найдены</strong>
          </div>
        ) : null}
      </section>
    </div>
  )
}

type PricesScreenProps = {
  catalog: PricingCatalog
  onCatalog: (catalog: PricingCatalog) => void
  onReset: () => void
}

function PricesScreen({ catalog, onCatalog, onReset }: PricesScreenProps) {
  const updateOption = (group: 'glass' | 'hardware' | 'hardwareClass', id: string, price: number) => {
    onCatalog({
      ...catalog,
      [group]: catalog[group].map((item) => (item.id === id ? { ...item, price } : item)),
    })
  }

  const updateConstruction = (id: string, basePrice: number) => {
    onCatalog({
      ...catalog,
      constructions: catalog.constructions.map((item) => (item.id === id ? { ...item, basePrice } : item)),
    })
  }

  const updateService = (key: keyof PricingCatalog['services'], value: number) => {
    onCatalog({
      ...catalog,
      services: { ...catalog.services, [key]: value },
    })
  }

  return (
    <div className="screen-stack prices-screen">
      <section className="section-block admin-head">
        <div>
          <h2>Цены</h2>
          <span>Сохраняются на этом устройстве</span>
        </div>
        <button type="button" onClick={onReset}>
          <RotateCcw size={16} />
          Сбросить
        </button>
      </section>

      <PriceGroup
        items={catalog.glass}
        suffix="₽/м²"
        title="Стекло"
        onChange={(id, value) => updateOption('glass', id, value)}
      />
      <PriceGroup
        items={catalog.hardware}
        suffix="%"
        title="Цвет фурнитуры"
        onChange={(id, value) => updateOption('hardware', id, value)}
      />
      <PriceGroup
        items={catalog.hardwareClass}
        suffix="₽"
        title="Класс фурнитуры"
        onChange={(id, value) => updateOption('hardwareClass', id, value)}
      />

      <section className="section-block">
        <div className="section-title">
          <h2>Конструкции</h2>
          <span>База</span>
        </div>
        <div className="price-list">
          {catalog.constructions.map((item) => (
            <label className="price-row" key={item.id}>
              <span>{item.shortTitle}</span>
              <input
                inputMode="numeric"
                type="number"
                value={item.basePrice}
                onChange={(event) => updateConstruction(item.id, Number(event.target.value))}
              />
              <small>₽</small>
            </label>
          ))}
        </div>
      </section>

      <section className="section-block">
        <div className="section-title">
          <h2>Услуги</h2>
          <span>Руб.</span>
        </div>
        <div className="price-list">
          <ServiceRow label="Монтаж" value={catalog.services.installation} onChange={(value) => updateService('installation', value)} />
          <ServiceRow label="Доставка" value={catalog.services.deliveryBase} onChange={(value) => updateService('deliveryBase', value)} />
          <ServiceRow label="За МКАД, км" value={catalog.services.deliveryKmRate} onChange={(value) => updateService('deliveryKmRate', value)} />
          <ServiceRow label="Скидка, %" value={catalog.services.discountPercent} onChange={(value) => updateService('discountPercent', value)} />
          <ServiceRow
            label="Высота +%, после"
            value={catalog.services.heightSurchargeAfter}
            onChange={(value) => updateService('heightSurchargeAfter', value)}
          />
          <ServiceRow
            label="Надбавка за высоту, %"
            value={catalog.services.heightSurchargePercent}
            onChange={(value) => updateService('heightSurchargePercent', value)}
          />
        </div>
      </section>
    </div>
  )
}

type PriceGroupProps = {
  title: string
  suffix: string
  items: PriceOption[]
  onChange: (id: string, value: number) => void
}

function PriceGroup({ title, suffix, items, onChange }: PriceGroupProps) {
  return (
    <section className="section-block">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{suffix}</span>
      </div>
      <div className="price-list">
        {items.map((item) => (
          <label className="price-row" key={item.id}>
            <span>{item.label}</span>
            <input
              inputMode="numeric"
              type="number"
              value={item.price}
              onChange={(event) => onChange(item.id, Number(event.target.value))}
            />
            <small>{suffix}</small>
          </label>
        ))}
      </div>
    </section>
  )
}

type ServiceRowProps = {
  label: string
  value: number
  onChange: (value: number) => void
}

function ServiceRow({ label, value, onChange }: ServiceRowProps) {
  return (
    <label className="price-row">
      <span>{label}</span>
      <input inputMode="numeric" type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <small> </small>
    </label>
  )
}

type ShowerSketchProps = {
  sketch: Construction['sketch']
}

function ConstructionPreview({ construction }: { construction: Construction }) {
  return (
    <span className="construction-preview">
      <img alt="" src={construction.imageUrl} />
      <ShowerSketch sketch={construction.sketch} />
    </span>
  )
}

function ShowerSketch({ sketch }: ShowerSketchProps) {
  const panelCount: Record<Construction['sketch'], number> = {
    single: 1,
    'panel-door': 2,
    panel: 1,
    niche: 1,
    corner: 2,
    'corner-plus': 3,
    'double-corner': 4,
    slider: 2,
    'slider-corner': 3,
    'slider-double': 4,
    trapezoid: 3,
  }

  return (
    <svg className={`shower-sketch sketch-${sketch}`} viewBox="0 0 92 68" aria-hidden="true">
      <rect className="sketch-floor" x="14" y="56" width="64" height="6" rx="3" />
      {Array.from({ length: panelCount[sketch] }).map((_, index) => (
        <rect
          className="sketch-glass"
          height={42 - (sketch === 'trapezoid' && index !== 1 ? 8 : 0)}
          key={`${sketch}-${index}`}
          rx="3"
          width={16}
          x={18 + index * 14}
          y={12 + (sketch === 'trapezoid' && index !== 1 ? 8 : 0)}
        />
      ))}
      {sketch.includes('corner') || sketch === 'trapezoid' ? <path className="sketch-line" d="M56 15 74 54" /> : null}
      {sketch.includes('slider') ? <path className="sketch-line" d="M24 48 H67 M38 42 H78" /> : null}
      {sketch.includes('door') || sketch === 'niche' ? <path className="sketch-line" d="M48 19 68 36" /> : null}
    </svg>
  )
}

export default App
