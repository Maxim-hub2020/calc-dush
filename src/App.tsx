import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Box,
  Calculator,
  Check,
  ChevronRight,
  Copy,
  FileDown,
  Plus,
  Ruler,
  RotateCcw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'
import {
  calculateQuote,
  combineCalculationResults,
  createInitialForm,
  createQuote,
  getConstruction,
  getOption,
  getQuoteItems,
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
import { shareQuotePdf, type QuotePdfPreview } from './quotePdf'

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

type DraftPosition = {
  id: string
  form: CalculatorForm
}

type PositionSummary = {
  id: string
  index: number
  title: string
  total: number
  hasErrors: boolean
}

const customerFields: Array<keyof CalculatorForm> = ['clientName', 'clientPhone', 'note']

const createDraftPosition = (catalog: PricingCatalog, customer?: CalculatorForm): DraftPosition => {
  const form = createInitialForm(catalog)
  if (customer) {
    form.clientName = customer.clientName
    form.clientPhone = customer.clientPhone
    form.note = customer.note
  }
  return { id: crypto.randomUUID(), form }
}

function App() {
  const [catalog, setCatalog] = useState<PricingCatalog>(() => loadCatalog())
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes())
  const [positions, setPositions] = useState<DraftPosition[]>(() => [createDraftPosition(loadCatalog())])
  const [activePositionId, setActivePositionId] = useState(() => positions[0].id)
  const [activeTab, setActiveTab] = useState<TabId>('calculator')
  const [notice, setNotice] = useState('')
  const [pdfQuoteId, setPdfQuoteId] = useState('')
  const [pdfPreview, setPdfPreview] = useState<QuotePdfPreview | null>(null)

  const activePosition = positions.find((position) => position.id === activePositionId) ?? positions[0]
  const form = activePosition.form
  const positionResults = useMemo(
    () => positions.map((position) => ({ ...position, result: calculateQuote(catalog, position.form) })),
    [catalog, positions],
  )
  const result = positionResults.find((position) => position.id === activePosition.id)?.result
    ?? calculateQuote(catalog, form)
  const orderResult = useMemo(
    () => combineCalculationResults(positionResults.map((position) => position.result)),
    [positionResults],
  )
  const positionSummaries = useMemo<PositionSummary[]>(
    () => positionResults.map((position, index) => ({
      id: position.id,
      index,
      title: getConstruction(catalog, position.form.constructionId).shortTitle,
      total: position.result.total,
      hasErrors: Object.keys(position.result.errors).length > 0,
    })),
    [catalog, positionResults],
  )
  useEffect(() => saveCatalog(catalog), [catalog])
  useEffect(() => saveQuotes(quotes), [quotes])
  useEffect(() => {
    setPositions((current) => {
      let changed = false
      const next = current.map((position) => {
        const form = position.form
        const constructionExists = catalog.constructions.some((item) => item.id === form.constructionId)
        const glassExists = catalog.glass.some((item) => item.id === form.glassId)
        const hardwareExists = catalog.hardware.some((item) => item.id === form.hardwareId)
        const hardwareClassExists = catalog.hardwareClass.some((item) => item.id === form.hardwareClassId)

        if (constructionExists && glassExists && hardwareExists && hardwareClassExists) return position

        const construction = constructionExists
          ? getConstruction(catalog, form.constructionId)
          : catalog.constructions[0]
        changed = true

        return {
          ...position,
          form: {
            ...form,
            constructionId: construction.id,
            dimensions: constructionExists ? form.dimensions : createDefaultDimensions(construction),
            glassId: glassExists ? form.glassId : catalog.glass[0].id,
            hardwareId: hardwareExists ? form.hardwareId : catalog.hardware[0].id,
            hardwareClassId: hardwareClassExists ? form.hardwareClassId : catalog.hardwareClass[0].id,
          },
        }
      })

      return changed ? next : current
    })
  }, [catalog])
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [activeTab])
  useEffect(() => {
    if (!pdfPreview) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
      URL.revokeObjectURL(pdfPreview.url)
    }
  }, [pdfPreview])

  const updateForm = (patch: Partial<CalculatorForm>) => {
    const sharedPatch = customerFields.reduce<Partial<CalculatorForm>>((next, key) => {
      if (key in patch) Object.assign(next, { [key]: patch[key] })
      return next
    }, {})
    setPositions((current) => current.map((position) => {
      if (position.id === activePositionId) {
        return { ...position, form: { ...position.form, ...patch } }
      }
      if (Object.keys(sharedPatch).length > 0) {
        return { ...position, form: { ...position.form, ...sharedPatch } }
      }
      return position
    }))
  }

  const updateDimension = (key: string, value: number) => {
    setPositions((current) => current.map((position) => position.id === activePositionId
      ? { ...position, form: { ...position.form, dimensions: { ...position.form.dimensions, [key]: value } } }
      : position))
  }

  const selectConstruction = (id: string) => {
    const nextConstruction = getConstruction(catalog, id)
    setPositions((current) => current.map((position) => position.id === activePositionId
      ? {
          ...position,
          form: {
            ...position.form,
            constructionId: id,
            dimensions: resetDimensionsForConstruction(nextConstruction),
          },
        }
      : position))
  }

  const createQuoteFromPositions = () => createQuote(
    catalog,
    positionResults.map((position) => ({ form: cloneForm(position.form), result: position.result })),
  )

  const focusFirstInvalidPosition = () => {
    const invalid = positionResults.find((position) => Object.keys(position.result.errors).length > 0)
    if (!invalid) return false
    setActivePositionId(invalid.id)
    setNotice(`Проверьте размеры позиции ${positionResults.indexOf(invalid) + 1}`)
    return true
  }

  const saveCurrentQuote = () => {
    if (focusFirstInvalidPosition()) return
    const quote = createQuoteFromPositions()
    setQuotes((current) => [quote, ...current])
    setNotice(`${quote.number} сохранено`)
    setActiveTab('archive')
  }

  const downloadQuotePdf = async (quote: Quote) => {
    setPdfQuoteId(quote.id)
    try {
      const preview = await shareQuotePdf(quote)
      if (preview) setPdfPreview(preview)
      setNotice(`${quote.number}: PDF готов`)
    } catch {
      setNotice('Не удалось сформировать PDF')
    } finally {
      setPdfQuoteId('')
    }
  }

  const downloadCurrentQuotePdf = () => {
    if (focusFirstInvalidPosition()) return
    const quote = createQuoteFromPositions()
    setQuotes((current) => [quote, ...current])
    void downloadQuotePdf(quote)
  }

  const addPosition = () => {
    const next = createDraftPosition(catalog, form)
    setPositions((current) => [...current, next])
    setActivePositionId(next.id)
    setNotice(`Позиция ${positions.length + 1} добавлена`)
  }

  const duplicatePosition = () => {
    const next = { id: crypto.randomUUID(), form: cloneForm(form) }
    const activeIndex = positions.findIndex((position) => position.id === activePositionId)
    setPositions((current) => [
      ...current.slice(0, activeIndex + 1),
      next,
      ...current.slice(activeIndex + 1),
    ])
    setActivePositionId(next.id)
    setNotice('Позиция продублирована')
  }

  const deletePosition = (positionId: string) => {
    if (positions.length === 1) return
    const deletedIndex = positions.findIndex((position) => position.id === positionId)
    if (deletedIndex === -1) return
    const nextPositions = positions.filter((position) => position.id !== positionId)
    setPositions(nextPositions)
    if (positionId === activePositionId) {
      setActivePositionId(nextPositions[Math.min(deletedIndex, nextPositions.length - 1)].id)
    }
    setNotice(`Позиция ${deletedIndex + 1} удалена`)
  }

  const loadQuoteToCalculator = (quote: Quote) => {
    const nextPositions = getQuoteItems(quote).map((item) => ({ id: crypto.randomUUID(), form: cloneForm(item.form) }))
    setPositions(nextPositions)
    setActivePositionId(nextPositions[0].id)
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
    setPositions((current) => current.map((position) => {
      const nextConstruction = getConstruction(nextCatalog, position.form.constructionId)
      return {
        ...position,
        form: { ...position.form, dimensions: createDefaultDimensions(nextConstruction) },
      }
    }))
    setNotice('Цены сброшены')
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">A</span>
          <div>
            <h1>Амальгама</h1>
            <p>Калькулятор изделий на заказ</p>
          </div>
        </div>
        <nav className="app-tabs" aria-label="Главная навигация">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                className={activeTab === tab.id ? 'tab-button is-active' : 'tab-button'}
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
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
            orderResult={orderResult}
            positionSummaries={positionSummaries}
            activePositionId={activePositionId}
            isPdfBusy={pdfQuoteId !== ''}
            onAddPosition={addPosition}
            onDeletePosition={deletePosition}
            onDimension={updateDimension}
            onDuplicatePosition={duplicatePosition}
            onForm={updateForm}
            onPdf={downloadCurrentQuotePdf}
            onSave={saveCurrentQuote}
            onSelectPosition={setActivePositionId}
            onSelectConstruction={selectConstruction}
            onOpenArchive={() => setActiveTab('archive')}
            onOpenQuote={loadQuoteToCalculator}
            recentQuotes={quotes.slice(0, 3)}
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

      {pdfPreview ? (
        <PdfPreviewDialog preview={pdfPreview} onClose={() => setPdfPreview(null)} />
      ) : null}

    </div>
  )
}

type PdfPreviewDialogProps = {
  preview: QuotePdfPreview
  onClose: () => void
}

function PdfPreviewDialog({ preview, onClose }: PdfPreviewDialogProps) {
  return (
    <div className="pdf-preview-backdrop">
      <section aria-labelledby="pdf-preview-title" aria-modal="true" className="pdf-preview-dialog" role="dialog">
        <header>
          <div>
            <span>Коммерческое предложение</span>
            <h2 id="pdf-preview-title">{preview.title}</h2>
          </div>
          <button aria-label="Закрыть просмотр PDF" title="Закрыть" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="pdf-preview-ready">
          <FileDown size={52} aria-hidden="true" />
          <h3>PDF сформирован</h3>
          <p>Документ готов к просмотру и сохранению.</p>
          <strong>{preview.fileName}</strong>
        </div>
        <footer>
          <a href={preview.url} rel="noopener" target="_blank">
            <FileDown size={18} />
            Открыть отдельно
          </a>
          <a download={preview.fileName} href={preview.url}>
            <Save size={18} />
            Скачать PDF
          </a>
          <button type="button" onClick={onClose}>Закрыть</button>
        </footer>
      </section>
    </div>
  )
}

type CalculatorScreenProps = {
  catalog: PricingCatalog
  form: CalculatorForm
  result: CalculationResult
  orderResult: CalculationResult
  positionSummaries: PositionSummary[]
  recentQuotes: Quote[]
  activePositionId: string
  isPdfBusy: boolean
  onAddPosition: () => void
  onDeletePosition: (id: string) => void
  onDimension: (key: string, value: number) => void
  onDuplicatePosition: () => void
  onForm: (patch: Partial<CalculatorForm>) => void
  onPdf: () => void
  onSave: () => void
  onOpenArchive: () => void
  onOpenQuote: (quote: Quote) => void
  onSelectConstruction: (id: string) => void
  onSelectPosition: (id: string) => void
}

type ConfigSectionId = 'construction' | 'dimensions' | 'appearance' | 'services' | 'client'

const configSections: Array<{ id: ConfigSectionId; label: string }> = [
  { id: 'construction', label: 'Тип' },
  { id: 'dimensions', label: 'Размеры' },
  { id: 'appearance', label: 'Вид' },
  { id: 'services', label: 'Услуги' },
  { id: 'client', label: 'Клиент' },
]

function CalculatorScreen({
  catalog,
  form,
  result,
  orderResult,
  positionSummaries,
  recentQuotes,
  activePositionId,
  isPdfBusy,
  onAddPosition,
  onDeletePosition,
  onDimension,
  onDuplicatePosition,
  onForm,
  onPdf,
  onSave,
  onOpenArchive,
  onOpenQuote,
  onSelectConstruction,
  onSelectPosition,
}: CalculatorScreenProps) {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const [activeSection, setActiveSection] = useState<ConfigSectionId>('construction')

  return (
    <div className="screen-stack calculator-screen">
      <PositionSwitcher
        activeId={activePositionId}
        positions={positionSummaries}
        onAdd={onAddPosition}
        onDelete={onDeletePosition}
        onDuplicate={onDuplicatePosition}
        onSelect={onSelectPosition}
      />

      <section className="parameter-panel workspace-panel">
        <div className="panel-heading">
          <div>
            <span>Позиция {positionSummaries.findIndex((position) => position.id === activePositionId) + 1}</span>
            <h2>Параметры изделия</h2>
          </div>
          <Box size={20} aria-hidden="true" />
        </div>

        <nav className="config-tabs" aria-label="Настройки позиции">
          {configSections.map((section) => (
            <button
              aria-pressed={activeSection === section.id}
              className={activeSection === section.id ? 'is-active' : ''}
              key={section.id}
              type="button"
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          ))}
        </nav>

        <div className="config-panel">
      {activeSection === 'construction' ? (
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
      ) : null}

      {activeSection === 'dimensions' ? (
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
      ) : null}

      {activeSection === 'appearance' ? (
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
      ) : null}

      {activeSection === 'services' ? (
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
      ) : null}

      {activeSection === 'client' ? (
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
      ) : null}
        </div>
      </section>

      <ProductVisualization
        construction={construction}
        form={form}
        glass={glass}
        hardware={hardware}
      />

      <div className="summary-column">
        <SummaryDock
          result={result}
          orderResult={orderResult}
          positionCount={positionSummaries.length}
          positionIndex={positionSummaries.findIndex((position) => position.id === activePositionId)}
          hasErrors={positionSummaries.some((position) => position.hasErrors)}
          isPdfBusy={isPdfBusy}
          onPdf={onPdf}
          onSave={onSave}
        />
        <RecentCalculations
          catalog={catalog}
          quotes={recentQuotes}
          onOpenArchive={onOpenArchive}
          onOpenQuote={onOpenQuote}
        />
      </div>
    </div>
  )
}

type ProductVisualizationProps = {
  construction: Construction
  form: CalculatorForm
  glass: PriceOption
  hardware: PriceOption
}

function ProductVisualization({ construction, form, glass, hardware }: ProductVisualizationProps) {
  return (
    <section className="visualization-panel workspace-panel">
      <div className="panel-heading">
        <div>
          <span>Предпросмотр</span>
          <h2>Визуализация</h2>
        </div>
        <Ruler size={20} aria-hidden="true" />
      </div>
      <figure className="visualization-figure">
        <img src={construction.imageUrl} alt={`Душевая: ${construction.title}`} />
        <figcaption>
          <strong>{construction.title}</strong>
          <span>{glass.label} · {hardware.label}</span>
        </figcaption>
      </figure>
      <div className="visualization-specs" aria-label="Размеры выбранной конструкции">
        {construction.fields.map((field) => (
          <div key={field.key}>
            <span>{field.label}</span>
            <strong>{form.dimensions[field.key] ?? 0} мм</strong>
          </div>
        ))}
      </div>
      <div className="visualization-guarantee">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Точные размеры уточняются после замера</span>
      </div>
    </section>
  )
}

type RecentCalculationsProps = {
  catalog: PricingCatalog
  quotes: Quote[]
  onOpenArchive: () => void
  onOpenQuote: (quote: Quote) => void
}

function RecentCalculations({ catalog, quotes, onOpenArchive, onOpenQuote }: RecentCalculationsProps) {
  return (
    <section className="recent-panel workspace-panel">
      <div className="panel-heading compact-heading">
        <div>
          <span>Архив КП</span>
          <h2>Последние расчеты</h2>
        </div>
      </div>
      <div className="recent-list">
        {quotes.length > 0 ? quotes.map((quote) => {
          const items = getQuoteItems(quote)
          const firstItem = items[0]
          const quoteConstruction = getConstruction(catalog, firstItem.form.constructionId)
          const title = items.length > 1 ? `${items.length} позиции` : firstItem.constructionTitle

          return (
            <button className="recent-quote" key={quote.id} type="button" onClick={() => onOpenQuote(quote)}>
              <ConstructionPreview construction={quoteConstruction} />
              <span>
                <strong>{title}</strong>
                <small>{formatDate(quote.createdAt)}</small>
              </span>
              <b>{shortMoney(quote.result.total)} ₽</b>
            </button>
          )
        }) : (
          <p className="recent-empty">Сохраненные КП появятся здесь</p>
        )}
      </div>
      <button className="recent-open" type="button" onClick={onOpenArchive}>
        Открыть архив
        <ChevronRight size={17} />
      </button>
    </section>
  )
}

type PositionSwitcherProps = {
  activeId: string
  positions: PositionSummary[]
  onAdd: () => void
  onDelete: (id: string) => void
  onDuplicate: () => void
  onSelect: (id: string) => void
}

function PositionSwitcher({ activeId, positions, onAdd, onDelete, onDuplicate, onSelect }: PositionSwitcherProps) {
  return (
    <section className="section-block position-section">
      <div className="section-title position-title">
        <h2>Позиции</h2>
        <div className="position-tools">
          <button title="Дублировать позицию" type="button" onClick={onDuplicate}>
            <Copy size={17} />
            <span className="sr-only">Дублировать позицию</span>
          </button>
          <button className="add-position" type="button" onClick={onAdd}>
            <Plus size={17} />
            Добавить
          </button>
        </div>
      </div>
      <div className="position-strip" aria-label="Позиции коммерческого предложения">
        {positions.map((position) => {
          const canDelete = positions.length > 1
          const className = [
            'position-tab',
            position.id === activeId ? 'is-active' : '',
            position.hasErrors ? 'has-error' : '',
            canDelete ? 'can-delete' : '',
          ].filter(Boolean).join(' ')

          return (
            <div className={className} key={position.id}>
              <button className="position-tab-select" type="button" onClick={() => onSelect(position.id)}>
                <span>Позиция {position.index + 1}</span>
                <strong>{position.title}</strong>
                <small>{shortMoney(position.total)} ₽</small>
              </button>
              {canDelete ? (
                <button
                  aria-label={`Удалить позицию ${position.index + 1}`}
                  className="position-tab-delete"
                  title={`Удалить позицию ${position.index + 1}`}
                  type="button"
                  onClick={() => onDelete(position.id)}
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
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
  orderResult: CalculationResult
  positionCount: number
  positionIndex: number
  hasErrors: boolean
  isPdfBusy: boolean
  onPdf: () => void
  onSave: () => void
}

function SummaryDock({ result, orderResult, positionCount, positionIndex, hasErrors, isPdfBusy, onPdf, onSave }: SummaryDockProps) {
  return (
    <aside className="summary-dock">
      <div className="summary-headline">
        <span>Предварительная стоимость</span>
        <strong>{money(orderResult.total)}</strong>
        <small>
          Позиция {positionIndex + 1}: {money(result.total)}
          {positionCount > 1 ? ` · Всего ${positionCount}` : ''}
        </small>
      </div>
      <div className="summary-lines">
        {orderResult.lines.map((line) => (
          <div key={line.label}>
            <span>{line.label}</span>
            <strong>{money(line.value)}</strong>
          </div>
        ))}
      </div>
      <div className="summary-term">
        <span>Срок изготовления</span>
        <strong>7-10 рабочих дней</strong>
      </div>
      <div className="summary-guarantee">
        <ShieldCheck size={18} aria-hidden="true" />
        <span>Гарантия на изделие 24 месяца</span>
      </div>
      <div className="summary-actions">
        <button className="primary-action" disabled={hasErrors} type="button" onClick={onSave}>
          <Save size={19} />
          Сохранить КП
        </button>
        <button className="pdf-action" disabled={hasErrors || isPdfBusy} type="button" onClick={onPdf}>
          <FileDown size={19} />
          {isPdfBusy ? 'Формируем...' : 'Создать PDF'}
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
    const items = getQuoteItems(quote)
    const haystack = [
      quote.number,
      quote.form.clientName,
      quote.form.clientPhone,
      statuses[quote.status],
      String(quote.result.total),
      ...items.flatMap((item) => [
        item.constructionTitle,
        item.glassLabel,
        item.hardwareLabel,
        item.hardwareClassLabel,
      ]),
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
        {filtered.map((quote) => {
          const items = getQuoteItems(quote)
          const firstItem = items[0]
          return (
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
              <ConstructionPreview construction={getConstruction(defaultCatalog, firstItem.form.constructionId)} />
              <span>
                <b>{items.length > 1 ? `${items.length} позиции` : firstItem.constructionTitle}</b>
                <small>
                  {quote.form.clientName || 'Без имени'} · {money(quote.result.total)}
                </small>
              </span>
              <ChevronRight size={19} />
            </button>
            <div className="quote-meta">
              {items.length > 1
                ? items.map((item, index) => <span key={item.id}>{index + 1}. {item.constructionTitle}</span>)
                : (
                    <>
                      <span>{firstItem.glassLabel}</span>
                      <span>{firstItem.hardwareLabel}</span>
                      <span>{firstItem.hardwareClassLabel}</span>
                    </>
                  )}
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
          )
        })}
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
  const updateOption = (
    group: 'glass' | 'hardware' | 'hardwareClass',
    id: string,
    patch: Partial<Pick<PriceOption, 'label' | 'price'>>,
  ) => {
    onCatalog({
      ...catalog,
      [group]: catalog[group].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addOption = (group: 'glass' | 'hardware' | 'hardwareClass') => {
    onCatalog({
      ...catalog,
      [group]: [
        ...catalog[group],
        { id: `custom-${crypto.randomUUID()}`, label: 'Новая позиция', price: 0 },
      ],
    })
  }

  const deleteOption = (group: 'glass' | 'hardware' | 'hardwareClass', id: string) => {
    if (catalog[group].length <= 1) return
    onCatalog({ ...catalog, [group]: catalog[group].filter((item) => item.id !== id) })
  }

  const updateConstruction = (
    id: string,
    patch: Partial<Pick<Construction, 'basePrice' | 'shortTitle' | 'title'>>,
  ) => {
    onCatalog({
      ...catalog,
      constructions: catalog.constructions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addConstruction = () => {
    const template = catalog.constructions[0]
    const label = 'Новая конструкция'
    onCatalog({
      ...catalog,
      constructions: [
        ...catalog.constructions,
        {
          ...template,
          id: `custom-${crypto.randomUUID()}`,
          title: label,
          shortTitle: label,
          basePrice: 0,
          fields: template.fields.map((field) => ({ ...field })),
        },
      ],
    })
  }

  const deleteConstruction = (id: string) => {
    if (catalog.constructions.length <= 1) return
    onCatalog({
      ...catalog,
      constructions: catalog.constructions.filter((item) => item.id !== id),
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
        onAdd={() => addOption('glass')}
        onChange={(id, value) => updateOption('glass', id, { price: value })}
        onDelete={(id) => deleteOption('glass', id)}
        onNameChange={(id, value) => updateOption('glass', id, { label: value })}
      />
      <PriceGroup
        items={catalog.hardware}
        suffix="%"
        title="Цвет фурнитуры"
        onAdd={() => addOption('hardware')}
        onChange={(id, value) => updateOption('hardware', id, { price: value })}
        onDelete={(id) => deleteOption('hardware', id)}
        onNameChange={(id, value) => updateOption('hardware', id, { label: value })}
      />
      <PriceGroup
        items={catalog.hardwareClass}
        suffix="₽"
        title="Класс фурнитуры"
        onAdd={() => addOption('hardwareClass')}
        onChange={(id, value) => updateOption('hardwareClass', id, { price: value })}
        onDelete={(id) => deleteOption('hardwareClass', id)}
        onNameChange={(id, value) => updateOption('hardwareClass', id, { label: value })}
      />

      <section className="section-block">
        <div className="section-title price-section-title">
          <div className="price-section-heading">
            <h2>Конструкции</h2>
            <span>Базовая цена</span>
          </div>
          <button type="button" onClick={addConstruction}>
            <Plus size={16} />
            Добавить
          </button>
        </div>
        <div className="price-list">
          {catalog.constructions.map((item) => (
            <EditablePriceRow
              canDelete={catalog.constructions.length > 1}
              key={item.id}
              label={item.shortTitle}
              price={item.basePrice}
              suffix="₽"
              onDelete={() => deleteConstruction(item.id)}
              onLabelChange={(value) => updateConstruction(item.id, { shortTitle: value, title: value })}
              onPriceChange={(value) => updateConstruction(item.id, { basePrice: value })}
            />
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
  onNameChange: (id: string, value: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
}

function PriceGroup({ title, suffix, items, onChange, onNameChange, onAdd, onDelete }: PriceGroupProps) {
  return (
    <section className="section-block">
      <div className="section-title price-section-title">
        <div className="price-section-heading">
          <h2>{title}</h2>
          <span>{suffix}</span>
        </div>
        <button type="button" onClick={onAdd}>
          <Plus size={16} />
          Добавить
        </button>
      </div>
      <div className="price-list">
        {items.map((item) => (
          <EditablePriceRow
            canDelete={items.length > 1}
            key={item.id}
            label={item.label}
            price={item.price}
            suffix={suffix}
            onDelete={() => onDelete(item.id)}
            onLabelChange={(value) => onNameChange(item.id, value)}
            onPriceChange={(value) => onChange(item.id, value)}
          />
        ))}
      </div>
    </section>
  )
}

type EditablePriceRowProps = {
  label: string
  price: number
  suffix: string
  canDelete: boolean
  onLabelChange: (value: string) => void
  onPriceChange: (value: number) => void
  onDelete: () => void
}

function EditablePriceRow({
  label,
  price,
  suffix,
  canDelete,
  onLabelChange,
  onPriceChange,
  onDelete,
}: EditablePriceRowProps) {
  return (
    <div className="price-edit-row">
      <label className="price-name-field">
        <span className="sr-only">Название позиции</span>
        <input
          aria-label={`Название: ${label || 'позиция'}`}
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </label>
      <label className="price-value-field">
        <span className="sr-only">Цена позиции {label}</span>
        <input
          aria-label={`Цена: ${label || 'позиция'}`}
          inputMode="numeric"
          type="number"
          value={price}
          onChange={(event) => onPriceChange(Number(event.target.value))}
        />
        <small>{suffix}</small>
      </label>
      <button
        aria-label={`Удалить позицию ${label || 'без названия'}`}
        className="price-delete"
        disabled={!canDelete}
        title={canDelete ? 'Удалить позицию' : 'В категории должна остаться хотя бы одна позиция'}
        type="button"
        onClick={onDelete}
      >
        <Trash2 size={17} />
      </button>
    </div>
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
