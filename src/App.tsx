import { useEffect, useMemo, useState } from 'react'
import {
  Archive,
  Box,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  FileDown,
  Image,
  Layers3,
  ListPlus,
  Pencil,
  Plus,
  Ruler,
  RotateCcw,
  Save,
  Search,
  ScanLine,
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
  getPublicProductPrice,
  getQuoteItemTitle,
  getQuoteItems,
  isMirrorQuoteItem,
  money,
  resetDimensionsForConstruction,
  shortMoney,
  updateQuoteManually,
  type CalculatorForm,
  type CalculationResult,
  type ManualQuotePatch,
  type Quote,
  type QuoteDraftItem,
} from './calculator'
import {
  calculateMirrorQuote,
  cloneMirrorForm,
  createInitialMirrorForm,
  getMirrorCalculatedOptions,
  getMirrorMaterial,
  getMirrorService,
  getMirrorTitle,
  type MirrorForm,
} from './mirrorCalculator'
import {
  mirrorUnitLabels,
  type MirrorMaterial,
  type MirrorPricingCatalog,
  type MirrorService,
} from './mirrorPricing'
import {
  createDefaultDimensions,
  defaultCatalog,
  type Construction,
  type PriceOption,
  type PricingCatalog,
} from './pricing'
import {
  loadCatalog,
  loadMirrorCatalog,
  loadQuotes,
  resetCatalog,
  resetMirrorCatalog,
  saveCatalog,
  saveMirrorCatalog,
  saveQuotes,
} from './storage'
import { shareQuotePdf, type QuotePdfPreview } from './quotePdf'
import mirrorVisualization from './assets/mirror-visualization.png'

type ProductKind = 'shower' | 'mirror'
type TabId = 'showers' | 'mirrors' | 'archive' | 'prices'

const tabs: Array<{ id: TabId; label: string; icon: typeof Calculator }> = [
  { id: 'showers', label: 'Душевые', icon: Calculator },
  { id: 'mirrors', label: 'Зеркала', icon: ScanLine },
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

type ShowerDraftPosition = {
  id: string
  kind: 'shower'
  form: CalculatorForm
}

type MirrorDraftPosition = {
  id: string
  kind: 'mirror'
  form: MirrorForm
}

type DraftPosition = ShowerDraftPosition | MirrorDraftPosition

type PositionSummary = {
  id: string
  index: number
  kind: ProductKind
  title: string
  total: number
  hasErrors: boolean
}

type SharedFormPatch = Pick<CalculatorForm, 'clientName' | 'clientPhone' | 'note' | 'discountEnabled' | 'discountPercent' | 'designerEnabled'>

const sharedFormFields: Array<keyof SharedFormPatch> = [
  'clientName',
  'clientPhone',
  'note',
  'discountEnabled',
  'discountPercent',
  'designerEnabled',
]

const createDraftPosition = (catalog: PricingCatalog, customer?: Partial<SharedFormPatch>): ShowerDraftPosition => {
  const form = createInitialForm(catalog)
  if (customer) {
    form.clientName = customer.clientName ?? form.clientName
    form.clientPhone = customer.clientPhone ?? form.clientPhone
    form.note = customer.note ?? form.note
    form.discountEnabled = customer.discountEnabled ?? form.discountEnabled
    form.discountPercent = customer.discountPercent ?? form.discountPercent
    form.designerEnabled = customer.designerEnabled ?? form.designerEnabled
  }
  return { id: crypto.randomUUID(), kind: 'shower', form }
}

const createMirrorDraftPosition = (
  catalog: MirrorPricingCatalog,
  customer?: Partial<SharedFormPatch>,
): MirrorDraftPosition => ({
  id: crypto.randomUUID(),
  kind: 'mirror',
  form: createInitialMirrorForm(catalog, customer),
})

function App() {
  const [catalog, setCatalog] = useState<PricingCatalog>(() => loadCatalog())
  const [mirrorCatalog, setMirrorCatalog] = useState<MirrorPricingCatalog>(() => loadMirrorCatalog())
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes())
  const [positions, setPositions] = useState<DraftPosition[]>(() => [createDraftPosition(loadCatalog())])
  const [activePositionId, setActivePositionId] = useState(() => positions[0].id)
  const [activeTab, setActiveTab] = useState<TabId>('showers')
  const [notice, setNotice] = useState('')
  const [editingQuoteId, setEditingQuoteId] = useState('')
  const [pdfQuoteId, setPdfQuoteId] = useState('')
  const [pdfPreview, setPdfPreview] = useState<QuotePdfPreview | null>(null)

  const activePosition = positions.find((position) => position.id === activePositionId) ?? positions[0]
  const positionResults = useMemo(
    () => positions.map((position) => position.kind === 'mirror'
      ? { ...position, result: calculateMirrorQuote(mirrorCatalog, position.form) }
      : { ...position, result: calculateQuote(catalog, position.form) }),
    [catalog, mirrorCatalog, positions],
  )
  const activeResult = positionResults.find((position) => position.id === activePosition.id)?.result
    ?? (activePosition.kind === 'mirror'
      ? calculateMirrorQuote(mirrorCatalog, activePosition.form)
      : calculateQuote(catalog, activePosition.form))
  const orderResult = useMemo(
    () => combineCalculationResults(positionResults.map((position) => position.result)),
    [positionResults],
  )
  const positionSummaries = useMemo<PositionSummary[]>(
    () => positionResults.map((position, index) => ({
      id: position.id,
      index,
      kind: position.kind,
      title: position.kind === 'mirror'
        ? getMirrorTitle(position.form)
        : getConstruction(catalog, position.form.constructionId).shortTitle,
      total: position.result.total,
      hasErrors: Object.keys(position.result.errors).length > 0,
    })),
    [catalog, positionResults],
  )
  useEffect(() => saveCatalog(catalog), [catalog])
  useEffect(() => saveMirrorCatalog(mirrorCatalog), [mirrorCatalog])
  useEffect(() => saveQuotes(quotes), [quotes])
  useEffect(() => {
    setPositions((current) => {
      let changed = false
      const next = current.map((position) => {
        if (position.kind === 'mirror') return position
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
    setPositions((current) => {
      let changed = false
      const next = current.map((position) => {
        if (position.kind === 'shower') return position
        const materialExists = mirrorCatalog.materials.some((item) => item.id === position.form.materialId)
        const validOptions = position.form.options.filter((option) => (
          mirrorCatalog.services.some((service) => service.id === option.serviceId)
        ))
        if (materialExists && validOptions.length === position.form.options.length) return position
        changed = true
        return {
          ...position,
          form: {
            ...position.form,
            materialId: materialExists ? position.form.materialId : mirrorCatalog.materials[0].id,
            options: validOptions,
          },
        }
      })
      return changed ? next : current
    })
  }, [mirrorCatalog])
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

  const pickSharedPatch = (patch: Partial<SharedFormPatch>) => sharedFormFields.reduce<Partial<SharedFormPatch>>((next, key) => {
      if (patch[key] !== undefined) Object.assign(next, { [key]: patch[key] })
      return next
    }, {})

  const mergeSharedPatch = (position: DraftPosition, patch: Partial<SharedFormPatch>): DraftPosition => (
    position.kind === 'mirror'
      ? { ...position, form: { ...position.form, ...patch } }
      : { ...position, form: { ...position.form, ...patch } }
  )

  const updateForm = (patch: Partial<CalculatorForm>) => {
    const sharedPatch = pickSharedPatch(patch)
    setPositions((current) => current.map((position) => {
      if (position.id === activePositionId && position.kind === 'shower') {
        return { ...position, form: { ...position.form, ...patch } }
      }
      if (Object.keys(sharedPatch).length > 0) {
        return mergeSharedPatch(position, sharedPatch)
      }
      return position
    }))
  }

  const updateMirrorForm = (patch: Partial<MirrorForm>) => {
    const sharedPatch = pickSharedPatch(patch)
    setPositions((current) => current.map((position) => {
      if (position.id === activePositionId && position.kind === 'mirror') {
        return { ...position, form: { ...position.form, ...patch } }
      }
      if (Object.keys(sharedPatch).length > 0) {
        return mergeSharedPatch(position, sharedPatch)
      }
      return position
    }))
  }

  const updateDimension = (key: string, value: number) => {
    setPositions((current) => current.map((position) => position.id === activePositionId && position.kind === 'shower'
      ? { ...position, form: { ...position.form, dimensions: { ...position.form.dimensions, [key]: value } } }
      : position))
  }

  const selectConstruction = (id: string) => {
    const nextConstruction = getConstruction(catalog, id)
    setPositions((current) => current.map((position) => position.id === activePositionId && position.kind === 'shower'
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

  const createQuoteFromPositions = () => {
    const drafts: QuoteDraftItem[] = positionResults.map((position) => position.kind === 'mirror'
      ? { kind: 'mirror', form: cloneMirrorForm(position.form), result: position.result }
      : { kind: 'shower', form: cloneForm(position.form), result: position.result })
    const quote = createQuote(catalog, mirrorCatalog, drafts)
    const editingQuote = quotes.find((item) => item.id === editingQuoteId)
    if (!editingQuote) return quote
    return {
      ...quote,
      id: editingQuote.id,
      number: editingQuote.number,
      createdAt: editingQuote.createdAt,
      status: editingQuote.status,
    }
  }

  const focusFirstInvalidPosition = () => {
    const invalid = positionResults.find((position) => Object.keys(position.result.errors).length > 0)
    if (!invalid) return false
    setActivePositionId(invalid.id)
    setActiveTab(invalid.kind === 'mirror' ? 'mirrors' : 'showers')
    setNotice(`Проверьте размеры позиции ${positionResults.indexOf(invalid) + 1}`)
    return true
  }

  const saveCurrentQuote = () => {
    if (focusFirstInvalidPosition()) return
    const quote = createQuoteFromPositions()
    setQuotes((current) => editingQuoteId
      ? current.map((item) => item.id === editingQuoteId ? quote : item)
      : [quote, ...current])
    setNotice(`${quote.number} ${editingQuoteId ? 'обновлено' : 'сохранено'}`)
    setEditingQuoteId('')
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
    setQuotes((current) => editingQuoteId
      ? current.map((item) => item.id === editingQuoteId ? quote : item)
      : [quote, ...current])
    setEditingQuoteId('')
    void downloadQuotePdf(quote)
  }

  const addPosition = (kind: ProductKind) => {
    const customer = activePosition.form
    const next = kind === 'mirror'
      ? createMirrorDraftPosition(mirrorCatalog, customer)
      : createDraftPosition(catalog, customer)
    setPositions((current) => [...current, next])
    setActivePositionId(next.id)
    setActiveTab(kind === 'mirror' ? 'mirrors' : 'showers')
    setNotice(`Позиция ${positions.length + 1} добавлена`)
  }

  const duplicatePosition = () => {
    const next: DraftPosition = activePosition.kind === 'mirror'
      ? { id: crypto.randomUUID(), kind: 'mirror', form: cloneMirrorForm(activePosition.form) }
      : { id: crypto.randomUUID(), kind: 'shower', form: cloneForm(activePosition.form) }
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
      const nextActive = nextPositions[Math.min(deletedIndex, nextPositions.length - 1)]
      setActivePositionId(nextActive.id)
      setActiveTab(nextActive.kind === 'mirror' ? 'mirrors' : 'showers')
    }
    setNotice(`Позиция ${deletedIndex + 1} удалена`)
  }

  const loadQuoteToCalculator = (quote: Quote, itemId?: string) => {
    const items = getQuoteItems(quote)
    const nextPositions: DraftPosition[] = items.map((item) => isMirrorQuoteItem(item)
      ? { id: crypto.randomUUID(), kind: 'mirror', form: cloneMirrorForm(item.form) }
      : { id: crypto.randomUUID(), kind: 'shower', form: cloneForm(item.form) })
    const selectedIndex = itemId ? Math.max(0, items.findIndex((item) => item.id === itemId)) : 0
    const selected = nextPositions[selectedIndex]
    setPositions(nextPositions)
    setEditingQuoteId(quote.id)
    setActivePositionId(selected.id)
    setActiveTab(selected.kind === 'mirror' ? 'mirrors' : 'showers')
    setNotice(`${quote.number} открыт`)
  }

  const selectPosition = (positionId: string) => {
    const position = positions.find((item) => item.id === positionId)
    if (!position) return
    setActivePositionId(positionId)
    setActiveTab(position.kind === 'mirror' ? 'mirrors' : 'showers')
  }

  const openProductTab = (kind: ProductKind) => {
    const existing = positions.find((position) => position.kind === kind)
    if (existing) {
      setActivePositionId(existing.id)
      setActiveTab(kind === 'mirror' ? 'mirrors' : 'showers')
      return
    }
    addPosition(kind)
  }

  const updateQuoteStatus = (id: string, status: Quote['status']) => {
    setQuotes((current) => current.map((quote) => (quote.id === id ? { ...quote, status } : quote)))
  }

  const deleteQuote = (id: string) => {
    setQuotes((current) => current.filter((quote) => quote.id !== id))
  }

  const saveManualQuote = (id: string, patch: ManualQuotePatch) => {
    setQuotes((current) => current.map((quote) => quote.id === id ? updateQuoteManually(quote, patch) : quote))
    const quote = quotes.find((item) => item.id === id)
    setNotice(`${quote?.number ?? 'КП'} обновлено вручную`)
  }

  const resetPrices = () => {
    const nextCatalog = resetCatalog()
    const nextMirrorCatalog = resetMirrorCatalog()
    setCatalog(nextCatalog)
    setMirrorCatalog(nextMirrorCatalog)
    setPositions((current) => current.map((position) => {
      if (position.kind === 'mirror') {
        return {
          ...position,
          form: {
            ...position.form,
            materialId: nextMirrorCatalog.materials[0].id,
            options: [],
          },
        }
      }
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
            const openTab = () => {
              if (tab.id === 'showers') openProductTab('shower')
              else if (tab.id === 'mirrors') openProductTab('mirror')
              else setActiveTab(tab.id)
            }
            return (
              <button
                className={activeTab === tab.id ? 'tab-button is-active' : 'tab-button'}
                key={tab.id}
                type="button"
                onClick={openTab}
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

        {activeTab === 'showers' && activePosition.kind === 'shower' ? (
          <CalculatorScreen
            catalog={catalog}
            form={activePosition.form}
            result={activeResult}
            orderResult={orderResult}
            positionSummaries={positionSummaries}
            activePositionId={activePositionId}
            isPdfBusy={pdfQuoteId !== ''}
            onAddPosition={() => addPosition('shower')}
            onDeletePosition={deletePosition}
            onDimension={updateDimension}
            onDuplicatePosition={duplicatePosition}
            onForm={updateForm}
            onPdf={downloadCurrentQuotePdf}
            onSave={saveCurrentQuote}
            onSelectPosition={selectPosition}
            onSelectConstruction={selectConstruction}
            onOpenArchive={() => setActiveTab('archive')}
            onOpenQuote={loadQuoteToCalculator}
            recentQuotes={quotes.slice(0, 3)}
          />
        ) : null}

        {activeTab === 'mirrors' && activePosition.kind === 'mirror' ? (
          <MirrorCalculatorScreen
            activePositionId={activePositionId}
            catalog={mirrorCatalog}
            form={activePosition.form}
            isPdfBusy={pdfQuoteId !== ''}
            orderResult={orderResult}
            positionSummaries={positionSummaries}
            result={activeResult}
            onAddPosition={() => addPosition('mirror')}
            onDeletePosition={deletePosition}
            onDuplicatePosition={duplicatePosition}
            onForm={updateMirrorForm}
            onPdf={downloadCurrentQuotePdf}
            onSave={saveCurrentQuote}
            onSelectPosition={selectPosition}
          />
        ) : null}

        {activeTab === 'archive' ? (
          <ArchiveScreen
            quotes={quotes}
            pdfQuoteId={pdfQuoteId}
            onDelete={deleteQuote}
            onLoad={loadQuoteToCalculator}
            onManualSave={saveManualQuote}
            onPdf={(quote) => void downloadQuotePdf(quote)}
            onStatus={updateQuoteStatus}
          />
        ) : null}

        {activeTab === 'prices' ? (
          <PricesScreen
            catalog={catalog}
            mirrorCatalog={mirrorCatalog}
            onCatalog={setCatalog}
            onMirrorCatalog={setMirrorCatalog}
            onReset={resetPrices}
          />
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
            value={money(construction.installationPrice)}
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
                  По городу
                </button>
                <button
                  className={form.deliveryZone === 'outside' ? 'is-active' : ''}
                  type="button"
                  onClick={() => onForm({ deliveryZone: 'outside' })}
                >
                  За городом
                </button>
              </div>
              {form.deliveryZone === 'outside' ? (
                <label className="km-field">
                  <span>Км за городом</span>
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
          <ToggleRow
            checked={form.designerEnabled}
            label="Дизайнер"
            value={form.designerEnabled ? `Надбавка +${catalog.services.designerPercent}%` : 'Без надбавки'}
            onChange={(designerEnabled) => onForm({ designerEnabled })}
          />
          <ToggleRow
            checked={form.discountEnabled}
            label="Скидка"
            value={form.discountEnabled ? `${form.discountPercent}%` : 'Без скидки'}
            onChange={(discountEnabled) => onForm({ discountEnabled })}
          />
          {form.discountEnabled ? (
            <div className="delivery-box service-number-box">
              <label className="km-field">
                <span>Размер скидки, %</span>
                <input
                  inputMode="decimal"
                  max={100}
                  min={0}
                  type="number"
                  value={form.discountPercent}
                  onChange={(event) => onForm({ discountPercent: Number(event.target.value) })}
                />
              </label>
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

type MirrorCalculatorScreenProps = {
  catalog: MirrorPricingCatalog
  form: MirrorForm
  result: CalculationResult
  orderResult: CalculationResult
  positionSummaries: PositionSummary[]
  activePositionId: string
  isPdfBusy: boolean
  onAddPosition: () => void
  onDeletePosition: (id: string) => void
  onDuplicatePosition: () => void
  onForm: (patch: Partial<MirrorForm>) => void
  onPdf: () => void
  onSave: () => void
  onSelectPosition: (id: string) => void
}

type MirrorSectionId = 'dimensions' | 'material' | 'options' | 'pricing' | 'client'

const mirrorSections: Array<{ id: MirrorSectionId; label: string }> = [
  { id: 'dimensions', label: 'Размеры' },
  { id: 'material', label: 'Материал' },
  { id: 'options', label: 'Работы' },
  { id: 'pricing', label: 'Цена' },
  { id: 'client', label: 'Клиент' },
]

function MirrorCalculatorScreen({
  catalog,
  form,
  result,
  orderResult,
  positionSummaries,
  activePositionId,
  isPdfBusy,
  onAddPosition,
  onDeletePosition,
  onDuplicatePosition,
  onForm,
  onPdf,
  onSave,
  onSelectPosition,
}: MirrorCalculatorScreenProps) {
  const [activeSection, setActiveSection] = useState<MirrorSectionId>('dimensions')
  const material = getMirrorMaterial(catalog, form.materialId)
  const calculatedOptions = getMirrorCalculatedOptions(catalog, form)
  const selectedServices = new Set(form.options.map((option) => option.serviceId))

  const addOption = () => {
    const service = catalog.services.find((item) => !selectedServices.has(item.id)) ?? catalog.services[0]
    onForm({
      options: [...form.options, { id: crypto.randomUUID(), serviceId: service.id, quantity: 1 }],
    })
  }

  const updateOption = (id: string, patch: Partial<MirrorForm['options'][number]>) => {
    onForm({ options: form.options.map((option) => option.id === id ? { ...option, ...patch } : option) })
  }

  const deleteOption = (id: string) => {
    onForm({ options: form.options.filter((option) => option.id !== id) })
  }

  return (
    <div className="screen-stack calculator-screen mirror-calculator-screen">
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
            <span>Зеркало {positionSummaries.findIndex((position) => position.id === activePositionId) + 1}</span>
            <h2>Параметры зеркала</h2>
          </div>
          <ScanLine size={20} aria-hidden="true" />
        </div>

        <nav className="config-tabs" aria-label="Настройки зеркала">
          {mirrorSections.map((section) => (
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
          {activeSection === 'dimensions' ? (
            <section className="section-block">
              <div className="section-title">
                <h2>Размер зеркала</h2>
                <span>мм</span>
              </div>
              <div className="dimension-list mirror-dimensions">
                <label className="field-row">
                  <span>Ширина<small>100-4000 мм</small></span>
                  <input
                    inputMode="numeric"
                    min={100}
                    max={4000}
                    type="number"
                    value={form.width}
                    onChange={(event) => onForm({ width: Number(event.target.value) })}
                  />
                  {result.errors.width ? <em>{result.errors.width}</em> : null}
                </label>
                <label className="field-row">
                  <span>Высота<small>100-4000 мм</small></span>
                  <input
                    inputMode="numeric"
                    min={100}
                    max={4000}
                    type="number"
                    value={form.height}
                    onChange={(event) => onForm({ height: Number(event.target.value) })}
                  />
                  {result.errors.height ? <em>{result.errors.height}</em> : null}
                </label>
              </div>
            </section>
          ) : null}

          {activeSection === 'material' ? (
            <section className="section-block">
              <div className="section-title">
                <h2>Материал</h2>
                <span>{money(material.price)}/м²</span>
              </div>
              <OptionGrid
                activeId={form.materialId}
                items={catalog.materials}
                priceSuffix="₽/м²"
                onSelect={(materialId) => onForm({ materialId })}
              />
            </section>
          ) : null}

          {activeSection === 'options' ? (
            <section className="section-block mirror-options-section">
              <div className="section-title">
                <h2>Работы и услуги</h2>
                <button className="section-add-button" type="button" onClick={addOption}>
                  <ListPlus size={17} />
                  Добавить
                </button>
              </div>
              <div className="mirror-option-list">
                {form.options.map((option, index) => {
                  const service = getMirrorService(catalog, option.serviceId)
                  const calculated = calculatedOptions[index]
                  return (
                    <div className="mirror-option-row" key={option.id}>
                      <label>
                        <span className="sr-only">Работа или услуга</span>
                        <select
                          value={option.serviceId}
                          onChange={(event) => updateOption(option.id, { serviceId: event.target.value, quantity: 1 })}
                        >
                          {catalog.services.map((item) => (
                            <option key={item.id} value={item.id}>{item.label}</option>
                          ))}
                        </select>
                      </label>
                      {service.unit === 'piece' ? (
                        <label className="mirror-option-quantity">
                          <span>Кол-во</span>
                          <input
                            inputMode="decimal"
                            min={0}
                            step="1"
                            type="number"
                            value={option.quantity}
                            onChange={(event) => updateOption(option.id, { quantity: Number(event.target.value) })}
                          />
                        </label>
                      ) : (
                        <span className="mirror-option-auto">
                          {calculated.quantity.toFixed(2)} {calculated.unitLabel}
                        </span>
                      )}
                      <strong>{money(calculated.total)}</strong>
                      <button aria-label={`Удалить ${service.label}`} type="button" onClick={() => deleteOption(option.id)}>
                        <Trash2 size={17} />
                      </button>
                    </div>
                  )
                })}
                {form.options.length === 0 ? (
                  <button className="mirror-options-empty" type="button" onClick={addOption}>
                    <ListPlus size={22} />
                    <span>Добавить работу, монтаж или доставку</span>
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'pricing' ? (
            <section className="section-block">
              <div className="section-title">
                <h2>Условия расчёта</h2>
                <span>{money(result.total)}</span>
              </div>
              <div className="service-list">
                <ToggleRow
                  checked={form.managerEnabled}
                  label="Менеджер"
                  value={`+${catalog.settings.managerPercent}%`}
                  onChange={(managerEnabled) => onForm({ managerEnabled })}
                />
                <ToggleRow
                  checked={form.designerEnabled}
                  label="Дизайнер"
                  value={`+${catalog.settings.designerPercent}%`}
                  onChange={(designerEnabled) => onForm({ designerEnabled })}
                />
                <ToggleRow
                  checked={form.discountEnabled}
                  label="Скидка"
                  value={`${form.discountPercent}%`}
                  onChange={(discountEnabled) => onForm({ discountEnabled })}
                />
                {form.discountEnabled ? (
                  <label className="delivery-distance">
                    <span>Размер скидки</span>
                    <input
                      inputMode="decimal"
                      min={0}
                      max={100}
                      type="number"
                      value={form.discountPercent}
                      onChange={(event) => onForm({ discountPercent: Number(event.target.value) })}
                    />
                    <small>%</small>
                  </label>
                ) : null}
              </div>
            </section>
          ) : null}

          {activeSection === 'client' ? (
            <section className="section-block">
              <div className="section-title"><h2>Клиент</h2><span>КП</span></div>
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

      <section className="visualization-panel workspace-panel mirror-visualization-panel">
        <div className="panel-heading">
          <div><span>Предпросмотр</span><h2>Визуализация зеркала</h2></div>
          <Image size={20} aria-hidden="true" />
        </div>
        <figure className="visualization-figure">
          <img src={mirrorVisualization} alt="Прямоугольное зеркало в светлом интерьере ванной" />
          <figcaption>
            <strong>{getMirrorTitle(form)}</strong>
            <span>{material.label}</span>
          </figcaption>
        </figure>
        <div className="visualization-guarantee">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>Размеры и особенности монтажа уточняются после замера</span>
        </div>
      </section>

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
          const title = items.length > 1 ? `${items.length} позиции` : getQuoteItemTitle(firstItem)

          return (
            <button className="recent-quote" key={quote.id} type="button" onClick={() => onOpenQuote(quote)}>
              {isMirrorQuoteItem(firstItem)
                ? <MirrorPreviewIcon />
                : <ConstructionPreview construction={getConstruction(catalog, firstItem.form.constructionId)} />}
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
                <span>{position.kind === 'mirror' ? 'Зеркало' : 'Душевая'} · {position.index + 1}</span>
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
        {orderResult.discount > 0 ? <del>{money(orderResult.subtotal)}</del> : null}
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
  onLoad: (quote: Quote, itemId?: string) => void
  onManualSave: (id: string, patch: ManualQuotePatch) => void
  onPdf: (quote: Quote) => void
  onStatus: (id: string, status: Quote['status']) => void
}

function ArchiveScreen({ quotes, pdfQuoteId, onDelete, onLoad, onManualSave, onPdf, onStatus }: ArchiveScreenProps) {
  const [query, setQuery] = useState('')
  const [manualQuote, setManualQuote] = useState<Quote | null>(null)
  const normalized = query.trim().toLowerCase()
  const filtered = quotes.filter((quote) => {
    const items = getQuoteItems(quote)
    const haystack = [
      quote.number,
      quote.form.clientName,
      quote.form.clientPhone,
      statuses[quote.status],
      String(quote.result.total),
      ...items.flatMap((item) => isMirrorQuoteItem(item)
        ? [item.mirrorTitle, item.materialLabel, ...item.serviceLines.map((line) => line.label)]
        : [item.constructionTitle, item.glassLabel, item.hardwareLabel, item.hardwareClassLabel]),
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
              {isMirrorQuoteItem(firstItem)
                ? <MirrorPreviewIcon />
                : <ConstructionPreview construction={getConstruction(defaultCatalog, firstItem.form.constructionId)} />}
              <span>
                <b>{items.length > 1 ? `${items.length} позиции` : getQuoteItemTitle(firstItem)}</b>
                <small>
                  {quote.form.clientName || 'Без имени'} · {money(quote.result.total)}
                </small>
              </span>
              <ChevronRight size={19} />
            </button>
            <div className="quote-item-list">
              {items.map((item, index) => (
                <button key={item.id} type="button" onClick={() => onLoad(quote, item.id)}>
                  <span className="quote-item-icon">
                    {isMirrorQuoteItem(item) ? <ScanLine size={18} /> : <Layers3 size={18} />}
                  </span>
                  <span>
                    <strong>{index + 1}. {getQuoteItemTitle(item)}</strong>
                    <small>{isMirrorQuoteItem(item) ? item.materialLabel : item.glassLabel}</small>
                  </span>
                  <Pencil size={16} />
                </button>
              ))}
            </div>
            <div className="quote-actions">
              <button type="button" onClick={() => onLoad(quote)}>
                <Pencil size={16} />
                Калькулятор
              </button>
              <button type="button" onClick={() => setManualQuote(quote)}>
                <Settings2 size={16} />
                Изменить КП
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
      {manualQuote ? (
        <QuoteEditorDialog
          quote={manualQuote}
          onClose={() => setManualQuote(null)}
          onSave={(patch) => {
            onManualSave(manualQuote.id, patch)
            setManualQuote(null)
          }}
        />
      ) : null}
    </div>
  )
}

type QuoteEditorDialogProps = {
  quote: Quote
  onClose: () => void
  onSave: (patch: ManualQuotePatch) => void
}

function QuoteEditorDialog({ quote, onClose, onSave }: QuoteEditorDialogProps) {
  const [draft, setDraft] = useState<ManualQuotePatch>(() => ({
    clientName: quote.form.clientName,
    clientPhone: quote.form.clientPhone,
    note: quote.form.note,
    discountEnabled: quote.form.discountEnabled,
    discountPercent: quote.form.discountPercent,
    items: getQuoteItems(quote).map((item) => ({
      id: item.id,
      title: getQuoteItemTitle(item),
      product: getPublicProductPrice(item.result),
      delivery: item.result.delivery,
    })),
  }))

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [])

  const updateItem = (id: string, patch: Partial<ManualQuotePatch['items'][number]>) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === id ? { ...item, ...patch } : item),
    }))
  }

  const subtotal = draft.items.reduce((sum, item) => (
    sum + Math.max(0, Number(item.product) || 0) + Math.max(0, Number(item.delivery) || 0)
  ), 0)
  const discountPercent = Math.min(100, Math.max(0, Number(draft.discountPercent) || 0))
  const total = draft.discountEnabled
    ? draft.items.reduce((sum, item) => {
        const itemSubtotal = Math.max(0, Number(item.product) || 0) + Math.max(0, Number(item.delivery) || 0)
        return sum + Math.round(itemSubtotal * (1 - discountPercent / 100) / 10) * 10
      }, 0)
    : subtotal
  const hasDiscount = total < subtotal

  return (
    <div className="quote-editor-backdrop">
      <section aria-labelledby="quote-editor-title" aria-modal="true" className="quote-editor-dialog" role="dialog">
        <header>
          <div>
            <span>{quote.number}</span>
            <h2 id="quote-editor-title">Редактирование КП</h2>
          </div>
          <button aria-label="Закрыть редактор КП" title="Закрыть" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>

        <div className="quote-editor-body">
          <section className="quote-editor-section">
            <div className="quote-editor-section-title">
              <h3>Клиент</h3>
              <span>Данные в PDF</span>
            </div>
            <div className="client-grid">
              <label className="text-field">
                <span>Имя</span>
                <input
                  value={draft.clientName}
                  onChange={(event) => setDraft((current) => ({ ...current, clientName: event.target.value }))}
                />
              </label>
              <label className="text-field">
                <span>Телефон</span>
                <input
                  value={draft.clientPhone}
                  onChange={(event) => setDraft((current) => ({ ...current, clientPhone: event.target.value }))}
                />
              </label>
              <label className="text-field is-wide">
                <span>Комментарий</span>
                <input
                  value={draft.note}
                  onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="quote-editor-section">
            <div className="quote-editor-section-title">
              <h3>Позиции</h3>
              <span>{draft.items.length}</span>
            </div>
            <div className="manual-quote-items">
              {draft.items.map((item, index) => (
                <div className="manual-quote-item" key={item.id}>
                  <span className="manual-quote-index">{index + 1}</span>
                  <label className="text-field manual-quote-title">
                    <span>Наименование</span>
                    <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} />
                  </label>
                  <label className="manual-money-field">
                    <span>Стоимость изделия</span>
                    <span className="manual-money-input">
                      <input
                        inputMode="numeric"
                        min={0}
                        type="number"
                        value={item.product}
                        onChange={(event) => updateItem(item.id, { product: Number(event.target.value) })}
                      />
                      <small>₽</small>
                    </span>
                  </label>
                  <label className="manual-money-field">
                    <span>Доставка</span>
                    <span className="manual-money-input">
                      <input
                        inputMode="numeric"
                        min={0}
                        type="number"
                        value={item.delivery}
                        onChange={(event) => updateItem(item.id, { delivery: Number(event.target.value) })}
                      />
                      <small>₽</small>
                    </span>
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="quote-editor-section quote-editor-discount">
            <ToggleRow
              checked={draft.discountEnabled}
              label="Скидка"
              value={draft.discountEnabled ? `${discountPercent}%` : 'Не применяется'}
              onChange={(discountEnabled) => setDraft((current) => ({ ...current, discountEnabled }))}
            />
            {draft.discountEnabled ? (
              <label className="manual-money-field discount-field">
                <span>Размер скидки</span>
                <span className="manual-money-input">
                  <input
                    inputMode="decimal"
                    min={0}
                    max={100}
                    type="number"
                    value={draft.discountPercent}
                    onChange={(event) => setDraft((current) => ({ ...current, discountPercent: Number(event.target.value) }))}
                  />
                  <small>%</small>
                </span>
              </label>
            ) : null}
            <div className={hasDiscount ? 'manual-total has-discount' : 'manual-total'}>
              <span>Итого</span>
              <div>
                {hasDiscount ? <del>{money(subtotal)}</del> : null}
                <strong>{money(total)}</strong>
              </div>
            </div>
          </section>
        </div>

        <footer>
          <button type="button" onClick={onClose}>Отмена</button>
          <button className="primary-action" type="button" onClick={() => onSave(draft)}>
            <Save size={18} />
            Сохранить изменения
          </button>
        </footer>
      </section>
    </div>
  )
}

type PricesScreenProps = {
  catalog: PricingCatalog
  mirrorCatalog: MirrorPricingCatalog
  onCatalog: (catalog: PricingCatalog) => void
  onMirrorCatalog: (catalog: MirrorPricingCatalog) => void
  onReset: () => void
}

type PriceSectionId =
  | 'glass'
  | 'hardware'
  | 'hardwareClass'
  | 'constructions'
  | 'services'
  | 'mirrorMaterials'
  | 'mirrorServices'
  | 'mirrorSettings'

function PricesScreen({ catalog, mirrorCatalog, onCatalog, onMirrorCatalog, onReset }: PricesScreenProps) {
  const [openSection, setOpenSection] = useState<PriceSectionId | null>(null)
  const toggleSection = (section: PriceSectionId) => {
    setOpenSection((current) => (current === section ? null : section))
  }

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
    patch: Partial<Pick<Construction, 'basePrice' | 'installationPrice' | 'shortTitle' | 'title'>>,
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
          installationPrice: 0,
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

  const updateMirrorMaterial = (id: string, patch: Partial<Pick<MirrorMaterial, 'label' | 'price'>>) => {
    onMirrorCatalog({
      ...mirrorCatalog,
      materials: mirrorCatalog.materials.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  const addMirrorMaterial = () => {
    onMirrorCatalog({
      ...mirrorCatalog,
      materials: [
        ...mirrorCatalog.materials,
        { id: `custom-${crypto.randomUUID()}`, label: 'Новый материал', price: 0 },
      ],
    })
  }

  const deleteMirrorMaterial = (id: string) => {
    if (mirrorCatalog.materials.length <= 1) return
    onMirrorCatalog({
      ...mirrorCatalog,
      materials: mirrorCatalog.materials.filter((item) => item.id !== id),
    })
  }

  const updateMirrorService = (id: string, patch: Partial<MirrorService>) => {
    onMirrorCatalog({
      ...mirrorCatalog,
      services: mirrorCatalog.services.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  const addMirrorService = () => {
    onMirrorCatalog({
      ...mirrorCatalog,
      services: [
        ...mirrorCatalog.services,
        {
          id: `custom-${crypto.randomUUID()}`,
          label: 'Новая работа',
          price: 0,
          unit: 'piece',
          category: 'work',
          visibleInQuote: true,
        },
      ],
    })
  }

  const deleteMirrorService = (id: string) => {
    if (mirrorCatalog.services.length <= 1) return
    onMirrorCatalog({
      ...mirrorCatalog,
      services: mirrorCatalog.services.filter((item) => item.id !== id),
    })
  }

  const updateMirrorSetting = (key: keyof MirrorPricingCatalog['settings'], value: number) => {
    onMirrorCatalog({
      ...mirrorCatalog,
      settings: { ...mirrorCatalog.settings, [key]: value },
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
        controlsId="price-glass"
        isOpen={openSection === 'glass'}
        items={catalog.glass}
        suffix="₽/м²"
        title="Стекло"
        onAdd={() => addOption('glass')}
        onChange={(id, value) => updateOption('glass', id, { price: value })}
        onDelete={(id) => deleteOption('glass', id)}
        onNameChange={(id, value) => updateOption('glass', id, { label: value })}
        onToggle={() => toggleSection('glass')}
      />
      <PriceGroup
        controlsId="price-hardware"
        isOpen={openSection === 'hardware'}
        items={catalog.hardware}
        suffix="%"
        title="Цвет фурнитуры"
        onAdd={() => addOption('hardware')}
        onChange={(id, value) => updateOption('hardware', id, { price: value })}
        onDelete={(id) => deleteOption('hardware', id)}
        onNameChange={(id, value) => updateOption('hardware', id, { label: value })}
        onToggle={() => toggleSection('hardware')}
      />
      <PriceGroup
        controlsId="price-hardware-class"
        isOpen={openSection === 'hardwareClass'}
        items={catalog.hardwareClass}
        suffix="₽"
        title="Класс фурнитуры"
        onAdd={() => addOption('hardwareClass')}
        onChange={(id, value) => updateOption('hardwareClass', id, { price: value })}
        onDelete={(id) => deleteOption('hardwareClass', id)}
        onNameChange={(id, value) => updateOption('hardwareClass', id, { label: value })}
        onToggle={() => toggleSection('hardwareClass')}
      />

      <section className={openSection === 'constructions' ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
        <PriceAccordionHeader
          controlsId="price-constructions"
          isOpen={openSection === 'constructions'}
          meta="База и монтаж"
          title="Конструкции"
          onAdd={addConstruction}
          onToggle={() => toggleSection('constructions')}
        />
        {openSection === 'constructions' ? (
          <div className="price-list price-accordion-body" id="price-constructions">
            {catalog.constructions.map((item) => (
              <ConstructionPriceRow
                basePrice={item.basePrice}
                canDelete={catalog.constructions.length > 1}
                installationPrice={item.installationPrice}
                key={item.id}
                label={item.shortTitle}
                onBasePriceChange={(value) => updateConstruction(item.id, { basePrice: value })}
                onDelete={() => deleteConstruction(item.id)}
                onInstallationPriceChange={(value) => updateConstruction(item.id, { installationPrice: value })}
                onLabelChange={(value) => updateConstruction(item.id, { shortTitle: value, title: value })}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={openSection === 'services' ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
        <PriceAccordionHeader
          controlsId="price-services"
          isOpen={openSection === 'services'}
          meta="Руб. и проценты"
          title="Услуги"
          onToggle={() => toggleSection('services')}
        />
        {openSection === 'services' ? (
          <div className="price-list price-accordion-body" id="price-services">
            <ServiceRow label="Доставка по городу" value={catalog.services.deliveryBase} onChange={(value) => updateService('deliveryBase', value)} />
            <ServiceRow label="За городом, ₽/км" value={catalog.services.deliveryKmRate} onChange={(value) => updateService('deliveryKmRate', value)} />
            <ServiceRow label="Скидка по умолчанию, %" value={catalog.services.discountPercent} onChange={(value) => updateService('discountPercent', value)} />
            <ServiceRow label="Дизайнер, %" value={catalog.services.designerPercent} onChange={(value) => updateService('designerPercent', value)} />
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
        ) : null}
      </section>

      <PriceGroup
        controlsId="price-mirror-materials"
        isOpen={openSection === 'mirrorMaterials'}
        items={mirrorCatalog.materials}
        suffix="₽/м²"
        title="Материалы зеркал"
        onAdd={addMirrorMaterial}
        onChange={(id, value) => updateMirrorMaterial(id, { price: value })}
        onDelete={deleteMirrorMaterial}
        onNameChange={(id, value) => updateMirrorMaterial(id, { label: value })}
        onToggle={() => toggleSection('mirrorMaterials')}
      />

      <section className={openSection === 'mirrorServices' ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
        <PriceAccordionHeader
          controlsId="price-mirror-services"
          isOpen={openSection === 'mirrorServices'}
          meta="Работы, монтаж, доставка"
          title="Работы для зеркал"
          onAdd={addMirrorService}
          onToggle={() => toggleSection('mirrorServices')}
        />
        {openSection === 'mirrorServices' ? (
          <div className="price-list price-accordion-body" id="price-mirror-services">
            {mirrorCatalog.services.map((item) => (
              <MirrorServicePriceRow
                canDelete={mirrorCatalog.services.length > 1}
                item={item}
                key={item.id}
                onChange={(patch) => updateMirrorService(item.id, patch)}
                onDelete={() => deleteMirrorService(item.id)}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={openSection === 'mirrorSettings' ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
        <PriceAccordionHeader
          controlsId="price-mirror-settings"
          isOpen={openSection === 'mirrorSettings'}
          meta="Наценки и комиссии"
          title="Настройки зеркал"
          onToggle={() => toggleSection('mirrorSettings')}
        />
        {openSection === 'mirrorSettings' ? (
          <div className="price-list price-accordion-body" id="price-mirror-settings">
            <ServiceRow label="Наценка на материал, %" value={mirrorCatalog.settings.materialMarkupPercent} onChange={(value) => updateMirrorSetting('materialMarkupPercent', value)} />
            <ServiceRow label="Наценка на работы, %" value={mirrorCatalog.settings.serviceMarkupPercent} onChange={(value) => updateMirrorSetting('serviceMarkupPercent', value)} />
            <ServiceRow label="Менеджер, %" value={mirrorCatalog.settings.managerPercent} onChange={(value) => updateMirrorSetting('managerPercent', value)} />
            <ServiceRow label="Дизайнер, %" value={mirrorCatalog.settings.designerPercent} onChange={(value) => updateMirrorSetting('designerPercent', value)} />
            <ServiceRow label="Скидка по умолчанию, %" value={mirrorCatalog.settings.discountPercent} onChange={(value) => updateMirrorSetting('discountPercent', value)} />
          </div>
        ) : null}
      </section>
    </div>
  )
}

type PriceGroupProps = {
  controlsId: string
  isOpen: boolean
  title: string
  suffix: string
  items: PriceOption[]
  onChange: (id: string, value: number) => void
  onNameChange: (id: string, value: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onToggle: () => void
}

function PriceGroup({
  controlsId,
  isOpen,
  title,
  suffix,
  items,
  onChange,
  onNameChange,
  onAdd,
  onDelete,
  onToggle,
}: PriceGroupProps) {
  return (
    <section className={isOpen ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
      <PriceAccordionHeader
        controlsId={controlsId}
        isOpen={isOpen}
        meta={suffix}
        title={title}
        onAdd={onAdd}
        onToggle={onToggle}
      />
      {isOpen ? (
        <div className="price-list price-accordion-body" id={controlsId}>
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
      ) : null}
    </section>
  )
}

type PriceAccordionHeaderProps = {
  title: string
  meta: string
  controlsId: string
  isOpen: boolean
  onToggle: () => void
  onAdd?: () => void
}

function PriceAccordionHeader({ title, meta, controlsId, isOpen, onToggle, onAdd }: PriceAccordionHeaderProps) {
  const addItem = () => {
    if (!isOpen) onToggle()
    onAdd?.()
  }

  return (
    <div className="price-accordion-header">
      <h2 className="price-accordion-heading">
        <button
          aria-controls={controlsId}
          aria-expanded={isOpen}
          className="price-accordion-toggle"
          type="button"
          onClick={onToggle}
        >
          <span className="price-accordion-copy">
            <span className="price-accordion-title">{title}</span>
            <small>{meta}</small>
          </span>
          <ChevronDown className="price-accordion-chevron" size={20} aria-hidden="true" />
        </button>
      </h2>
      {onAdd ? (
        <button aria-label={`Добавить в раздел ${title}`} className="price-accordion-add" type="button" onClick={addItem}>
          <Plus size={16} />
          Добавить
        </button>
      ) : null}
    </div>
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

type ConstructionPriceRowProps = {
  label: string
  basePrice: number
  installationPrice: number
  canDelete: boolean
  onLabelChange: (value: string) => void
  onBasePriceChange: (value: number) => void
  onInstallationPriceChange: (value: number) => void
  onDelete: () => void
}

function ConstructionPriceRow({
  label,
  basePrice,
  installationPrice,
  canDelete,
  onLabelChange,
  onBasePriceChange,
  onInstallationPriceChange,
  onDelete,
}: ConstructionPriceRowProps) {
  return (
    <div className="construction-price-row">
      <label className="price-name-field">
        <span className="sr-only">Название конструкции</span>
        <input
          aria-label={`Название конструкции: ${label || 'без названия'}`}
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </label>
      <label className="construction-price-field">
        <span>База</span>
        <div className="price-value-field">
          <input
            aria-label={`Базовая цена: ${label || 'конструкция'}`}
            inputMode="numeric"
            type="number"
            value={basePrice}
            onChange={(event) => onBasePriceChange(Number(event.target.value))}
          />
          <small>₽</small>
        </div>
      </label>
      <label className="construction-price-field">
        <span>Монтаж</span>
        <div className="price-value-field">
          <input
            aria-label={`Стоимость монтажа: ${label || 'конструкция'}`}
            inputMode="numeric"
            type="number"
            value={installationPrice}
            onChange={(event) => onInstallationPriceChange(Number(event.target.value))}
          />
          <small>₽</small>
        </div>
      </label>
      <button
        aria-label={`Удалить конструкцию ${label || 'без названия'}`}
        className="price-delete"
        disabled={!canDelete}
        title={canDelete ? 'Удалить конструкцию' : 'Должна остаться хотя бы одна конструкция'}
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

type MirrorServicePriceRowProps = {
  item: MirrorService
  canDelete: boolean
  onChange: (patch: Partial<MirrorService>) => void
  onDelete: () => void
}

function MirrorServicePriceRow({ item, canDelete, onChange, onDelete }: MirrorServicePriceRowProps) {
  return (
    <div className="mirror-service-price-row">
      <label className="price-name-field">
        <span className="sr-only">Название работы</span>
        <input value={item.label} onChange={(event) => onChange({ label: event.target.value })} />
      </label>
      <label className="price-value-field">
        <span className="sr-only">Цена работы</span>
        <input
          inputMode="numeric"
          type="number"
          value={item.price}
          onChange={(event) => onChange({ price: Number(event.target.value) })}
        />
        <small>₽</small>
      </label>
      <label className="mirror-service-unit">
        <span>Единица</span>
        <select value={item.unit} onChange={(event) => onChange({ unit: event.target.value as MirrorService['unit'] })}>
          {Object.entries(mirrorUnitLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </label>
      <label className="mirror-service-category">
        <span>Раздел</span>
        <select
          value={item.category}
          onChange={(event) => onChange({ category: event.target.value as MirrorService['category'] })}
        >
          <option value="work">Работы</option>
          <option value="delivery">Доставка</option>
        </select>
      </label>
      <label className="mirror-service-visible">
        <input
          checked={item.visibleInQuote}
          type="checkbox"
          onChange={(event) => onChange({ visibleInQuote: event.target.checked })}
        />
        <span>Показывать в КП</span>
      </label>
      <button
        aria-label={`Удалить ${item.label}`}
        className="price-delete"
        disabled={!canDelete}
        type="button"
        onClick={onDelete}
      >
        <Trash2 size={17} />
      </button>
    </div>
  )
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
      <ShowerSketch sketch={construction.sketch} />
    </span>
  )
}

function MirrorPreviewIcon() {
  return (
    <span className="construction-preview mirror-preview-icon" aria-hidden="true">
      <span className="mirror-preview-glass"><ScanLine size={24} /></span>
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
