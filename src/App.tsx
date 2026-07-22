import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import {
  Archive,
  Box,
  Calculator,
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  CloudOff,
  Copy,
  FileDown,
  Image,
  Layers3,
  ListPlus,
  LoaderCircle,
  LogIn,
  LogOut,
  Minus,
  Pencil,
  Plus,
  RefreshCw,
  Ruler,
  RotateCcw,
  Save,
  Search,
  ScanLine,
  Settings2,
  ShieldCheck,
  Trash2,
  Truck,
  UserRound,
  X,
} from 'lucide-react'
import showerThumbnailSprite from './assets/shower-thumbnail-sprite.png'
import './App.css'
import {
  applyQuoteDelivery,
  calculateQuoteDelivery,
  calculateQuote,
  combineCalculationResults,
  createInitialForm,
  createQuote,
  getConstruction,
  getOption,
  getPublicProductPrice,
  getQuoteCustomer,
  getQuoteDelivery,
  getNextQuoteNumber,
  getQuoteItemQuantity,
  getQuoteItemDetails,
  getQuoteItemTitle,
  getQuoteItems,
  getQuoteTotal,
  isMirrorQuoteItem,
  money,
  multiplyCalculationResult,
  normalizeQuoteDelivery,
  normalizeQuoteCustomer,
  normalizeQuoteQuantity,
  resetDimensionsForConstruction,
  shortMoney,
  updateQuoteManually,
  type CalculatorForm,
  type CalculationResult,
  type ManualQuotePatch,
  type Quote,
  type QuoteCustomer,
  type QuoteDelivery,
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
  mergeCatalog,
  mergeMirrorCatalog,
  resetCatalog,
  resetMirrorCatalog,
  saveCatalog,
  saveMirrorCatalog,
  saveQuotes,
} from './storage'
import {
  clearServerSession,
  loadServerCatalogs,
  loadServerSession,
  loginToServer,
  saveServerCatalogs,
  ServerSyncError,
  type ServerSession,
} from './serverSync'
import { shareQuotePdf, type QuotePdfPreview } from './quotePdf'
import mirrorVisualization from './assets/mirror-visualization.png'

type ProductKind = 'shower' | 'mirror'
type TabId = 'showers' | 'mirrors' | 'archive' | 'prices'
type PriceSyncStatus = 'signed-out' | 'loading' | 'saving' | 'synced' | 'error'

type PriceSyncState = {
  status: PriceSyncStatus
  username: string
  message: string
  updatedAt: string
  ready: boolean
}

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
  quantity: number
  form: CalculatorForm
}

type MirrorDraftPosition = {
  id: string
  kind: 'mirror'
  quantity: number
  form: MirrorForm
}

type DraftPosition = ShowerDraftPosition | MirrorDraftPosition

type PositionSummary = {
  id: string
  index: number
  kind: ProductKind
  title: string
  quantity: number
  total: number
  hasErrors: boolean
}

type SharedFormPatch = Pick<CalculatorForm, 'discountEnabled' | 'discountPercent' | 'designerEnabled'>

const sharedFormFields: Array<keyof SharedFormPatch> = [
  'discountEnabled',
  'discountPercent',
  'designerEnabled',
]

const createDraftPosition = (catalog: PricingCatalog, customer?: Partial<SharedFormPatch>): ShowerDraftPosition => {
  const form = createInitialForm(catalog)
  if (customer) {
    form.discountEnabled = customer.discountEnabled ?? form.discountEnabled
    form.discountPercent = customer.discountPercent ?? form.discountPercent
    form.designerEnabled = customer.designerEnabled ?? form.designerEnabled
  }
  return { id: crypto.randomUUID(), kind: 'shower', quantity: 1, form }
}

const createMirrorDraftPosition = (
  catalog: MirrorPricingCatalog,
  customer?: Partial<SharedFormPatch>,
): MirrorDraftPosition => ({
  id: crypto.randomUUID(),
  kind: 'mirror',
  quantity: 1,
  form: createInitialMirrorForm(catalog, customer),
})

function App() {
  const [catalog, setCatalog] = useState<PricingCatalog>(() => loadCatalog())
  const [mirrorCatalog, setMirrorCatalog] = useState<MirrorPricingCatalog>(() => loadMirrorCatalog())
  const [quotes, setQuotes] = useState<Quote[]>(() => loadQuotes())
  const [positions, setPositions] = useState<DraftPosition[]>(() => [createDraftPosition(loadCatalog())])
  const [orderDelivery, setOrderDelivery] = useState<QuoteDelivery>(() => normalizeQuoteDelivery(null))
  const [orderCustomer, setOrderCustomer] = useState<QuoteCustomer>(() => normalizeQuoteCustomer(null))
  const [activePositionId, setActivePositionId] = useState(() => positions[0].id)
  const [activeTab, setActiveTab] = useState<TabId>('showers')
  const [notice, setNotice] = useState('')
  const [editingQuoteId, setEditingQuoteId] = useState('')
  const [pdfQuoteId, setPdfQuoteId] = useState('')
  const [pdfPreview, setPdfPreview] = useState<QuotePdfPreview | null>(null)
  const [serverSession, setServerSession] = useState<ServerSession | null>(() => loadServerSession())
  const [syncStatus, setSyncStatus] = useState<PriceSyncStatus>(serverSession ? 'loading' : 'signed-out')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncUpdatedAt, setSyncUpdatedAt] = useState('')
  const [serverSyncReady, setServerSyncReady] = useState(false)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const catalogRef = useRef(catalog)
  const mirrorCatalogRef = useRef(mirrorCatalog)
  catalogRef.current = catalog
  mirrorCatalogRef.current = mirrorCatalog

  const activePosition = positions.find((position) => position.id === activePositionId) ?? positions[0]
  const positionResults = useMemo(
    () => positions.map((position) => {
      const unitResult = position.kind === 'mirror'
        ? calculateMirrorQuote(mirrorCatalog, position.form)
        : calculateQuote(catalog, position.form)
      return {
        ...position,
        unitResult,
        result: multiplyCalculationResult(unitResult, position.quantity),
      }
    }),
    [catalog, mirrorCatalog, positions],
  )
  const activeResult = positionResults.find((position) => position.id === activePosition.id)?.result
    ?? multiplyCalculationResult(activePosition.kind === 'mirror'
      ? calculateMirrorQuote(mirrorCatalog, activePosition.form)
      : calculateQuote(catalog, activePosition.form), activePosition.quantity)
  const orderResult = useMemo(
    () => applyQuoteDelivery(
      combineCalculationResults(positionResults.map((position) => position.result)),
      calculateQuoteDelivery(catalog, orderDelivery),
    ),
    [catalog, orderDelivery, positionResults],
  )
  const orderDeliveryPrice = calculateQuoteDelivery(catalog, orderDelivery)
  const positionSummaries = useMemo<PositionSummary[]>(
    () => positionResults.map((position, index) => ({
      id: position.id,
      index,
      kind: position.kind,
      title: position.kind === 'mirror'
        ? getMirrorTitle(position.form)
        : getConstruction(catalog, position.form.constructionId).shortTitle,
      quantity: position.quantity,
      total: position.result.total,
      hasErrors: Object.keys(position.result.errors).length > 0,
    })),
    [catalog, positionResults],
  )
  useEffect(() => saveCatalog(catalog), [catalog])
  useEffect(() => saveMirrorCatalog(mirrorCatalog), [mirrorCatalog])
  useEffect(() => saveQuotes(quotes), [quotes])
  useEffect(() => {
    let cancelled = false
    if (!serverSession) {
      setServerSyncReady(false)
      setSyncStatus('signed-out')
      return undefined
    }

    const hydrateFromServer = async () => {
      setServerSyncReady(false)
      setSyncStatus('loading')
      setSyncMessage('')
      try {
        const remote = await loadServerCatalogs()
        if (cancelled) return
        const remoteShower = remote.shower_catalog as Partial<PricingCatalog>
        const remoteMirror = remote.mirror_catalog as Partial<MirrorPricingCatalog>
        const hasRemoteShower = Array.isArray(remoteShower.constructions) && remoteShower.constructions.length > 0
        const hasRemoteMirror = Array.isArray(remoteMirror.materials) && remoteMirror.materials.length > 0
        const nextCatalog = hasRemoteShower
          ? mergeCatalog(remote.shower_catalog as PricingCatalog)
          : catalogRef.current
        const nextMirrorCatalog = hasRemoteMirror
          ? mergeMirrorCatalog(remote.mirror_catalog as MirrorPricingCatalog)
          : mirrorCatalogRef.current

        setCatalog(nextCatalog)
        setMirrorCatalog(nextMirrorCatalog)

        const saved = !hasRemoteShower || !hasRemoteMirror
          ? await saveServerCatalogs(nextCatalog, nextMirrorCatalog)
          : remote
        if (cancelled) return
        setSyncUpdatedAt(saved.updated_at || new Date().toISOString())
        setSyncStatus('synced')
        setServerSyncReady(true)
      } catch (error) {
        if (cancelled) return
        if (error instanceof ServerSyncError && error.code === 'auth') {
          clearServerSession()
          setServerSession(null)
          setSyncStatus('signed-out')
        } else {
          setSyncStatus('error')
        }
        setSyncMessage(error instanceof Error ? error.message : 'Не удалось загрузить цены')
      }
    }

    void hydrateFromServer()
    return () => {
      cancelled = true
    }
  }, [serverSession, syncAttempt])
  useEffect(() => {
    if (!serverSession || !serverSyncReady) return undefined
    let cancelled = false
    setSyncStatus('saving')
    const timer = window.setTimeout(() => {
      void saveServerCatalogs(catalog, mirrorCatalog)
        .then((saved) => {
          if (cancelled) return
          setSyncUpdatedAt(saved.updated_at || new Date().toISOString())
          setSyncMessage('')
          setSyncStatus('synced')
        })
        .catch((error) => {
          if (cancelled) return
          if (error instanceof ServerSyncError && error.code === 'auth') {
            clearServerSession()
            setServerSession(null)
            setSyncStatus('signed-out')
          } else {
            setSyncStatus('error')
          }
          setSyncMessage(error instanceof Error ? error.message : 'Не удалось сохранить цены')
        })
    }, 700)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [catalog, mirrorCatalog, serverSession, serverSyncReady])
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
      ? { kind: 'mirror', quantity: position.quantity, form: cloneMirrorForm(position.form), result: position.unitResult }
      : { kind: 'shower', quantity: position.quantity, form: cloneForm(position.form), result: position.unitResult })
    const editingQuote = quotes.find((item) => item.id === editingQuoteId)
    const quoteNumber = editingQuote?.number ?? getNextQuoteNumber(quotes)
    const quote = createQuote(catalog, mirrorCatalog, drafts, orderDelivery, orderCustomer, quoteNumber)
    if (!editingQuote) return quote
    return {
      ...quote,
      id: editingQuote.id,
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
      setPdfPreview(preview)
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
    const sharedSettings = pickSharedPatch(activePosition.form)
    const next = kind === 'mirror'
      ? createMirrorDraftPosition(mirrorCatalog, sharedSettings)
      : createDraftPosition(catalog, sharedSettings)
    setPositions((current) => [...current, next])
    setActivePositionId(next.id)
    setActiveTab(kind === 'mirror' ? 'mirrors' : 'showers')
    setNotice(`Позиция ${positions.length + 1} добавлена`)
  }

  const duplicatePosition = () => {
    const next: DraftPosition = activePosition.kind === 'mirror'
      ? { id: crypto.randomUUID(), kind: 'mirror', quantity: activePosition.quantity, form: cloneMirrorForm(activePosition.form) }
      : { id: crypto.randomUUID(), kind: 'shower', quantity: activePosition.quantity, form: cloneForm(activePosition.form) }
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
    const nextPositions: DraftPosition[] = items.map((item) => {
      if (isMirrorQuoteItem(item)) {
        const form = cloneMirrorForm(item.form)
        form.options = form.options.filter((option) => getMirrorService(mirrorCatalog, option.serviceId).category !== 'delivery')
        form.clientName = ''
        form.clientPhone = ''
        form.note = ''
        return { id: crypto.randomUUID(), kind: 'mirror', quantity: getQuoteItemQuantity(item), form }
      }
      const form = cloneForm(item.form)
      form.delivery = false
      form.deliveryZone = 'inside'
      form.deliveryKm = 0
      form.clientName = ''
      form.clientPhone = ''
      form.note = ''
      return { id: crypto.randomUUID(), kind: 'shower', quantity: getQuoteItemQuantity(item), form }
    })
    const selectedIndex = itemId ? Math.max(0, items.findIndex((item) => item.id === itemId)) : 0
    const selected = nextPositions[selectedIndex]
    setPositions(nextPositions)
    setOrderDelivery(getQuoteDelivery(quote))
    setOrderCustomer(getQuoteCustomer(quote))
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

  const updatePositionQuantity = (quantity: number) => {
    setPositions((current) => current.map((position) => position.id === activePositionId
      ? { ...position, quantity: normalizeQuoteQuantity(quantity) }
      : position))
  }

  const updateOrderDelivery = (patch: Partial<QuoteDelivery>) => {
    setOrderDelivery((current) => normalizeQuoteDelivery({ ...current, ...patch }))
  }

  const updateOrderCustomer = (patch: Partial<QuoteCustomer>) => {
    setOrderCustomer((current) => normalizeQuoteCustomer({ ...current, ...patch }))
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

  const loginForServerSync = async (username: string, password: string) => {
    setSyncStatus('loading')
    setSyncMessage('')
    try {
      const session = await loginToServer(username, password)
      setServerSession(session)
      setNotice('Вход выполнен, загружаю цены с сервера')
    } catch (error) {
      setSyncStatus('signed-out')
      setSyncMessage(error instanceof Error ? error.message : 'Не удалось войти')
      throw error
    }
  }

  const logoutFromServerSync = () => {
    clearServerSession()
    setServerSession(null)
    setSyncMessage('')
    setSyncUpdatedAt('')
    setNotice('Синхронизация отключена')
  }

  const retryServerSync = async () => {
    if (!serverSession) return
    if (!serverSyncReady) {
      setSyncAttempt((current) => current + 1)
      return
    }
    setSyncStatus('saving')
    setSyncMessage('')
    try {
      const saved = await saveServerCatalogs(catalogRef.current, mirrorCatalogRef.current)
      setSyncUpdatedAt(saved.updated_at || new Date().toISOString())
      setSyncStatus('synced')
    } catch (error) {
      if (error instanceof ServerSyncError && error.code === 'auth') {
        clearServerSession()
        setServerSession(null)
        setSyncStatus('signed-out')
      } else {
        setSyncStatus('error')
      }
      setSyncMessage(error instanceof Error ? error.message : 'Не удалось сохранить цены')
    }
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
            customer={orderCustomer}
            delivery={orderDelivery}
            deliveryKmRate={catalog.services.deliveryKmRate}
            deliveryPrice={orderDeliveryPrice}
            form={activePosition.form}
            quantity={activePosition.quantity}
            result={activeResult}
            orderResult={orderResult}
            positionSummaries={positionSummaries}
            activePositionId={activePositionId}
            isPdfBusy={pdfQuoteId !== ''}
            onAddPosition={() => addPosition('shower')}
            onDeletePosition={deletePosition}
            onDimension={updateDimension}
            onDuplicatePosition={duplicatePosition}
            onCustomer={updateOrderCustomer}
            onDelivery={updateOrderDelivery}
            onForm={updateForm}
            onPdf={downloadCurrentQuotePdf}
            onQuantity={updatePositionQuantity}
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
            customer={orderCustomer}
            delivery={orderDelivery}
            deliveryKmRate={catalog.services.deliveryKmRate}
            deliveryPrice={orderDeliveryPrice}
            form={activePosition.form}
            isPdfBusy={pdfQuoteId !== ''}
            orderResult={orderResult}
            positionSummaries={positionSummaries}
            quantity={activePosition.quantity}
            result={activeResult}
            onAddPosition={() => addPosition('mirror')}
            onDeletePosition={deletePosition}
            onDuplicatePosition={duplicatePosition}
            onCustomer={updateOrderCustomer}
            onDelivery={updateOrderDelivery}
            onForm={updateMirrorForm}
            onPdf={downloadCurrentQuotePdf}
            onQuantity={updatePositionQuantity}
            onSave={saveCurrentQuote}
            onSelectPosition={selectPosition}
          />
        ) : null}

        {activeTab === 'archive' ? (
          <ArchiveScreen
            catalog={catalog}
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
            onLogin={loginForServerSync}
            onLogout={logoutFromServerSync}
            onMirrorCatalog={setMirrorCatalog}
            onReset={resetPrices}
            onRetry={() => void retryServerSync()}
            syncState={{
              status: syncStatus,
              username: serverSession?.username ?? '',
              message: syncMessage,
              updatedAt: syncUpdatedAt,
              ready: serverSyncReady,
            }}
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
  customer: QuoteCustomer
  delivery: QuoteDelivery
  deliveryKmRate: number
  deliveryPrice: number
  form: CalculatorForm
  quantity: number
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
  onCustomer: (patch: Partial<QuoteCustomer>) => void
  onDelivery: (patch: Partial<QuoteDelivery>) => void
  onForm: (patch: Partial<CalculatorForm>) => void
  onPdf: () => void
  onQuantity: (quantity: number) => void
  onSave: () => void
  onOpenArchive: () => void
  onOpenQuote: (quote: Quote) => void
  onSelectConstruction: (id: string) => void
  onSelectPosition: (id: string) => void
}

type ConfigSectionId = 'construction' | 'dimensions' | 'appearance' | 'services'

const configSections: Array<{ id: ConfigSectionId; label: string }> = [
  { id: 'construction', label: 'Тип' },
  { id: 'dimensions', label: 'Размеры' },
  { id: 'appearance', label: 'Вид' },
  { id: 'services', label: 'Услуги' },
]

function CalculatorScreen({
  catalog,
  customer,
  delivery,
  deliveryKmRate,
  deliveryPrice,
  form,
  quantity,
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
  onCustomer,
  onDelivery,
  onForm,
  onPdf,
  onQuantity,
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
        activeQuantity={quantity}
        customer={customer}
        delivery={delivery}
        deliveryKmRate={deliveryKmRate}
        deliveryPrice={deliveryPrice}
        positions={positionSummaries}
        onAdd={onAddPosition}
        onCustomer={onCustomer}
        onDelete={onDeletePosition}
        onDelivery={onDelivery}
        onDuplicate={onDuplicatePosition}
        onQuantity={onQuantity}
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
          onSelect={(glassId) => onForm({ glassId })}
        />
        <div className="inline-selects">
          <OptionSelect
            label="Фурнитура"
            value={form.hardwareId}
            items={catalog.hardware}
            onChange={(hardwareId) => onForm({ hardwareId })}
          />
          <OptionSelect
            label="Класс"
            value={form.hardwareClassId}
            items={catalog.hardwareClass}
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
  customer: QuoteCustomer
  delivery: QuoteDelivery
  deliveryKmRate: number
  deliveryPrice: number
  form: MirrorForm
  quantity: number
  result: CalculationResult
  orderResult: CalculationResult
  positionSummaries: PositionSummary[]
  activePositionId: string
  isPdfBusy: boolean
  onAddPosition: () => void
  onDeletePosition: (id: string) => void
  onDuplicatePosition: () => void
  onCustomer: (patch: Partial<QuoteCustomer>) => void
  onDelivery: (patch: Partial<QuoteDelivery>) => void
  onForm: (patch: Partial<MirrorForm>) => void
  onPdf: () => void
  onQuantity: (quantity: number) => void
  onSave: () => void
  onSelectPosition: (id: string) => void
}

type MirrorSectionId = 'dimensions' | 'material' | 'options' | 'pricing'

const mirrorSections: Array<{ id: MirrorSectionId; label: string }> = [
  { id: 'dimensions', label: 'Размеры' },
  { id: 'material', label: 'Материал' },
  { id: 'options', label: 'Работы' },
  { id: 'pricing', label: 'Цена' },
]

function MirrorCalculatorScreen({
  catalog,
  customer,
  delivery,
  deliveryKmRate,
  deliveryPrice,
  form,
  quantity,
  result,
  orderResult,
  positionSummaries,
  activePositionId,
  isPdfBusy,
  onAddPosition,
  onDeletePosition,
  onDuplicatePosition,
  onCustomer,
  onDelivery,
  onForm,
  onPdf,
  onQuantity,
  onSave,
  onSelectPosition,
}: MirrorCalculatorScreenProps) {
  const [activeSection, setActiveSection] = useState<MirrorSectionId>('dimensions')
  const material = getMirrorMaterial(catalog, form.materialId)
  const calculatedOptions = getMirrorCalculatedOptions(catalog, form)
  const selectedServices = new Set(form.options.map((option) => option.serviceId))
  const availableServices = catalog.services.filter((item) => item.category !== 'delivery')

  const addOption = () => {
    const service = availableServices.find((item) => !selectedServices.has(item.id)) ?? availableServices[0]
    if (!service) return
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
        activeQuantity={quantity}
        customer={customer}
        delivery={delivery}
        deliveryKmRate={deliveryKmRate}
        deliveryPrice={deliveryPrice}
        positions={positionSummaries}
        onAdd={onAddPosition}
        onCustomer={onCustomer}
        onDelete={onDeletePosition}
        onDelivery={onDelivery}
        onDuplicate={onDuplicatePosition}
        onQuantity={onQuantity}
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
                          {availableServices.map((item) => (
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
                    <span>Добавить работу или монтаж</span>
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
              <b>{shortMoney(getQuoteTotal(quote))} ₽</b>
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
  activeQuantity: number
  customer: QuoteCustomer
  delivery: QuoteDelivery
  deliveryKmRate: number
  deliveryPrice: number
  positions: PositionSummary[]
  onAdd: () => void
  onCustomer: (patch: Partial<QuoteCustomer>) => void
  onDelete: (id: string) => void
  onDelivery: (patch: Partial<QuoteDelivery>) => void
  onDuplicate: () => void
  onQuantity: (quantity: number) => void
  onSelect: (id: string) => void
}

function PositionSwitcher({
  activeId,
  activeQuantity,
  customer,
  delivery,
  deliveryKmRate,
  deliveryPrice,
  positions,
  onAdd,
  onCustomer,
  onDelete,
  onDelivery,
  onDuplicate,
  onQuantity,
  onSelect,
}: PositionSwitcherProps) {
  return (
    <section className="section-block position-section">
      <div className="section-title position-title">
        <h2>Позиции</h2>
        <div className="position-tools">
          <div className="position-quantity" role="group" aria-label="Количество активной позиции">
            <span>Количество</span>
            <div>
              <button
                aria-label="Уменьшить количество"
                disabled={activeQuantity <= 1}
                title="Уменьшить количество"
                type="button"
                onClick={() => onQuantity(activeQuantity - 1)}
              >
                <Minus size={15} />
              </button>
              <input
                aria-label="Количество активной позиции"
                inputMode="numeric"
                max={999}
                min={1}
                type="number"
                value={activeQuantity}
                onChange={(event) => onQuantity(Number(event.target.value))}
              />
              <button
                aria-label="Увеличить количество"
                disabled={activeQuantity >= 999}
                title="Увеличить количество"
                type="button"
                onClick={() => onQuantity(activeQuantity + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
          </div>
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
                <small>{position.quantity} шт. · {shortMoney(position.total)} ₽</small>
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
      <DeliveryControl
        delivery={delivery}
        kmRate={deliveryKmRate}
        price={deliveryPrice}
        onChange={onDelivery}
      />
      <CustomerControl customer={customer} onChange={onCustomer} />
    </section>
  )
}

type CustomerControlProps = {
  customer: QuoteCustomer
  onChange: (patch: Partial<QuoteCustomer>) => void
}

function CustomerControl({ customer, onChange }: CustomerControlProps) {
  return (
    <div className="order-customer-control">
      <div className="order-customer-title">
        <UserRound size={18} aria-hidden="true" />
        <span>Клиент по КП</span>
        <small>Общий для всех позиций</small>
      </div>
      <div className="order-customer-fields">
        <label className="text-field">
          <span>Имя</span>
          <input
            autoComplete="name"
            value={customer.clientName}
            onChange={(event) => onChange({ clientName: event.target.value })}
          />
        </label>
        <label className="text-field">
          <span>Телефон</span>
          <input
            autoComplete="tel"
            inputMode="tel"
            value={customer.clientPhone}
            onChange={(event) => onChange({ clientPhone: event.target.value })}
          />
        </label>
        <label className="text-field is-wide">
          <span>Комментарий</span>
          <input value={customer.note} onChange={(event) => onChange({ note: event.target.value })} />
        </label>
      </div>
    </div>
  )
}

type DeliveryControlProps = {
  delivery: QuoteDelivery
  kmRate: number
  price: number
  onChange: (patch: Partial<QuoteDelivery>) => void
}

function DeliveryControl({ delivery, kmRate, price, onChange }: DeliveryControlProps) {
  return (
    <div className="order-delivery-control">
      <div className="order-delivery-title">
        <Truck size={18} aria-hidden="true" />
        <span>Доставка по КП</span>
        <strong>{money(price)}</strong>
      </div>
      <div className="segmented order-delivery-modes" role="group" aria-label="Тип доставки">
        <button
          className={!delivery.enabled ? 'is-active' : ''}
          type="button"
          onClick={() => onChange({ enabled: false })}
        >
          Без доставки
        </button>
        <button
          className={delivery.enabled && delivery.zone === 'inside' ? 'is-active' : ''}
          type="button"
          onClick={() => onChange({ enabled: true, zone: 'inside', km: 0 })}
        >
          По городу
        </button>
        <button
          className={delivery.enabled && delivery.zone === 'outside' ? 'is-active' : ''}
          type="button"
          onClick={() => onChange({ enabled: true, zone: 'outside' })}
        >
          За городом
        </button>
      </div>
      {delivery.enabled && delivery.zone === 'outside' ? (
        <label className="order-delivery-distance">
          <span>Км за городом</span>
          <input
            inputMode="numeric"
            min={0}
            type="number"
            value={delivery.km}
            onChange={(event) => onChange({ km: Number(event.target.value) })}
          />
          <small>{shortMoney(kmRate)} ₽/км</small>
        </label>
      ) : null}
    </div>
  )
}

type OptionGridProps = {
  activeId: string
  items: PriceOption[]
  priceSuffix?: string
  onSelect: (id: string) => void
}

function OptionGrid({ activeId, items, priceSuffix, onSelect }: OptionGridProps) {
  return (
    <div className={priceSuffix ? 'option-grid' : 'option-grid option-grid-label-only'}>
      {items.map((item) => (
        <button
          className={item.id === activeId ? 'option-chip is-active' : 'option-chip'}
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
        >
          <i className={`glass-swatch swatch-${item.id}`} aria-hidden="true" />
          <span>{item.label}</span>
          {priceSuffix ? <small>
            {shortMoney(item.price)} {priceSuffix}
          </small> : null}
        </button>
      ))}
    </div>
  )
}

type OptionSelectProps = {
  label: string
  value: string
  items: PriceOption[]
  onChange: (value: string) => void
}

function OptionSelect({ label, value, items, onChange }: OptionSelectProps) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <span className="select-control">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <ChevronDown size={19} aria-hidden="true" />
      </span>
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
  catalog: PricingCatalog
  quotes: Quote[]
  pdfQuoteId: string
  onDelete: (id: string) => void
  onLoad: (quote: Quote, itemId?: string) => void
  onManualSave: (id: string, patch: ManualQuotePatch) => void
  onPdf: (quote: Quote) => void
  onStatus: (id: string, status: Quote['status']) => void
}

function ArchiveScreen({ catalog, quotes, pdfQuoteId, onDelete, onLoad, onManualSave, onPdf, onStatus }: ArchiveScreenProps) {
  const [query, setQuery] = useState('')
  const [manualQuote, setManualQuote] = useState<Quote | null>(null)
  const normalized = query.trim().toLowerCase()
  const filtered = quotes.filter((quote) => {
    const items = getQuoteItems(quote)
    const customer = getQuoteCustomer(quote)
    const haystack = [
      quote.number,
      customer.clientName,
      customer.clientPhone,
      statuses[quote.status],
      String(getQuoteTotal(quote)),
      ...items.flatMap((item) => isMirrorQuoteItem(item)
        ? [
            item.mirrorTitle,
            item.materialLabel,
            ...getQuoteItemDetails(item).flatMap((line) => [line.label, line.value]),
          ]
        : [
            item.constructionTitle,
            item.glassLabel,
            item.hardwareLabel,
            item.hardwareClassLabel,
            ...getQuoteItemDetails(item).flatMap((line) => [line.label, line.value]),
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
          const customer = getQuoteCustomer(quote)
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
                  {customer.clientName || 'Без имени'} · {money(getQuoteTotal(quote))}
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
          catalog={catalog}
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
  catalog: PricingCatalog
  quote: Quote
  onClose: () => void
  onSave: (patch: ManualQuotePatch) => void
}

function QuoteEditorDialog({ catalog, quote, onClose, onSave }: QuoteEditorDialogProps) {
  const initialDelivery = getQuoteDelivery(quote)
  const initialCustomer = getQuoteCustomer(quote)
  const [draft, setDraft] = useState<ManualQuotePatch>(() => ({
    ...initialCustomer,
    discountEnabled: quote.form.discountEnabled,
    discountPercent: quote.form.discountPercent,
    manualTotalEnabled: Number.isFinite(quote.manualTotal),
    manualTotal: getQuoteTotal(quote),
    orderDelivery: initialDelivery,
    deliveryPrice: calculateQuoteDelivery(catalog, initialDelivery),
    items: getQuoteItems(quote).map((item) => ({
      id: item.id,
      title: getQuoteItemTitle(item),
      quantity: getQuoteItemQuantity(item),
      product: getPublicProductPrice(item.result),
      details: getQuoteItemDetails(item),
    })),
  }))
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => new Set())

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

  const addDetail = (itemId: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? {
            ...item,
            details: [...item.details, { id: crypto.randomUUID(), label: '', value: '' }],
          }
        : item),
    }))
    setExpandedItemIds((current) => new Set(current).add(itemId))
  }

  const updateDetail = (
    itemId: string,
    detailId: string,
    patch: Partial<ManualQuotePatch['items'][number]['details'][number]>,
  ) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? {
            ...item,
            details: item.details.map((detail) => detail.id === detailId ? { ...detail, ...patch } : detail),
          }
        : item),
    }))
  }

  const deleteDetail = (itemId: string, detailId: string) => {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => item.id === itemId
        ? { ...item, details: item.details.filter((detail) => detail.id !== detailId) }
        : item),
    }))
  }

  const deleteItem = (itemId: string) => {
    setDraft((current) => current.items.length <= 1
      ? current
      : { ...current, items: current.items.filter((item) => item.id !== itemId) })
    setExpandedItemIds((current) => {
      const next = new Set(current)
      next.delete(itemId)
      return next
    })
  }

  const toggleItemDetails = (itemId: string) => {
    setExpandedItemIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const updateDelivery = (patch: Partial<QuoteDelivery>) => {
    setDraft((current) => {
      const orderDelivery = normalizeQuoteDelivery({ ...current.orderDelivery, ...patch })
      return {
        ...current,
        orderDelivery,
        deliveryPrice: calculateQuoteDelivery(catalog, orderDelivery),
      }
    })
  }

  const productSubtotal = draft.items.reduce((sum, item) => (
    sum + Math.max(0, Number(item.product) || 0) * normalizeQuoteQuantity(item.quantity)
  ), 0)
  const subtotal = productSubtotal + draft.deliveryPrice
  const discountPercent = Math.min(100, Math.max(0, Number(draft.discountPercent) || 0))
  const calculatedProductTotal = draft.discountEnabled
    ? draft.items.reduce((sum, item) => {
        const itemSubtotal = Math.max(0, Number(item.product) || 0)
        return sum + Math.round(itemSubtotal * (1 - discountPercent / 100) / 10) * 10
          * normalizeQuoteQuantity(item.quantity)
      }, 0)
    : productSubtotal
  const calculatedTotal = calculatedProductTotal + draft.deliveryPrice
  const total = draft.manualTotalEnabled
    ? Math.max(0, Number(draft.manualTotal) || 0)
    : calculatedTotal
  const hasDiscount = draft.discountEnabled && discountPercent > 0 && calculatedTotal < subtotal

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
            <div className="client-grid quote-editor-client-grid">
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
              {draft.items.map((item, index) => {
                const isExpanded = expandedItemIds.has(item.id)
                return (
                  <div className="manual-quote-item" key={item.id}>
                    <span className="manual-quote-index">{index + 1}</span>
                    <label className="text-field manual-quote-title">
                      <span>Наименование</span>
                      <input value={item.title} onChange={(event) => updateItem(item.id, { title: event.target.value })} />
                    </label>
                    <label className="manual-money-field manual-quantity-field">
                      <span>Кол-во</span>
                      <span className="manual-money-input">
                        <input
                          inputMode="numeric"
                          max={999}
                          min={1}
                          type="number"
                          value={item.quantity}
                          onChange={(event) => updateItem(item.id, {
                            quantity: normalizeQuoteQuantity(event.target.value),
                          })}
                        />
                        <small>шт.</small>
                      </span>
                    </label>
                    <label className="manual-money-field manual-product-field">
                      <span>Изделие за шт.</span>
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
                    <button
                      aria-label={`Удалить позицию ${index + 1}`}
                      className="manual-item-delete"
                      disabled={draft.items.length <= 1}
                      title={draft.items.length <= 1 ? 'В КП должна остаться хотя бы одна позиция' : 'Удалить позицию'}
                      type="button"
                      onClick={() => deleteItem(item.id)}
                    >
                      <Trash2 size={17} />
                    </button>
                    <button
                      aria-expanded={isExpanded}
                      className="manual-details-toggle"
                      type="button"
                      onClick={() => toggleItemDetails(item.id)}
                    >
                      {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      <span>Состав позиции</span>
                      <small>{item.details.length}</small>
                    </button>
                    {isExpanded ? (
                      <div className="manual-detail-list">
                        {item.details.map((detail, detailIndex) => (
                          <div className="manual-detail-row" key={detail.id}>
                            <input
                              aria-label={`Параметр ${detailIndex + 1} позиции ${index + 1}`}
                              placeholder="Параметр"
                              value={detail.label}
                              onChange={(event) => updateDetail(item.id, detail.id, { label: event.target.value })}
                            />
                            <input
                              aria-label={`Значение ${detailIndex + 1} позиции ${index + 1}`}
                              placeholder="Значение"
                              value={detail.value}
                              onChange={(event) => updateDetail(item.id, detail.id, { value: event.target.value })}
                            />
                            <button
                              aria-label={`Удалить строку ${detailIndex + 1}`}
                              title="Удалить строку"
                              type="button"
                              onClick={() => deleteDetail(item.id, detail.id)}
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))}
                        <button className="manual-detail-add" type="button" onClick={() => addDetail(item.id)}>
                          <Plus size={16} />
                          Добавить строку
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </section>

          <section className="quote-editor-section quote-editor-delivery">
            <DeliveryControl
              delivery={draft.orderDelivery}
              kmRate={catalog.services.deliveryKmRate}
              price={draft.deliveryPrice}
              onChange={updateDelivery}
            />
          </section>

          <section className="quote-editor-section quote-editor-pricing">
            <div className="quote-price-control">
              <ToggleRow
                checked={draft.discountEnabled}
                label="Скидка"
                value={draft.discountEnabled ? `${discountPercent}%` : 'Нет'}
                onChange={(discountEnabled) => setDraft((current) => ({ ...current, discountEnabled }))}
              />
              {draft.discountEnabled ? (
                <label className="manual-money-field discount-field">
                  <span>Размер</span>
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
            </div>
            <div className="quote-price-control">
              <ToggleRow
                checked={draft.manualTotalEnabled}
                label="Ручная цена"
                value={draft.manualTotalEnabled ? 'Вручную' : 'По расчету'}
                onChange={(manualTotalEnabled) => setDraft((current) => ({
                  ...current,
                  manualTotalEnabled,
                  manualTotal: manualTotalEnabled ? calculatedTotal : current.manualTotal,
                }))}
              />
              {draft.manualTotalEnabled ? (
                <label className="manual-money-field manual-total-field">
                  <span>Цена КП</span>
                  <span className="manual-money-input">
                    <input
                      inputMode="numeric"
                      min={0}
                      type="number"
                      value={draft.manualTotal}
                      onChange={(event) => setDraft((current) => ({ ...current, manualTotal: Number(event.target.value) }))}
                    />
                    <small>₽</small>
                  </span>
                </label>
              ) : null}
            </div>
            <div className={hasDiscount ? 'manual-total has-discount' : 'manual-total'}>
              <span>Итого по КП</span>
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
  onLogin: (username: string, password: string) => Promise<void>
  onLogout: () => void
  onMirrorCatalog: (catalog: MirrorPricingCatalog) => void
  onReset: () => void
  onRetry: () => void
  syncState: PriceSyncState
}

type PriceSectionId =
  | 'glass'
  | 'hardware'
  | 'hardwareClass'
  | 'constructions'
  | 'services'
  | 'showerSettings'
  | 'mirrorMaterials'
  | 'mirrorServices'
  | 'mirrorSettings'

type PriceServerSyncPanelProps = Pick<PricesScreenProps, 'onLogin' | 'onLogout' | 'onRetry' | 'syncState'>

function PriceServerSyncPanel({ onLogin, onLogout, onRetry, syncState }: PriceServerSyncPanelProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const busy = syncState.status === 'loading' || syncState.status === 'saving'
  const statusLabel = syncState.status === 'loading'
    ? 'Подключение к серверу'
    : syncState.status === 'saving'
      ? 'Сохраняю изменения'
      : syncState.status === 'synced'
        ? `Синхронизировано${syncState.updatedAt ? ` · ${formatDate(syncState.updatedAt)}` : ''}`
        : syncState.status === 'error'
          ? 'Ошибка синхронизации'
          : 'Вход через CRM'
  const SyncIcon = syncState.status === 'error' || !syncState.username ? CloudOff : Cloud

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      await onLogin(username, password)
      setPassword('')
    } catch {
      // Ошибка уже показана в статусе синхронизации.
    }
  }

  return (
    <section className={`section-block server-sync-panel is-${syncState.status}`}>
      <div className="server-sync-head">
        <span className="server-sync-icon" aria-hidden="true">
          {busy ? <LoaderCircle className="is-spinning" size={22} /> : <SyncIcon size={22} />}
        </span>
        <div>
          <h2>Сервер цен</h2>
          <span>{statusLabel}</span>
          {syncState.username ? <strong>{syncState.username}</strong> : null}
        </div>
        {syncState.username ? (
          <div className="server-sync-actions">
            {syncState.status === 'error' ? (
              <button aria-label="Повторить синхронизацию" title="Повторить" type="button" onClick={onRetry}>
                <RefreshCw size={17} />
              </button>
            ) : null}
            <button aria-label="Выйти из синхронизации" title="Выйти" type="button" onClick={onLogout}>
              <LogOut size={17} />
            </button>
          </div>
        ) : null}
      </div>

      {!syncState.username ? (
        <form className="server-login-form" onSubmit={(event) => void submit(event)}>
          <label>
            <span>Логин или email CRM</span>
            <input
              autoComplete="username"
              required
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </label>
          <label>
            <span>Пароль</span>
            <input
              autoComplete="current-password"
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button disabled={busy} type="submit">
            {busy ? <LoaderCircle className="is-spinning" size={17} /> : <LogIn size={17} />}
            Войти
          </button>
        </form>
      ) : null}
      {syncState.message ? <p className="server-sync-message" role="alert">{syncState.message}</p> : null}
    </section>
  )
}

function PricesScreen({ catalog, mirrorCatalog, onCatalog, onLogin, onLogout, onMirrorCatalog, onReset, onRetry, syncState }: PricesScreenProps) {
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
      <PriceServerSyncPanel onLogin={onLogin} onLogout={onLogout} onRetry={onRetry} syncState={syncState} />
      {syncState.username && syncState.ready ? (
        <>
      <section className="section-block admin-head">
        <div>
          <h2>Цены</h2>
          <span>Сохраняются на сервере и этом устройстве</span>
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
            <ServiceRow label="Стандартная доставка по городу" value={catalog.services.deliveryBase} onChange={(value) => updateService('deliveryBase', value)} />
            <ServiceRow label="Доплата за городом, ₽/км" value={catalog.services.deliveryKmRate} onChange={(value) => updateService('deliveryKmRate', value)} />
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

      <section className={openSection === 'showerSettings' ? 'section-block price-accordion is-open' : 'section-block price-accordion'}>
        <PriceAccordionHeader
          controlsId="price-shower-settings"
          isOpen={openSection === 'showerSettings'}
          meta="Наценки и комиссии"
          title="Настройки душевых"
          onToggle={() => toggleSection('showerSettings')}
        />
        {openSection === 'showerSettings' ? (
          <div className="price-list price-accordion-body" id="price-shower-settings">
            <ServiceRow label="Наценка на изделие, %" value={catalog.services.productMarkupPercent} onChange={(value) => updateService('productMarkupPercent', value)} />
            <ServiceRow label="Наценка на фурнитуру, %" value={catalog.services.hardwareMarkupPercent} onChange={(value) => updateService('hardwareMarkupPercent', value)} />
            <ServiceRow label="Дизайнер, %" value={catalog.services.designerPercent} onChange={(value) => updateService('designerPercent', value)} />
            <ServiceRow label="Скидка по умолчанию, %" value={catalog.services.discountPercent} onChange={(value) => updateService('discountPercent', value)} />
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
        </>
      ) : null}
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

const constructionThumbnailPositions: Record<string, string> = {
  '6663': '6.46% 21.88%',
  '6744': '35.96% 21.88%',
  '6747': '66.01% 21.88%',
  '6745': '95.79% 21.88%',
  '6746': '6.46% 58.68%',
  '6748': '35.96% 58.68%',
  '6749': '66.01% 58.68%',
  '6750': '95.79% 58.68%',
  '6751': '6.46% 95.49%',
  '6752': '35.96% 95.49%',
  '6753': '66.01% 95.49%',
  '6754': '95.79% 95.49%',
}

function ConstructionPreview({ construction }: { construction: Construction }) {
  const thumbnailPosition = constructionThumbnailPositions[construction.id]

  return (
    <span className="construction-preview">
      {thumbnailPosition ? (
        <span
          className="reference-shower-thumbnail"
          style={{ backgroundImage: `url(${showerThumbnailSprite})`, backgroundPosition: thumbnailPosition }}
        />
      ) : <ShowerSketch sketch={construction.sketch} />}
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
