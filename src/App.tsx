import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from 'react'
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
  ExternalLink,
  FileDown,
  GripVertical,
  Image,
  MoreHorizontal,
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
import { getConstructionThumbnailStyle } from './constructionThumbnails'
import './App.css'
import {
  buildMirrorCalculationBreakdown,
  buildOrderCalculationSection,
  buildShowerCalculationBreakdown,
  type AdminCalculationBreakdown,
} from './adminCalculation'
import {
  applyQuoteDelivery,
  calculateQuoteDelivery,
  calculateQuote,
  combineCalculationResults,
  createInitialForm,
  createQuote,
  getConstruction,
  getConstructionHardwareComponents,
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
  getQuoteVariants,
  getQuoteVariantTotals,
  isMirrorQuoteItem,
  money,
  multiplyCalculationResult,
  normalizeQuoteDelivery,
  normalizeQuoteCustomer,
  normalizeQuoteQuantity,
  resetDimensionsForConstruction,
  roundMoneyUp,
  shortMoney,
  updateQuoteManually,
  type CalculatorForm,
  type CalculationResult,
  type ManualQuotePatch,
  type Quote,
  type QuoteCustomer,
  type QuoteDelivery,
  type QuoteDraftItem,
  type QuoteVariant,
} from './calculator'
import {
  calculateMirrorQuote,
  cloneMirrorForm,
  createInitialMirrorForm,
  getMirrorCalculatedGroupTotal,
  getMirrorCalculatedOptions,
  getMirrorMaterial,
  getMirrorService,
  getMirrorTitle,
  type MirrorForm,
} from './mirrorCalculator'
import {
  mirrorServiceSections,
  mirrorUnitLabels,
  type MirrorMaterial,
  type MirrorPricingCatalog,
  type MirrorService,
  type MirrorServiceGroup,
} from './mirrorPricing'
import {
  createDefaultDimensions,
  defaultCatalog,
  type Construction,
  type ConstructionHardwareComponent,
  type PriceOption,
  type PricingCatalog,
  type ShowerHardwareItem,
} from './pricing'
import { showerHardwareSections, type ShowerHardwareSectionId } from './showerAv24Components'
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
  deleteServerQuote,
  loadServerCatalogs,
  loadServerSession,
  loginToServer,
  saveServerCatalogs,
  ServerSyncError,
  syncServerQuotes,
  type ServerSession,
} from './serverSync'
import { shareQuotePdf, type QuotePdfPreview } from './quotePdf'
import { ProductionWorkspace } from './ProductionWorkspace'
import mirrorVisualization from './assets/mirror-visualization.png'

type ProductKind = 'shower' | 'mirror'
type TabId = 'showers' | 'mirrors' | 'archive' | 'prices'
type PriceSyncStatus = 'signed-out' | 'loading' | 'saving' | 'synced' | 'error'
type QuoteSyncStatus = 'local' | 'loading' | 'synced' | 'error'

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

const formatDate = (date: string) =>
  new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))

const formatPositionCount = (count: number) => {
  const lastTwo = count % 100
  const last = count % 10
  const word = lastTwo >= 11 && lastTwo <= 14
    ? 'позиций'
    : last === 1
      ? 'позиция'
      : last >= 2 && last <= 4
        ? 'позиции'
        : 'позиций'
  return `${count} ${word}`
}

const countChangedValues = (current: unknown, saved: unknown): number => {
  if (Object.is(current, saved)) return 0
  if (Array.isArray(current) && Array.isArray(saved)) {
    const length = Math.max(current.length, saved.length)
    return Array.from({ length }, (_, index) => countChangedValues(current[index], saved[index]))
      .reduce((total, count) => total + count, 0)
  }
  if (current && saved && typeof current === 'object' && typeof saved === 'object') {
    const keys = new Set([...Object.keys(current), ...Object.keys(saved)])
    return [...keys].reduce((total, key) => total + countChangedValues(
      (current as Record<string, unknown>)[key],
      (saved as Record<string, unknown>)[key],
    ), 0)
  }
  return 1
}

const formatVariantCount = (count: number) => {
  const mod100 = count % 100
  const mod10 = count % 10
  const label = mod100 >= 11 && mod100 <= 14
    ? 'вариантов'
    : mod10 === 1
      ? 'вариант'
      : mod10 >= 2 && mod10 <= 4
        ? 'варианта'
        : 'вариантов'
  return `${count} ${label}`
}

const cloneForm = (form: CalculatorForm): CalculatorForm => ({
  ...form,
  dimensions: { ...form.dimensions },
  productionDesign: form.productionDesign ? {
    opening: form.productionDesign.opening ? {
      ...form.productionDesign.opening,
      segments: { ...form.productionDesign.opening.segments },
    } : undefined,
    doors: form.productionDesign.doors ? Object.fromEntries(Object.entries(form.productionDesign.doors).map(([id, value]) => [id, { ...value }])) : undefined,
    connectors: form.productionDesign.connectors ? Object.fromEntries(Object.entries(form.productionDesign.connectors).map(([id, value]) => [id, { ...value }])) : undefined,
    magnetic: form.productionDesign.magnetic ? Object.fromEntries(Object.entries(form.productionDesign.magnetic).map(([id, value]) => [id, { ...value }])) : undefined,
  } : undefined,
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

type EditingPriceSnapshot = {
  quoteNumber: string
  pricesByPositionId: Record<string, number>
}

type PriceComparison = {
  quoteNumber: string
  previousPrice: number
  currentPrice: number
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

const mergeQuoteArchives = (
  serverQuotes: Quote[],
  localQuotes: Quote[],
  excludedIds: ReadonlySet<string> = new Set(),
) => {
  const byId = new Map(serverQuotes.map((quote) => [quote.id, quote]))
  localQuotes.forEach((quote) => byId.set(quote.id, quote))
  return [...byId.values()]
    .filter((quote) => !excludedIds.has(quote.id))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

const remapQuoteVariants = (sourceQuote: Quote, nextItems: ReturnType<typeof getQuoteItems>) => {
  const sourceVariants = getQuoteVariants(sourceQuote)
  if (sourceVariants.length === 0) return undefined
  const sourceItems = getQuoteItems(sourceQuote)
  const nextItemIdBySourceId = new Map(
    sourceItems.flatMap((item, index) => nextItems[index] ? [[item.id, nextItems[index].id]] : []),
  )
  const mappedItemIds = new Set<string>()
  const variants: QuoteVariant[] = sourceVariants.map((variant) => {
    const itemIds = variant.itemIds.flatMap((itemId) => {
      const nextItemId = nextItemIdBySourceId.get(itemId)
      if (!nextItemId) return []
      mappedItemIds.add(nextItemId)
      return [nextItemId]
    })
    return { ...variant, itemIds }
  })
  const newItemIds = nextItems
    .map((item) => item.id)
    .filter((itemId) => !mappedItemIds.has(itemId))
  variants[0].itemIds.push(...newItemIds)
  return variants.filter((variant) => variant.itemIds.length > 0).length >= 2
    ? variants
    : undefined
}

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
  const [editingPriceSnapshot, setEditingPriceSnapshot] = useState<EditingPriceSnapshot | null>(null)
  const [pdfQuoteId, setPdfQuoteId] = useState('')
  const [pdfPreview, setPdfPreview] = useState<QuotePdfPreview | null>(null)
  const [productionWorkspace, setProductionWorkspace] = useState<{
    positionId: string
    form: CalculatorForm
    itemIndex: number
    quoteNumber: string
  } | null>(null)
  const [serverSession, setServerSession] = useState<ServerSession | null>(() => loadServerSession())
  const [syncStatus, setSyncStatus] = useState<PriceSyncStatus>(serverSession ? 'loading' : 'signed-out')
  const [syncMessage, setSyncMessage] = useState('')
  const [syncUpdatedAt, setSyncUpdatedAt] = useState('')
  const [serverSyncReady, setServerSyncReady] = useState(false)
  const [syncAttempt, setSyncAttempt] = useState(0)
  const [quoteSyncStatus, setQuoteSyncStatus] = useState<QuoteSyncStatus>(serverSession ? 'loading' : 'local')
  const [quoteSyncMessage, setQuoteSyncMessage] = useState('')
  const [pricesDirty, setPricesDirty] = useState(false)
  const catalogRef = useRef(catalog)
  const mirrorCatalogRef = useRef(mirrorCatalog)
  const quotesRef = useRef(quotes)
  const deletedQuoteIdsRef = useRef(new Set<string>())
  catalogRef.current = catalog
  mirrorCatalogRef.current = mirrorCatalog
  quotesRef.current = quotes
  const isAdmin = Boolean(serverSession) || import.meta.env.DEV

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
  const activePositionResult = positionResults.find((position) => position.id === activePosition.id)
  const activeUnitResult = activePositionResult?.unitResult
    ?? (activePosition.kind === 'mirror'
      ? calculateMirrorQuote(mirrorCatalog, activePosition.form)
      : calculateQuote(catalog, activePosition.form))
  const activeResult = activePositionResult?.result
    ?? multiplyCalculationResult(activeUnitResult, activePosition.quantity)
  const previousActivePrice = editingPriceSnapshot?.pricesByPositionId[activePosition.id]
  const activePriceComparison: PriceComparison | null = editingPriceSnapshot && previousActivePrice !== undefined
    ? {
        quoteNumber: editingPriceSnapshot.quoteNumber,
        previousPrice: previousActivePrice,
        currentPrice: getPublicProductPrice(activeUnitResult),
      }
    : null
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
  const adminCalculationBreakdown = useMemo<AdminCalculationBreakdown | null>(() => {
    if (!isAdmin) return null
    const positionBreakdown = activePosition.kind === 'mirror'
      ? buildMirrorCalculationBreakdown(mirrorCatalog, activePosition.form, activePosition.quantity, activeUnitResult)
      : buildShowerCalculationBreakdown(catalog, activePosition.form, activePosition.quantity, activeUnitResult)
    const orderSection = buildOrderCalculationSection(
      positionResults.map((position, index) => ({
        label: `Позиция ${index + 1}: ${position.kind === 'mirror'
          ? getMirrorTitle(position.form)
          : getConstruction(catalog, position.form.constructionId).shortTitle}`,
        total: position.result.total,
      })),
      orderDelivery,
      catalog,
      orderDeliveryPrice,
      orderResult.total,
    )
    return {
      ...positionBreakdown,
      sections: [...positionBreakdown.sections, orderSection],
    }
  }, [
    activePosition,
    activeUnitResult,
    catalog,
    isAdmin,
    mirrorCatalog,
    orderDelivery,
    orderDeliveryPrice,
    orderResult.total,
    positionResults,
  ])
  useEffect(() => saveCatalog(catalog), [catalog])
  useEffect(() => saveMirrorCatalog(mirrorCatalog), [mirrorCatalog])
  useEffect(() => saveQuotes(quotes), [quotes])
  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 4_000)
    return () => window.clearTimeout(timer)
  }, [notice])
  useEffect(() => {
    let cancelled = false
    if (!serverSession) {
      setQuoteSyncStatus('local')
      setQuoteSyncMessage('')
      return undefined
    }

    const hydrateQuoteArchive = async () => {
      setQuoteSyncStatus('loading')
      setQuoteSyncMessage('')
      try {
        const remote = await syncServerQuotes(quotesRef.current)
        if (cancelled) return
        setQuotes(mergeQuoteArchives(remote.quotes, quotesRef.current, deletedQuoteIdsRef.current))
        setQuoteSyncStatus('synced')
      } catch (error) {
        if (cancelled) return
        setQuoteSyncStatus('error')
        setQuoteSyncMessage(error instanceof Error ? error.message : 'Не удалось синхронизировать архив КП')
      }
    }

    void hydrateQuoteArchive()
    return () => {
      cancelled = true
    }
  }, [serverSession])
  useEffect(() => {
    let cancelled = false
    if (activeTab !== 'archive' || !serverSession) return undefined

    setQuoteSyncStatus('loading')
    setQuoteSyncMessage('')
    void syncServerQuotes(quotesRef.current)
      .then((remote) => {
        if (cancelled) return
        setQuotes(mergeQuoteArchives(remote.quotes, quotesRef.current, deletedQuoteIdsRef.current))
        setQuoteSyncStatus('synced')
      })
      .catch((error) => {
        if (cancelled) return
        if (error instanceof ServerSyncError && error.code === 'auth') {
          clearServerSession()
          setServerSession(null)
        }
        setQuoteSyncStatus('error')
        setQuoteSyncMessage(error instanceof Error ? error.message : 'Не удалось обновить архив КП')
      })

    return () => {
      cancelled = true
    }
  }, [activeTab, serverSession])
  useEffect(() => {
    if (!serverSession) return undefined

    let cancelled = false
    let running = false
    let timer: number | undefined

    const synchronizeArchive = () => {
      if (cancelled || running || !navigator.onLine) return
      running = true
      setQuoteSyncStatus('loading')
      setQuoteSyncMessage('')
      void syncServerQuotes(quotesRef.current)
        .then((remote) => {
          if (cancelled) return
          setQuotes(mergeQuoteArchives(remote.quotes, quotesRef.current, deletedQuoteIdsRef.current))
          setQuoteSyncStatus('synced')
        })
        .catch((error) => {
          if (cancelled) return
          if (error instanceof ServerSyncError && error.code === 'auth') {
            clearServerSession()
            setServerSession(null)
          }
          setQuoteSyncStatus('error')
          setQuoteSyncMessage(error instanceof Error ? error.message : 'Не удалось синхронизировать архив КП')
        })
        .finally(() => {
          running = false
        })
    }

    const scheduleSynchronization = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(synchronizeArchive, 250)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleSynchronization()
    }

    window.addEventListener('online', scheduleSynchronization)
    window.addEventListener('focus', scheduleSynchronization)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') synchronizeArchive()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearInterval(interval)
      window.removeEventListener('online', scheduleSynchronization)
      window.removeEventListener('focus', scheduleSynchronization)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [serverSession])
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
        const mirrorCatalogNeedsMigration = !hasRemoteMirror
          || Math.max(0, Number(remoteMirror.revision) || 0) < nextMirrorCatalog.revision
        const showerCatalogNeedsMigration = !hasRemoteShower
          || Math.max(0, Number(remoteShower.revision) || 0) < nextCatalog.revision

        setCatalog(nextCatalog)
        setMirrorCatalog(nextMirrorCatalog)

        const saved = showerCatalogNeedsMigration || mirrorCatalogNeedsMigration
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
    if (!serverSession || !serverSyncReady || pricesDirty) return undefined

    let cancelled = false
    let running = false
    let timer: number | undefined

    const refreshCatalogs = () => {
      if (cancelled || running || !navigator.onLine) return
      running = true
      void loadServerCatalogs()
        .then((remote) => {
          if (cancelled) return
          const remoteShower = remote.shower_catalog as Partial<PricingCatalog>
          const remoteMirror = remote.mirror_catalog as Partial<MirrorPricingCatalog>
          const nextCatalog = Array.isArray(remoteShower.constructions) && remoteShower.constructions.length > 0
            ? mergeCatalog(remote.shower_catalog as PricingCatalog)
            : catalogRef.current
          const nextMirrorCatalog = Array.isArray(remoteMirror.materials) && remoteMirror.materials.length > 0
            ? mergeMirrorCatalog(remote.mirror_catalog as MirrorPricingCatalog)
            : mirrorCatalogRef.current
          if (JSON.stringify(nextCatalog) !== JSON.stringify(catalogRef.current)) setCatalog(nextCatalog)
          if (JSON.stringify(nextMirrorCatalog) !== JSON.stringify(mirrorCatalogRef.current)) {
            setMirrorCatalog(nextMirrorCatalog)
          }
          setSyncUpdatedAt(remote.updated_at || new Date().toISOString())
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
          setSyncMessage(error instanceof Error ? error.message : 'Не удалось обновить цены')
        })
        .finally(() => {
          running = false
        })
    }

    const scheduleRefresh = () => {
      window.clearTimeout(timer)
      timer = window.setTimeout(refreshCatalogs, 250)
    }
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') scheduleRefresh()
    }

    window.addEventListener('online', scheduleRefresh)
    window.addEventListener('focus', scheduleRefresh)
    document.addEventListener('visibilitychange', handleVisibility)
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') refreshCatalogs()
    }, 60_000)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      window.clearInterval(interval)
      window.removeEventListener('online', scheduleRefresh)
      window.removeEventListener('focus', scheduleRefresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [pricesDirty, serverSession, serverSyncReady])
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
        const selectedGroups = position.form.groups ?? []
        const validGroups = selectedGroups.filter((selection) => (
          mirrorCatalog.groups.some((group) => group.id === selection.groupId)
        ))
        if (
          materialExists
          && validOptions.length === position.form.options.length
          && validGroups.length === selectedGroups.length
        ) return position
        changed = true
        return {
          ...position,
          form: {
            ...position.form,
            materialId: materialExists ? position.form.materialId : mirrorCatalog.materials[0].id,
            options: validOptions,
            groups: validGroups,
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
            productionDesign: undefined,
            productionPriceAdjustment: undefined,
          },
        }
      : position))
  }

  const syncQuoteChanges = (changedQuotes: Quote[]) => {
    if (!serverSession) {
      setQuoteSyncStatus('local')
      return
    }
    setQuoteSyncStatus('loading')
    setQuoteSyncMessage('')
    void syncServerQuotes(changedQuotes)
      .then(() => setQuoteSyncStatus('synced'))
      .catch((error) => {
        if (error instanceof ServerSyncError && error.code === 'auth') {
          clearServerSession()
          setServerSession(null)
        }
        setQuoteSyncStatus('error')
        setQuoteSyncMessage(error instanceof Error ? error.message : 'Не удалось сохранить КП на сервере')
      })
  }

  const createQuoteFromPositions = () => {
    const drafts: QuoteDraftItem[] = positionResults.map((position) => position.kind === 'mirror'
      ? { kind: 'mirror', quantity: position.quantity, form: cloneMirrorForm(position.form), result: position.unitResult }
      : { kind: 'shower', quantity: position.quantity, form: cloneForm(position.form), result: position.unitResult })
    const editingQuote = quotes.find((item) => item.id === editingQuoteId)
    const quoteNumber = editingQuote?.number ?? getNextQuoteNumber(quotes)
    const quote = createQuote(catalog, mirrorCatalog, drafts, orderDelivery, orderCustomer, quoteNumber)
    if (!editingQuote) return quote
    const variants = remapQuoteVariants(editingQuote, getQuoteItems(quote))
    return {
      ...quote,
      id: editingQuote.id,
      createdAt: editingQuote.createdAt,
      status: editingQuote.status,
      variants,
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

  const resetCalculatorDraft = (kind: ProductKind) => {
    const nextPosition = kind === 'mirror'
      ? createMirrorDraftPosition(mirrorCatalog)
      : createDraftPosition(catalog)
    setPositions([nextPosition])
    setActivePositionId(nextPosition.id)
    setOrderDelivery(normalizeQuoteDelivery(null))
    setOrderCustomer(normalizeQuoteCustomer(null))
    setEditingQuoteId('')
    setEditingPriceSnapshot(null)
    setActiveTab(kind === 'mirror' ? 'mirrors' : 'showers')
  }

  const saveCurrentQuote = () => {
    if (focusFirstInvalidPosition()) return
    const quote = createQuoteFromPositions()
    const nextKind = activePosition.kind
    setQuotes((current) => editingQuoteId
      ? current.map((item) => item.id === editingQuoteId ? quote : item)
      : [quote, ...current])
    syncQuoteChanges([quote])
    setNotice(`${quote.number} ${editingQuoteId ? 'обновлено' : 'сохранено'}`)
    resetCalculatorDraft(nextKind)
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
    const nextKind = activePosition.kind
    setQuotes((current) => editingQuoteId
      ? current.map((item) => item.id === editingQuoteId ? quote : item)
      : [quote, ...current])
    syncQuoteChanges([quote])
    resetCalculatorDraft(nextKind)
    void downloadQuotePdf(quote)
  }

  const openProductionWorkspace = () => {
    if (activePosition.kind !== 'shower') return
    if (focusFirstInvalidPosition()) return
    const editingQuote = quotes.find((quote) => quote.id === editingQuoteId)
    setProductionWorkspace({
      positionId: activePosition.id,
      form: cloneForm(activePosition.form),
      itemIndex: Math.max(0, positions.findIndex((position) => position.id === activePosition.id)),
      quoteNumber: editingQuote?.number ?? getNextQuoteNumber(quotes),
    })
  }

  const updateProductionWorkspaceForm = (nextForm: CalculatorForm) => {
    const positionId = productionWorkspace?.positionId
    if (!positionId) return
    setProductionWorkspace((current) => current ? { ...current, form: cloneForm(nextForm) } : null)
    setPositions((current) => current.map((position) => position.id === positionId && position.kind === 'shower'
      ? { ...position, form: cloneForm(nextForm) }
      : position))
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
    const pricesByPositionId: Record<string, number> = {}
    const nextPositions: DraftPosition[] = items.map((item) => {
      const positionId = crypto.randomUUID()
      pricesByPositionId[positionId] = getPublicProductPrice(item.result)
      if (isMirrorQuoteItem(item)) {
        const form = cloneMirrorForm(item.form)
        form.options = form.options.filter((option) => getMirrorService(mirrorCatalog, option.serviceId).category !== 'delivery')
        form.clientName = ''
        form.clientPhone = ''
        form.note = ''
        return { id: positionId, kind: 'mirror', quantity: getQuoteItemQuantity(item), form }
      }
      const form = cloneForm(item.form)
      form.delivery = false
      form.deliveryZone = 'inside'
      form.deliveryKm = 0
      form.clientName = ''
      form.clientPhone = ''
      form.note = ''
      return { id: positionId, kind: 'shower', quantity: getQuoteItemQuantity(item), form }
    })
    const selectedIndex = itemId ? Math.max(0, items.findIndex((item) => item.id === itemId)) : 0
    const selected = nextPositions[selectedIndex]
    setPositions(nextPositions)
    setOrderDelivery(getQuoteDelivery(quote))
    setOrderCustomer(getQuoteCustomer(quote))
    setEditingQuoteId(quote.id)
    setEditingPriceSnapshot({ quoteNumber: quote.number, pricesByPositionId })
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

  const navigateToTab = (tab: TabId) => {
    if (activeTab === 'prices' && pricesDirty && !window.confirm('В ценах есть несохранённые изменения. Уйти без сохранения?')) return
    if (tab === 'showers') openProductTab('shower')
    else if (tab === 'mirrors') openProductTab('mirror')
    else setActiveTab(tab)
  }

  const deleteQuote = (id: string) => {
    deletedQuoteIdsRef.current.add(id)
    setQuotes((current) => current.filter((quote) => quote.id !== id))
    if (!serverSession) return
    setQuoteSyncStatus('loading')
    setQuoteSyncMessage('')
    void deleteServerQuote(id)
      .then(() => setQuoteSyncStatus('synced'))
      .catch((error) => {
        setQuoteSyncStatus('error')
        setQuoteSyncMessage(error instanceof Error ? error.message : 'Не удалось удалить КП с сервера')
      })
  }

  const saveManualQuote = (id: string, patch: ManualQuotePatch) => {
    const quote = quotes.find((item) => item.id === id)
    if (!quote) return
    const updatedQuote = updateQuoteManually(quote, patch)
    setQuotes((current) => current.map((item) => item.id === id ? updatedQuote : item))
    syncQuoteChanges([updatedQuote])
    setNotice(`${quote.number} обновлено вручную`)
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
            return (
              <button
                className={activeTab === tab.id ? 'tab-button is-active' : 'tab-button'}
                key={tab.id}
                type="button"
                onClick={() => navigateToTab(tab.id)}
              >
                <Icon size={18} />
                <span>{tab.label}</span>
              </button>
            )
          })}
          <details className="mobile-more">
            <summary aria-label="Другие разделы" title="Другие разделы"><MoreHorizontal size={21} /></summary>
            <div>
              <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); navigateToTab('archive') }}><Archive size={17} /> Архив</button>
              <button type="button" onClick={(event) => { event.currentTarget.closest('details')?.removeAttribute('open'); navigateToTab('prices') }}><Settings2 size={17} /> Цены</button>
            </div>
          </details>
        </nav>
      </header>

      <main className="app-main">
        {notice ? (
          <button className="notice" type="button" onClick={() => setNotice('')}>
            <Check size={16} />
            {notice}
          </button>
        ) : null}

        {activeTab === 'showers' || activeTab === 'mirrors' ? (
          <PositionSwitcher
            activeId={activePositionId}
            activeQuantity={activePosition.quantity}
            customer={orderCustomer}
            delivery={orderDelivery}
            deliveryKmRate={catalog.services.deliveryKmRate}
            deliveryPrice={orderDeliveryPrice}
            positions={positionSummaries}
            quoteNumber={quotes.find((quote) => quote.id === editingQuoteId)?.number}
            onAdd={() => addPosition(activePosition.kind)}
            onAddProduct={addPosition}
            onCustomer={updateOrderCustomer}
            onDelete={deletePosition}
            onDelivery={updateOrderDelivery}
            onDuplicate={duplicatePosition}
            onNew={() => resetCalculatorDraft(activePosition.kind)}
            onQuantity={updatePositionQuantity}
            onSelect={selectPosition}
          />
        ) : null}

        {activeTab === 'showers' && activePosition.kind === 'shower' ? (
          <CalculatorScreen
            adminBreakdown={adminCalculationBreakdown}
            catalog={catalog}
            customer={orderCustomer}
            delivery={orderDelivery}
            deliveryKmRate={catalog.services.deliveryKmRate}
            deliveryPrice={orderDeliveryPrice}
            form={activePosition.form}
            quantity={activePosition.quantity}
            result={activeResult}
            orderResult={orderResult}
            priceComparison={activePriceComparison}
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
            onProduction={isAdmin ? openProductionWorkspace : undefined}
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
            adminBreakdown={adminCalculationBreakdown}
            catalog={mirrorCatalog}
            customer={orderCustomer}
            delivery={orderDelivery}
            deliveryKmRate={catalog.services.deliveryKmRate}
            deliveryPrice={orderDeliveryPrice}
            form={activePosition.form}
            isPdfBusy={pdfQuoteId !== ''}
            orderResult={orderResult}
            priceComparison={activePriceComparison}
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
          <ArchiveWorkspace
            catalog={catalog}
            quotes={quotes}
            pdfQuoteId={pdfQuoteId}
            syncMessage={quoteSyncMessage}
            syncStatus={quoteSyncStatus}
            onDelete={deleteQuote}
            onLoad={loadQuoteToCalculator}
            onManualSave={saveManualQuote}
            onNew={() => resetCalculatorDraft('shower')}
            onPdf={(quote) => void downloadQuotePdf(quote)}
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
            onDirtyChange={setPricesDirty}
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

      {productionWorkspace ? (
        <ProductionWorkspace
          catalog={catalog}
          form={productionWorkspace.form}
          itemIndex={productionWorkspace.itemIndex}
          quoteNumber={productionWorkspace.quoteNumber}
          onClose={() => setProductionWorkspace(null)}
          onFormChange={updateProductionWorkspaceForm}
          onPreview={setPdfPreview}
        />
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
            <span>{preview.documentLabel}</span>
            <h2 id="pdf-preview-title">{preview.title}</h2>
          </div>
          <button aria-label="Закрыть просмотр PDF" title="Закрыть" type="button" onClick={onClose}>
            <X size={20} />
          </button>
        </header>
        <div className="pdf-preview-ready">
          <FileDown size={52} aria-hidden="true" />
          <h3>{preview.documentLabel}: PDF сформирован</h3>
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
          {preview.attachments?.map((attachment) => (
            <a download={attachment.fileName} href={attachment.url} key={attachment.fileName}>
              <FileDown size={18} />
              {attachment.label}
            </a>
          ))}
          <button type="button" onClick={onClose}>Закрыть</button>
        </footer>
      </section>
    </div>
  )
}

type CalculatorScreenProps = {
  adminBreakdown: AdminCalculationBreakdown | null
  catalog: PricingCatalog
  customer: QuoteCustomer
  delivery: QuoteDelivery
  deliveryKmRate: number
  deliveryPrice: number
  form: CalculatorForm
  quantity: number
  result: CalculationResult
  orderResult: CalculationResult
  priceComparison: PriceComparison | null
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
  onProduction?: () => void
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

type StepNavigationProps = {
  activeIndex: number
  count: number
  onChange: (index: number) => void
}

function StepNavigation({ activeIndex, count, onChange }: StepNavigationProps) {
  return (
    <footer className="step-navigation">
      <button disabled={activeIndex === 0} type="button" onClick={() => onChange(activeIndex - 1)}>
        <ChevronRight className="step-back-icon" size={18} />
        Назад
      </button>
      <span>Шаг {activeIndex + 1} из {count}</span>
      <button className="is-primary" disabled={activeIndex === count - 1} type="button" onClick={() => onChange(activeIndex + 1)}>
        Далее
        <ChevronRight size={18} />
      </button>
    </footer>
  )
}

function CalculatorScreen({
  adminBreakdown,
  catalog,
  form,
  result,
  orderResult,
  priceComparison,
  positionSummaries,
  recentQuotes,
  activePositionId,
  isPdfBusy,
  onDimension,
  onForm,
  onPdf,
  onProduction,
  onSave,
  onOpenArchive,
  onOpenQuote,
  onSelectConstruction,
}: CalculatorScreenProps) {
  const construction = getConstruction(catalog, form.constructionId)
  const glass = getOption(catalog.glass, form.glassId)
  const hardware = getOption(catalog.hardware, form.hardwareId)
  const hardwareClass = getOption(catalog.hardwareClass, form.hardwareClassId)
  const glassThickness = glass.thickness ?? 8
  const hardwareComponents = getConstructionHardwareComponents(catalog, construction, glassThickness)
  const [activeSection, setActiveSection] = useState<ConfigSectionId>('construction')

  return (
    <div className="screen-stack calculator-screen">
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
              </span>
              <input
                inputMode="numeric"
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
        <div className="glass-thickness-switch" aria-label="Толщина стекла">
          {([8, 6] as const).map((thickness) => (
            <button
              aria-pressed={glassThickness === thickness}
              className={glassThickness === thickness ? 'is-active' : ''}
              key={thickness}
              type="button"
              onClick={() => {
                const option = catalog.glass.find((item) => (item.thickness ?? 8) === thickness)
                if (option) onForm({ glassId: option.id })
              }}
            >
              {thickness} мм
            </button>
          ))}
        </div>
        <OptionGrid
          activeId={form.glassId}
          items={catalog.glass.filter((item) => (item.thickness ?? 8) === glassThickness)}
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
            label="Класс фурнитуры"
            value={form.hardwareClassId}
            items={catalog.hardwareClass}
            onChange={(hardwareClassId) => onForm({ hardwareClassId })}
          />
          {hardwareComponents.length > 0 ? (
            <div className="construction-composition-summary">
              <span>Состав конструкции</span>
              <strong>{hardwareComponents.length} позиций</strong>
            </div>
          ) : null}
        </div>
      </section>
      ) : null}

      {activeSection === 'services' ? (
      <section className="section-block">
        <div className="section-title">
          <h2>Услуги</h2>
          <span>{hardwareClass.label} · {hardware.label} · {hardwareComponents.length} позиций</span>
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

          <StepNavigation
            activeIndex={configSections.findIndex((section) => section.id === activeSection)}
            count={configSections.length}
            onChange={(index) => setActiveSection(configSections[index].id)}
          />

        </div>
      </section>

      <ProductVisualization
        construction={construction}
        form={form}
        glass={glass}
        hardware={hardware}
        hardwareClass={hardwareClass}
      />

      <div className="summary-column">
        <SummaryDock
          adminBreakdown={adminBreakdown}
          result={result}
          orderResult={orderResult}
          priceComparison={priceComparison}
          positionCount={positionSummaries.length}
          positionIndex={positionSummaries.findIndex((position) => position.id === activePositionId)}
          positions={positionSummaries}
          hasErrors={positionSummaries.some((position) => position.hasErrors)}
          isPdfBusy={isPdfBusy}
          onPdf={onPdf}
          onProduction={onProduction}
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
  adminBreakdown: AdminCalculationBreakdown | null
  catalog: MirrorPricingCatalog
  customer: QuoteCustomer
  delivery: QuoteDelivery
  deliveryKmRate: number
  deliveryPrice: number
  form: MirrorForm
  quantity: number
  result: CalculationResult
  orderResult: CalculationResult
  priceComparison: PriceComparison | null
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
  adminBreakdown,
  catalog,
  form,
  result,
  orderResult,
  priceComparison,
  positionSummaries,
  activePositionId,
  isPdfBusy,
  onForm,
  onPdf,
  onSave,
}: MirrorCalculatorScreenProps) {
  const [activeSection, setActiveSection] = useState<MirrorSectionId>('dimensions')
  const material = getMirrorMaterial(catalog, form.materialId)
  const calculatedOptions = getMirrorCalculatedOptions(catalog, form)
  const selectedServices = new Set(form.options.map((option) => option.serviceId))
  const selectedGroups = form.groups ?? []
  const availableServices = catalog.services.filter((item) => item.category !== 'delivery')
  const serviceSections = useMemo(() => mirrorServiceSections
    .map((section) => ({
      ...section,
      items: catalog.services.filter((item) => item.category !== 'delivery' && item.sectionId === section.id),
    }))
    .filter((section) => section.items.length > 0), [catalog.services])

  const addOption = (serviceId?: string) => {
    const service = availableServices.find((item) => item.id === serviceId)
      ?? availableServices.find((item) => !selectedServices.has(item.id))
      ?? availableServices[0]
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

  const toggleGroup = (groupId: string) => {
    const selected = selectedGroups.find((selection) => selection.groupId === groupId)
    onForm({
      groups: selected
        ? selectedGroups.filter((selection) => selection.id !== selected.id)
        : [...selectedGroups, { id: crypto.randomUUID(), groupId }],
    })
  }

  return (
    <div className="screen-stack calculator-screen mirror-calculator-screen">
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
                <h2>Работы и комплекты</h2>
                <span>{selectedGroups.length + form.options.length} выбрано</span>
              </div>
              {catalog.groups.length > 0 ? (
                <div className="mirror-group-options" aria-label="Группы работ">
                  {catalog.groups.map((group) => {
                    const selection = selectedGroups.find((item) => item.groupId === group.id)
                    return (
                      <button
                        aria-pressed={Boolean(selection)}
                        className={selection ? 'is-selected' : ''}
                        key={group.id}
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                      >
                        <span>
                          <strong>{group.label}</strong>
                          <small>{group.items.length} позиций в составе</small>
                        </span>
                        <b>{selection ? money(getMirrorCalculatedGroupTotal(catalog, form, selection.id)) : 'Добавить'}</b>
                      </button>
                    )
                  })}
                </div>
              ) : null}
              <div className="mirror-service-catalog" aria-label="Каталог работ и комплектующих">
                {serviceSections.map((section) => (
                  <details className="mirror-service-section" key={section.id}>
                    <summary>
                      <span>
                        <strong>{section.label}</strong>
                        <small>{formatPositionCount(section.items.length)}</small>
                      </span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </summary>
                    <div className="mirror-service-picker-list">
                      {section.items.map((item) => {
                        const selected = selectedServices.has(item.id)
                        return (
                          <button
                            aria-pressed={selected}
                            className={selected ? 'is-selected' : ''}
                            disabled={selected}
                            key={item.id}
                            type="button"
                            onClick={() => addOption(item.id)}
                          >
                            <span>
                              <strong>{item.label}</strong>
                              {item.sku ? <small>VDSF · арт. {item.sku}</small> : null}
                            </span>
                            <b>{money(item.price)}/{mirrorUnitLabels[item.unit]}</b>
                          </button>
                        )
                      })}
                    </div>
                  </details>
                ))}
              </div>
              <div className="mirror-options-subhead">
                <strong>Выбранные работы и комплектующие</strong>
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
                          {serviceSections.map((section) => (
                            <optgroup key={section.id} label={section.label}>
                              {section.items.map((item) => (
                                <option key={item.id} value={item.id}>{item.label}</option>
                              ))}
                            </optgroup>
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
                  <div className="mirror-options-empty">
                    <ListPlus size={22} />
                    <span>Выберите позицию в одном из разделов выше</span>
                  </div>
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

          <StepNavigation
            activeIndex={mirrorSections.findIndex((section) => section.id === activeSection)}
            count={mirrorSections.length}
            onChange={(index) => setActiveSection(mirrorSections[index].id)}
          />

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
          adminBreakdown={adminBreakdown}
          result={result}
          orderResult={orderResult}
          priceComparison={priceComparison}
          positionCount={positionSummaries.length}
          positionIndex={positionSummaries.findIndex((position) => position.id === activePositionId)}
          positions={positionSummaries}
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
  hardwareClass: PriceOption
}

function ProductVisualization({ construction, form, glass, hardware, hardwareClass }: ProductVisualizationProps) {
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
          <span>{glass.label} · {hardwareClass.label} · {hardware.label}</span>
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
  quoteNumber?: string
  onAdd: () => void
  onAddProduct?: (kind: ProductKind) => void
  onCustomer: (patch: Partial<QuoteCustomer>) => void
  onDelete: (id: string) => void
  onDelivery: (patch: Partial<QuoteDelivery>) => void
  onDuplicate: () => void
  onNew?: () => void
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
  quoteNumber,
  onAdd,
  onAddProduct,
  onCustomer,
  onDelete,
  onDelivery,
  onDuplicate,
  onNew,
  onQuantity,
  onSelect,
}: PositionSwitcherProps) {
  const [addOpen, setAddOpen] = useState(false)
  return (
    <section className="section-block position-section">
      <div className="section-title position-title">
        <div className="quote-workspace-title">
          <span>{quoteNumber ? `Редактирование ${quoteNumber}` : 'Текущее предложение'}</span>
          <h2>{quoteNumber || 'Новое КП'}</h2>
        </div>
        <div className="position-tools">
          {onNew ? (
            <button className="new-quote-button" title="Начать новое КП" type="button" onClick={onNew}>
              <RotateCcw size={16} />
              <span>Новое КП</span>
            </button>
          ) : null}
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
          <div className="add-position-menu">
            <button className="add-position" type="button" onClick={() => onAddProduct ? setAddOpen((current) => !current) : onAdd()}>
              <Plus size={17} /> Добавить
            </button>
            {addOpen && onAddProduct ? (
              <div className="add-position-popover">
                <button type="button" onClick={() => { onAddProduct('shower'); setAddOpen(false) }}><Calculator size={17} /> Душевая</button>
                <button type="button" onClick={() => { onAddProduct('mirror'); setAddOpen(false) }}><ScanLine size={17} /> Зеркало</button>
              </div>
            ) : null}
          </div>
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
        <span>{customer.clientName || 'Добавить клиента'}</span>
        <small>{customer.clientPhone || 'Общий для всех позиций'}</small>
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
  label?: string
  price: number
  onChange: (patch: Partial<QuoteDelivery>) => void
}

function DeliveryControl({ delivery, kmRate, label = 'Доставка по КП', price, onChange }: DeliveryControlProps) {
  return (
    <div className="order-delivery-control">
      <div className="order-delivery-title">
        <Truck size={18} aria-hidden="true" />
        <span>{label}</span>
        <strong>{money(price)}</strong>
      </div>
      <div className="order-delivery-body">
        <div className="segmented order-delivery-modes" role="group" aria-label="Тип доставки">
          <button className={!delivery.enabled ? 'is-active' : ''} type="button" onClick={() => onChange({ enabled: false })}>Без доставки</button>
          <button className={delivery.enabled && delivery.zone === 'inside' ? 'is-active' : ''} type="button" onClick={() => onChange({ enabled: true, zone: 'inside', km: 0 })}>По городу</button>
          <button className={delivery.enabled && delivery.zone === 'outside' ? 'is-active' : ''} type="button" onClick={() => onChange({ enabled: true, zone: 'outside' })}>За городом</button>
        </div>
        {delivery.enabled && delivery.zone === 'outside' ? (
          <label className="order-delivery-distance">
            <span>Км за городом</span>
            <input inputMode="numeric" min={0} type="number" value={delivery.km} onChange={(event) => onChange({ km: Number(event.target.value) })} />
            <small>{shortMoney(kmRate)} ₽/км</small>
          </label>
        ) : null}
      </div>
    </div>
  )
}

type OptionGridProps = {
  activeId: string
  items: PriceOption[]
  priceSuffix?: string
  onSelect: (id: string) => void
}

const getOptionSwatch = (id: string) => {
  if (id.includes('matte')) return 'matte'
  if (id.includes('bronze') || id.includes('grey') || id === 'tinted') return 'tinted'
  if (
    id.includes('cristall')
    || id.includes('larta')
    || id.includes('salavat')
    || id.includes('moru')
    || id.includes('rainbow')
    || id.includes('stopsol-clear')
    || id === 'optiwhite'
  ) return 'optiwhite'
  return 'clear'
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
          <i className={`glass-swatch swatch-${getOptionSwatch(item.id)}`} aria-hidden="true" />
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
  disabled?: boolean
  label: string
  value: string
  onChange: (checked: boolean) => void
}

function ToggleRow({ checked, disabled = false, label, value, onChange }: ToggleRowProps) {
  return (
    <label className={disabled ? 'toggle-row is-disabled' : 'toggle-row'}>
      <span>
        {label}
        <small>{value}</small>
      </span>
      <input
        checked={checked}
        disabled={disabled}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  )
}

type SummaryDockProps = {
  adminBreakdown: AdminCalculationBreakdown | null
  result: CalculationResult
  orderResult: CalculationResult
  priceComparison: PriceComparison | null
  positionCount: number
  positionIndex: number
  positions: PositionSummary[]
  hasErrors: boolean
  isPdfBusy: boolean
  onPdf: () => void
  onProduction?: () => void
  onSave: () => void
}

type PriceComparisonPanelProps = {
  comparison: PriceComparison
}

function PriceComparisonPanel({ comparison }: PriceComparisonPanelProps) {
  const difference = comparison.currentPrice - comparison.previousPrice
  const direction = difference > 0 ? 'increase' : difference < 0 ? 'decrease' : 'same'
  const percent = comparison.previousPrice > 0
    ? Math.abs(difference / comparison.previousPrice * 100)
    : null
  const percentLabel = percent === null || difference === 0
    ? ''
    : `${difference > 0 ? '+' : difference < 0 ? '−' : ''}${percent.toLocaleString('ru-RU', {
        maximumFractionDigits: 1,
      })}%`
  const differenceLabel = difference === 0
    ? 'Без изменений'
    : `${difference > 0 ? '+' : '−'}${money(Math.abs(difference))}`

  return (
    <section
      aria-label={`Служебное сравнение цены с КП ${comparison.quoteNumber}`}
      className={`price-comparison is-${direction}`}
    >
      <header>
        <span><RefreshCw size={15} aria-hidden="true" /> Пересчет КП {comparison.quoteNumber}</span>
        <strong>Цена изделия за 1 шт.</strong>
      </header>
      <div className="price-comparison-values">
        <div>
          <span>Было</span>
          <strong>{money(comparison.previousPrice)}</strong>
        </div>
        <div>
          <span>Стало</span>
          <strong>{money(comparison.currentPrice)}</strong>
        </div>
      </div>
      <footer>
        <span>Изменение</span>
        <strong>
          {differenceLabel}
          {percentLabel ? <small>{percentLabel}</small> : null}
        </strong>
      </footer>
    </section>
  )
}

type AdminCalculationDetailsProps = {
  breakdown: AdminCalculationBreakdown
}

function AdminCalculationDetails({ breakdown }: AdminCalculationDetailsProps) {
  return (
    <details className="admin-calculation-details">
      <summary>
        <span className="admin-calculation-title">
          <Calculator size={16} aria-hidden="true" />
          <span>
            Расшифровка расчёта
            <small>Только администратор · {breakdown.title}</small>
          </span>
        </span>
        <ChevronDown className="admin-calculation-chevron" size={17} aria-hidden="true" />
      </summary>
      <div className="admin-calculation-body">
        {breakdown.sections.map((section, sectionIndex) => (
          <section className="admin-calculation-section" key={`${section.title}-${sectionIndex}`}>
            <h3>{section.title}</h3>
            <div className="admin-calculation-rows">
              {section.rows.map((row, rowIndex) => (
                <div
                  className={row.emphasis ? 'admin-calculation-row is-emphasis' : 'admin-calculation-row'}
                  key={`${row.label}-${rowIndex}`}
                >
                  <span>{row.label}</span>
                  <code>{row.formula}</code>
                  <strong>{row.value}</strong>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  )
}

function SummaryDock({
  adminBreakdown,
  result,
  orderResult,
  priceComparison,
  positionCount,
  positionIndex,
  positions,
  hasErrors,
  isPdfBusy,
  onPdf,
  onProduction,
  onSave,
}: SummaryDockProps) {
  return (
    <aside className="summary-dock">
      <div className="summary-headline">
        {orderResult.discount > 0 ? (
          <>
            <span>Цена до скидки</span>
            <del>{money(orderResult.subtotal)}</del>
            <span>Цена со скидкой</span>
          </>
        ) : <span>Предварительная стоимость</span>}
        <strong>{money(orderResult.total)}</strong>
        <small>
          Позиция {positionIndex + 1}: {money(result.total)}
          {positionCount > 1 ? ` · Всего ${positionCount}` : ''}
        </small>
      </div>
      {priceComparison ? <PriceComparisonPanel comparison={priceComparison} /> : null}
      {adminBreakdown ? <AdminCalculationDetails breakdown={adminBreakdown} /> : null}
      <div className="summary-composition">
        <span>Состав КП</span>
        {positions.map((position) => (
          <div className={position.index === positionIndex ? 'is-active' : ''} key={position.id}>
            <span>{position.index + 1}. {position.title}<small>{position.quantity} шт.</small></span>
            <strong>{money(position.total)}</strong>
          </div>
        ))}
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
        <span>Гарантия на изделие 1 год</span>
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
        {onProduction ? (
          <button className="production-action" disabled={hasErrors} type="button" onClick={onProduction}>
            <Ruler size={19} />
            Чертежи для производства
          </button>
        ) : null}
      </div>
    </aside>
  )
}

type ArchiveScreenProps = {
  catalog: PricingCatalog
  quotes: Quote[]
  pdfQuoteId: string
  syncMessage: string
  syncStatus: QuoteSyncStatus
  onDelete: (id: string) => void
  onLoad: (quote: Quote, itemId?: string) => void
  onManualSave: (id: string, patch: ManualQuotePatch) => void
  onPdf: (quote: Quote) => void
}

export function ArchiveScreen({
  catalog,
  quotes,
  pdfQuoteId,
  syncMessage,
  syncStatus,
  onDelete,
  onLoad,
  onManualSave,
  onPdf,
}: ArchiveScreenProps) {
  const [query, setQuery] = useState('')
  const [manualQuote, setManualQuote] = useState<Quote | null>(null)
  const normalized = query.trim().toLowerCase()
  const filtered = quotes.filter((quote) => {
    const items = getQuoteItems(quote)
    const customer = getQuoteCustomer(quote)
    const variants = getQuoteVariants(quote)
    const haystack = [
      quote.number,
      customer.clientName,
      customer.clientPhone,
      String(getQuoteTotal(quote)),
      ...variants.flatMap((variant) => [
        variant.title,
        String(getQuoteVariantTotals(quote, variant).total),
      ]),
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
        <div
          className={`archive-sync-status is-${syncStatus}`}
          title={syncMessage || undefined}
        >
          {syncStatus === 'loading' ? <LoaderCircle size={15} aria-hidden="true" /> : null}
          {syncStatus === 'synced' ? <Cloud size={15} aria-hidden="true" /> : null}
          {syncStatus === 'local' || syncStatus === 'error' ? <CloudOff size={15} aria-hidden="true" /> : null}
          <span>
            {syncStatus === 'loading' ? 'Синхронизация архива' : null}
            {syncStatus === 'synced' ? 'Архив на сервере' : null}
            {syncStatus === 'local' ? 'Только на этом устройстве' : null}
            {syncStatus === 'error' ? 'Ошибка синхронизации' : null}
          </span>
          {syncStatus === 'error' && syncMessage ? <small>{syncMessage}</small> : null}
        </div>
      </section>

      <section className="quote-list">
        {filtered.map((quote) => {
          const items = getQuoteItems(quote)
          const firstItem = items[0]
          const customer = getQuoteCustomer(quote)
          const variants = getQuoteVariants(quote)
          const variantTotals = variants.map((variant) => getQuoteVariantTotals(quote, variant).total)
          const minVariantTotal = variantTotals.length > 0 ? Math.min(...variantTotals) : 0
          const maxVariantTotal = variantTotals.length > 0 ? Math.max(...variantTotals) : 0
          const variantByItemId = new Map(
            variants.flatMap((variant) => variant.itemIds.map((itemId) => [itemId, variant.title] as const)),
          )
          const totalLabel = variants.length > 0
            ? minVariantTotal === maxVariantTotal
              ? money(minVariantTotal)
              : `${money(minVariantTotal)} – ${money(maxVariantTotal)}`
            : money(getQuoteTotal(quote))
          return (
          <article className="quote-card" key={quote.id}>
            <div className="quote-head">
              <div>
                <strong>{quote.number}</strong>
                <span>{formatDate(quote.createdAt)}</span>
              </div>
              {variants.length > 0 ? <span className="quote-variant-badge">{formatVariantCount(variants.length)}</span> : null}
            </div>
            <button className="quote-main" type="button" onClick={() => onLoad(quote)}>
              {isMirrorQuoteItem(firstItem)
                ? <MirrorPreviewIcon />
                : <ConstructionPreview construction={getConstruction(defaultCatalog, firstItem.form.constructionId)} />}
              <span>
                <b>{items.length > 1 ? `${items.length} позиции` : getQuoteItemTitle(firstItem)}</b>
                <small>
                  {customer.clientName || 'Без имени'} · {totalLabel}
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
                    <small>
                      {variantByItemId.get(item.id)
                        ? `${variantByItemId.get(item.id)} · `
                        : ''}
                      {isMirrorQuoteItem(item) ? item.materialLabel : item.glassLabel}
                    </small>
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

type ArchiveWorkspaceProps = ArchiveScreenProps & { onNew: () => void }

function ArchiveWorkspace({
  catalog,
  quotes,
  pdfQuoteId,
  syncMessage,
  syncStatus,
  onDelete,
  onLoad,
  onManualSave,
  onNew,
  onPdf,
}: ArchiveWorkspaceProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [period, setPeriod] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [selectedId, setSelectedId] = useState(() => quotes[0]?.id ?? '')
  const [manualQuote, setManualQuote] = useState<Quote | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim().toLowerCase()), 300)
    return () => window.clearTimeout(timer)
  }, [query])

  const filtered = useMemo(() => {
    const now = Date.now()
    const thresholds = {
      all: Number.POSITIVE_INFINITY,
      today: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 31 * 24 * 60 * 60 * 1000,
    }
    return quotes.filter((quote) => {
      if (now - new Date(quote.createdAt).getTime() > thresholds[period]) return false
      if (!debouncedQuery) return true
      const customer = getQuoteCustomer(quote)
      const haystack = [
        quote.number,
        customer.clientName,
        customer.clientPhone,
        ...getQuoteItems(quote).map(getQuoteItemTitle),
      ].join(' ').toLowerCase()
      return haystack.includes(debouncedQuery)
    })
  }, [debouncedQuery, period, quotes])

  useEffect(() => {
    if (filtered.some((quote) => quote.id === selectedId)) return
    setSelectedId(filtered[0]?.id ?? '')
  }, [filtered, selectedId])

  const selected = filtered.find((quote) => quote.id === selectedId) ?? filtered[0]
  const selectedItems = selected ? getQuoteItems(selected) : []
  const selectedCustomer = selected ? getQuoteCustomer(selected) : normalizeQuoteCustomer(null)

  return (
    <div className="archive-workspace">
      <header className="archive-page-head">
        <div><span>Коммерческие предложения</span><h2>Архив КП</h2><p>{quotes.length} сохранённых расчётов</p></div>
        <button className="primary-action" type="button" onClick={onNew}><Plus size={18} /> Новое КП</button>
      </header>

      <section className="archive-toolbar">
        <label className="search-field"><Search size={18} /><input aria-label="Поиск по архиву" placeholder="Номер КП, клиент или телефон" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <div className="archive-periods" role="group" aria-label="Период">
          {([['all', 'Все'], ['today', 'Сегодня'], ['week', 'Неделя'], ['month', 'Месяц']] as const).map(([id, label]) => (
            <button className={period === id ? 'is-active' : ''} key={id} type="button" onClick={() => setPeriod(id)}>{label}</button>
          ))}
        </div>
        <div className={`archive-sync-status is-${syncStatus}`} title={syncMessage || undefined}>
          {syncStatus === 'loading' ? <LoaderCircle className="is-spinning" size={15} /> : syncStatus === 'synced' ? <Cloud size={15} /> : <CloudOff size={15} />}
          <span>{syncStatus === 'synced' ? 'На сервере' : syncStatus === 'loading' ? 'Синхронизация' : 'Локально'}</span>
        </div>
      </section>

      {filtered.length > 0 ? (
        <div className="archive-layout">
          <section className="archive-table-wrap">
            <table className="archive-table">
              <thead><tr><th>КП</th><th>Клиент</th><th>Изделия</th><th>Дата</th><th>Сумма</th><th><span className="sr-only">Действия</span></th></tr></thead>
              <tbody>
                {filtered.map((quote) => {
                  const customer = getQuoteCustomer(quote)
                  const items = getQuoteItems(quote)
                  return (
                    <tr className={quote.id === selected?.id ? 'is-selected' : ''} key={quote.id} onClick={() => setSelectedId(quote.id)}>
                      <td><strong>{quote.number}</strong></td>
                      <td><strong>{customer.clientName || 'Без имени'}</strong><small>{customer.clientPhone || 'Телефон не указан'}</small></td>
                      <td><span>{items.length} поз.</span><small>{items.slice(0, 2).map(getQuoteItemTitle).join(', ')}</small></td>
                      <td>{formatDate(quote.createdAt)}</td>
                      <td><strong>{money(getQuoteTotal(quote))}</strong></td>
                      <td className="archive-row-actions">
                        <button className="archive-desktop-open" aria-label={`Открыть ${quote.number}`} title="Открыть" type="button" onClick={(event) => { event.stopPropagation(); onLoad(quote) }}><ChevronRight size={18} /></button>
                        <div className="archive-mobile-row-actions">
                          <button type="button" onClick={(event) => { event.stopPropagation(); onLoad(quote) }}><Pencil size={15} /> Открыть</button>
                          <button type="button" onClick={(event) => { event.stopPropagation(); setManualQuote(quote) }}><Settings2 size={15} /> Изменить</button>
                          <button disabled={pdfQuoteId === quote.id} type="button" onClick={(event) => { event.stopPropagation(); onPdf(quote) }}><FileDown size={15} /> {pdfQuoteId === quote.id ? 'Готовим...' : 'PDF'}</button>
                          <button className="danger" type="button" onClick={(event) => { event.stopPropagation(); onDelete(quote.id) }}><Trash2 size={15} /> Удалить</button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {selected ? (
            <aside className="archive-detail">
              <header><div><span>{selected.number}</span><h3>{selectedCustomer.clientName || 'Клиент не указан'}</h3><small>{selectedCustomer.clientPhone || 'Телефон не указан'}</small></div><strong>{money(getQuoteTotal(selected))}</strong></header>
              <div className="archive-detail-items">
                <span>Состав предложения</span>
                {selectedItems.map((item, index) => (
                  <button key={item.id} type="button" onClick={() => onLoad(selected, item.id)}>
                    <i>{isMirrorQuoteItem(item) ? <ScanLine size={17} /> : <Layers3 size={17} />}</i>
                    <span><strong>{index + 1}. {getQuoteItemTitle(item)}</strong><small>{getQuoteItemQuantity(item)} шт. · {money(item.result.total * getQuoteItemQuantity(item))}</small></span>
                    <Pencil size={15} />
                  </button>
                ))}
              </div>
              {selectedCustomer.note ? <p className="archive-detail-note">{selectedCustomer.note}</p> : null}
              <footer>
                <button type="button" onClick={() => onLoad(selected)}><Pencil size={16} /> Открыть в калькуляторе</button>
                <button disabled={pdfQuoteId === selected.id} type="button" onClick={() => onPdf(selected)}><FileDown size={16} /> {pdfQuoteId === selected.id ? 'Формируем...' : 'Создать PDF'}</button>
                <button type="button" onClick={() => setManualQuote(selected)}><Settings2 size={16} /> Изменить КП</button>
                <button className="danger" type="button" onClick={() => onDelete(selected.id)}><Trash2 size={16} /> Удалить</button>
              </footer>
            </aside>
          ) : null}
        </div>
      ) : (
        <section className="archive-empty"><Archive size={32} /><h3>КП не найдены</h3><p>Измените поиск или создайте новое коммерческое предложение.</p><button className="primary-action" type="button" onClick={onNew}><Plus size={18} /> Новое КП</button></section>
      )}

      {manualQuote ? (
        <QuoteEditorDialog
          catalog={catalog}
          quote={manualQuote}
          onClose={() => setManualQuote(null)}
          onSave={(patch) => { onManualSave(manualQuote.id, patch); setManualQuote(null) }}
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
  const initialVariants = getQuoteVariants(quote)
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
    splitIntoVariants: initialVariants.length > 0,
    variants: initialVariants.map((variant) => ({
      ...variant,
      manualTotalEnabled: Number.isFinite(variant.manualTotal),
      manualTotal: getQuoteVariantTotals(quote, variant).total,
    })),
  }))
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(() => new Set())
  const [draggedItemId, setDraggedItemId] = useState('')

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
    setDraft((current) => {
      if (current.items.length <= 1) return current
      const items = current.items.filter((item) => item.id !== itemId)
      return {
        ...current,
        items,
        splitIntoVariants: items.length >= 2 && current.splitIntoVariants,
        variants: current.variants.map((variant) => ({
          ...variant,
          itemIds: variant.itemIds.filter((id) => id !== itemId),
        })),
      }
    })
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

  const createDefaultVariants = (items: ManualQuotePatch['items']) => {
    const variants: ManualQuotePatch['variants'] = [0, 1].map((index) => ({
      id: crypto.randomUUID(),
      title: `Вариант ${index + 1}`,
      itemIds: items.filter((_, itemIndex) => itemIndex % 2 === index).map((item) => item.id),
      orderDelivery: normalizeQuoteDelivery(null),
      deliveryPrice: 0,
      manualTotalEnabled: false,
      manualTotal: 0,
    }))
    return variants
  }

  const toggleVariants = (splitIntoVariants: boolean) => {
    setDraft((current) => ({
      ...current,
      splitIntoVariants,
      variants: splitIntoVariants && current.variants.length < 2
        ? createDefaultVariants(current.items)
        : current.variants,
    }))
  }

  const addVariant = () => {
    setDraft((current) => ({
      ...current,
      variants: [
        ...current.variants,
        {
          id: crypto.randomUUID(),
          title: `Вариант ${current.variants.length + 1}`,
          itemIds: [],
          orderDelivery: normalizeQuoteDelivery(null),
          deliveryPrice: 0,
          manualTotalEnabled: false,
          manualTotal: 0,
        },
      ],
    }))
  }

  const updateVariant = (
    variantId: string,
    patch: Partial<ManualQuotePatch['variants'][number]>,
  ) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => variant.id === variantId
        ? { ...variant, ...patch }
        : variant),
    }))
  }

  const updateVariantDelivery = (variantId: string, patch: Partial<QuoteDelivery>) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => {
        if (variant.id !== variantId) return variant
        const orderDelivery = normalizeQuoteDelivery({ ...variant.orderDelivery, ...patch })
        return {
          ...variant,
          orderDelivery,
          deliveryPrice: calculateQuoteDelivery(catalog, orderDelivery),
        }
      }),
    }))
  }

  const moveItemToVariant = (itemId: string, variantId: string) => {
    setDraft((current) => ({
      ...current,
      variants: current.variants.map((variant) => ({
        ...variant,
        itemIds: variant.id === variantId
          ? [...variant.itemIds.filter((id) => id !== itemId), itemId]
          : variant.itemIds.filter((id) => id !== itemId),
      })),
    }))
  }

  const deleteVariant = (variantId: string) => {
    setDraft((current) => {
      if (current.variants.length <= 2) return current
      const deletedVariant = current.variants.find((variant) => variant.id === variantId)
      const variants = current.variants.filter((variant) => variant.id !== variantId)
      if (deletedVariant?.itemIds.length) {
        variants[0] = {
          ...variants[0],
          itemIds: [...variants[0].itemIds, ...deletedVariant.itemIds],
        }
      }
      return { ...current, variants }
    })
  }

  const handleVariantDragStart = (event: DragEvent<HTMLDivElement>, itemId: string) => {
    setDraggedItemId(itemId)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
  }

  const handleVariantDrop = (event: DragEvent<HTMLElement>, variantId: string) => {
    event.preventDefault()
    const itemId = event.dataTransfer.getData('text/plain') || draggedItemId
    if (itemId) moveItemToVariant(itemId, variantId)
    setDraggedItemId('')
  }

  const productSubtotal = draft.items.reduce((sum, item) => (
    sum + roundMoneyUp(item.product) * normalizeQuoteQuantity(item.quantity)
  ), 0)
  const subtotal = productSubtotal + draft.deliveryPrice
  const discountPercent = Math.min(100, Math.max(0, Number(draft.discountPercent) || 0))
  const calculatedProductTotal = draft.discountEnabled
    ? draft.items.reduce((sum, item) => {
        const itemSubtotal = roundMoneyUp(item.product)
        return sum + roundMoneyUp(itemSubtotal * (1 - discountPercent / 100))
          * normalizeQuoteQuantity(item.quantity)
      }, 0)
    : productSubtotal
  const calculatedTotal = calculatedProductTotal + draft.deliveryPrice
  const total = draft.manualTotalEnabled
    ? roundMoneyUp(draft.manualTotal)
    : calculatedTotal
  const hasDiscount = draft.discountEnabled && discountPercent > 0 && calculatedTotal < subtotal
  const variantSummaries = draft.variants.map((variant) => {
    const itemIds = new Set(variant.itemIds)
    const variantItems = draft.items.filter((item) => itemIds.has(item.id))
    const variantProductSubtotal = variantItems.reduce((sum, item) => (
      sum + roundMoneyUp(item.product) * normalizeQuoteQuantity(item.quantity)
    ), 0)
    const variantProductTotal = draft.discountEnabled
      ? variantItems.reduce((sum, item) => (
          sum + roundMoneyUp(roundMoneyUp(item.product) * (1 - discountPercent / 100))
            * normalizeQuoteQuantity(item.quantity)
        ), 0)
      : variantProductSubtotal
    const delivery = variant.orderDelivery.enabled ? roundMoneyUp(variant.deliveryPrice) : 0
    const calculatedVariantTotal = variantProductTotal + delivery
    return {
      id: variant.id,
      itemCount: variantItems.length,
      subtotal: variantProductSubtotal + delivery,
      delivery,
      calculatedTotal: calculatedVariantTotal,
      total: variant.manualTotalEnabled ? roundMoneyUp(variant.manualTotal) : calculatedVariantTotal,
    }
  })
  const assignedVariantItemIds = draft.variants.flatMap((variant) => variant.itemIds)
  const variantAssignmentsValid = !draft.splitIntoVariants || (
    draft.variants.length >= 2
    && draft.variants.every((variant) => variant.itemIds.length > 0)
    && assignedVariantItemIds.length === draft.items.length
    && new Set(assignedVariantItemIds).size === draft.items.length
    && assignedVariantItemIds.every((itemId) => draft.items.some((item) => item.id === itemId))
  )

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

          <section className="quote-editor-section quote-variant-editor">
            <div className="quote-variant-switch">
              <ToggleRow
                checked={draft.splitIntoVariants}
                disabled={draft.items.length < 2}
                label="Разделить по вариантам"
                value={draft.items.length < 2
                  ? 'Нужно минимум 2 позиции'
                  : draft.splitIntoVariants
                    ? formatVariantCount(draft.variants.length)
                    : 'Один общий расчет'}
                onChange={toggleVariants}
              />
              {draft.splitIntoVariants ? (
                <button className="variant-add-button" type="button" onClick={addVariant}>
                  <Plus size={16} />
                  Добавить вариант
                </button>
              ) : null}
            </div>

            {draft.splitIntoVariants ? (
              <>
                <div className="quote-variant-grid">
                  {draft.variants.map((variant, variantIndex) => {
                    const summary = variantSummaries.find((item) => item.id === variant.id)
                    return (
                      <article
                        className="quote-variant-card"
                        key={variant.id}
                        onDragOver={(event) => {
                          event.preventDefault()
                          event.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(event) => handleVariantDrop(event, variant.id)}
                      >
                        <header>
                          <span>{variantIndex + 1}</span>
                          <input
                            aria-label={`Название варианта ${variantIndex + 1}`}
                            value={variant.title}
                            onChange={(event) => updateVariant(variant.id, { title: event.target.value })}
                          />
                          <button
                            aria-label={`Удалить вариант ${variantIndex + 1}`}
                            disabled={draft.variants.length <= 2}
                            title="Удалить вариант"
                            type="button"
                            onClick={() => deleteVariant(variant.id)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </header>

                        <div className={variant.itemIds.length > 0 ? 'variant-item-stack' : 'variant-item-stack is-empty'}>
                          {variant.itemIds.map((itemId) => {
                            const item = draft.items.find((candidate) => candidate.id === itemId)
                            if (!item) return null
                            return (
                              <div
                                className={draggedItemId === item.id ? 'variant-position is-dragging' : 'variant-position'}
                                draggable
                                key={item.id}
                                onDragEnd={() => setDraggedItemId('')}
                                onDragStart={(event) => handleVariantDragStart(event, item.id)}
                              >
                                <GripVertical aria-hidden="true" size={17} />
                                <span>
                                  <strong>{item.title || 'Без названия'}</strong>
                                  <small>
                                    {item.quantity} шт. · {money(roundMoneyUp(item.product) * normalizeQuoteQuantity(item.quantity))}
                                  </small>
                                </span>
                                <select
                                  aria-label={`Вариант позиции ${item.title || 'Без названия'}`}
                                  value={variant.id}
                                  onChange={(event) => moveItemToVariant(item.id, event.target.value)}
                                >
                                  {draft.variants.map((targetVariant, targetIndex) => (
                                    <option key={targetVariant.id} value={targetVariant.id}>
                                      {targetVariant.title || `Вариант ${targetIndex + 1}`}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          })}
                          {variant.itemIds.length === 0 ? <span className="variant-empty-state">Нет позиций</span> : null}
                        </div>

                        <div className="variant-delivery">
                          <DeliveryControl
                            delivery={variant.orderDelivery}
                            kmRate={catalog.services.deliveryKmRate}
                            label="Доставка варианта"
                            price={variant.deliveryPrice}
                            onChange={(patch) => updateVariantDelivery(variant.id, patch)}
                          />
                        </div>

                        <div className="variant-manual-total">
                          <ToggleRow
                            checked={variant.manualTotalEnabled}
                            label="Ручная цена"
                            value={variant.manualTotalEnabled ? 'Вручную' : 'По расчету'}
                            onChange={(manualTotalEnabled) => updateVariant(variant.id, {
                              manualTotalEnabled,
                              manualTotal: manualTotalEnabled
                                ? summary?.calculatedTotal ?? 0
                                : variant.manualTotal,
                            })}
                          />
                          {variant.manualTotalEnabled ? (
                            <label className="manual-money-field">
                              <span>Итог</span>
                              <span className="manual-money-input">
                                <input
                                  inputMode="numeric"
                                  min={0}
                                  type="number"
                                  value={variant.manualTotal}
                                  onChange={(event) => updateVariant(variant.id, {
                                    manualTotal: Number(event.target.value),
                                  })}
                                />
                                <small>₽</small>
                              </span>
                            </label>
                          ) : null}
                        </div>

                        <footer>
                          <span>
                            <small>Изделия</small>
                            <b>{money((summary?.subtotal ?? 0) - (summary?.delivery ?? 0))}</b>
                          </span>
                          <span>
                            <small>Доставка</small>
                            <b>{money(summary?.delivery ?? 0)}</b>
                          </span>
                          <span className="variant-total-value">
                            <small>Итого</small>
                            <strong>{money(summary?.total ?? 0)}</strong>
                          </span>
                        </footer>
                      </article>
                    )
                  })}
                </div>
                {!variantAssignmentsValid ? (
                  <div className="variant-validation" role="alert">
                    В каждом варианте должна быть хотя бы одна позиция.
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          {!draft.splitIntoVariants ? (
            <section className="quote-editor-section quote-editor-delivery">
              <DeliveryControl
                delivery={draft.orderDelivery}
                kmRate={catalog.services.deliveryKmRate}
                price={draft.deliveryPrice}
                onChange={updateDelivery}
              />
            </section>
          ) : null}

          <section className={draft.splitIntoVariants
            ? 'quote-editor-section quote-editor-pricing is-variants'
            : 'quote-editor-section quote-editor-pricing'}>
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
            {!draft.splitIntoVariants ? <div className="quote-price-control">
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
            </div> : null}
            {!draft.splitIntoVariants ? <div className={hasDiscount ? 'manual-total has-discount' : 'manual-total'}>
              <span>{hasDiscount ? 'Цена со скидкой' : 'Итого по КП'}</span>
              <div>
                {hasDiscount ? (
                  <span className="manual-total-before-discount">
                    <small>Цена до скидки</small>
                    <del>{money(subtotal)}</del>
                  </span>
                ) : null}
                <strong>{money(total)}</strong>
              </div>
            </div> : (
              <div className="manual-total variant-summary-total">
                <span>Вариантов</span>
                <strong>{draft.variants.length}</strong>
              </div>
            )}
          </section>
        </div>

        <footer>
          <button type="button" onClick={onClose}>Отмена</button>
          <button
            className="primary-action"
            disabled={!variantAssignmentsValid}
            type="button"
            onClick={() => onSave(draft)}
          >
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
  onDirtyChange: (dirty: boolean) => void
  onReset: () => void
  onRetry: () => void
  syncState: PriceSyncState
}

type PriceSectionId =
  | 'glass'
  | 'hardware'
  | 'hardwareClass'
  | 'hardwareItems'
  | 'constructions'
  | 'services'
  | 'showerSettings'
  | 'mirrorMaterials'
  | 'mirrorGroups'
  | 'mirrorServices'
  | 'mirrorSettings'

type PriceTabId = 'shower' | 'mirror' | 'works' | 'delivery'

type PriceSearchEntry = {
  key: string
  label: string
  price: number
  suffix: string
  tab: PriceTabId
  tabLabel: string
  section: PriceSectionId
  sectionLabel: string
  anchorId: string
  sku?: string
  sourceUrl?: string
  showerHardwareSectionId?: ShowerHardwareSectionId
}

const normalizePriceSearchText = (value: string) => value
  .toLocaleLowerCase('ru')
  .replaceAll('ё', 'е')
  .replace(/\s+/g, ' ')
  .trim()

const normalizePriceSearchNumber = (value: string) => value
  .replace(/[^\d,.-]/g, '')
  .replace(',', '.')

const formatPriceSearchValue = (value: number, suffix: string) => (
  `${new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)} ${suffix}`
)

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

function PricesScreen({
  catalog: savedCatalog,
  mirrorCatalog: savedMirrorCatalog,
  onCatalog: saveCatalogChanges,
  onLogin,
  onLogout,
  onMirrorCatalog: saveMirrorCatalogChanges,
  onDirtyChange,
  onReset,
  onRetry,
  syncState,
}: PricesScreenProps) {
  const [catalog, setDraftCatalog] = useState(() => structuredClone(savedCatalog))
  const [mirrorCatalog, setDraftMirrorCatalog] = useState(() => structuredClone(savedMirrorCatalog))
  const [openSection, setOpenSection] = useState<PriceSectionId | null>(null)
  const [openShowerHardwareSection, setOpenShowerHardwareSection] = useState<ShowerHardwareSectionId | null>(null)
  const [showerHardwareQuery, setShowerHardwareQuery] = useState('')
  const [mirrorServiceQuery, setMirrorServiceQuery] = useState('')
  const [priceSearchQuery, setPriceSearchQuery] = useState('')
  const [priceTab, setPriceTab] = useState<PriceTabId>('shower')
  const dirtyCount = useMemo(
    () => countChangedValues(catalog, savedCatalog) + countChangedValues(mirrorCatalog, savedMirrorCatalog),
    [catalog, mirrorCatalog, savedCatalog, savedMirrorCatalog],
  )
  const normalizedMirrorServiceQuery = mirrorServiceQuery
    .toLocaleLowerCase('ru')
    .replaceAll('ё', 'е')
    .trim()
  const mirrorPriceSections = useMemo(() => mirrorServiceSections
    .map((section) => {
      const sectionMatches = section.label
        .toLocaleLowerCase('ru')
        .replaceAll('ё', 'е')
        .includes(normalizedMirrorServiceQuery)
      const items = mirrorCatalog.services.filter((item) => {
        if (item.sectionId !== section.id) return false
        if (!normalizedMirrorServiceQuery || sectionMatches) return true
        return `${item.label} ${item.sku ?? ''} ${item.price} ${mirrorUnitLabels[item.unit]}`
          .toLocaleLowerCase('ru')
          .replaceAll('ё', 'е')
          .includes(normalizedMirrorServiceQuery)
      })
      return { ...section, items }
    })
    .filter((section) => section.items.length > 0), [mirrorCatalog.services, normalizedMirrorServiceQuery])
  const mirrorServiceMatchCount = mirrorPriceSections.reduce((sum, section) => sum + section.items.length, 0)
  const showerPriceSections = useMemo(() => {
    const query = showerHardwareQuery.trim().toLocaleLowerCase('ru')
    return showerHardwareSections
      .map((section) => ({
        ...section,
        items: catalog.hardwareItems.filter((item) => item.sectionId === section.id && (
          !query
          || item.label.toLocaleLowerCase('ru').includes(query)
          || item.sku?.toLocaleLowerCase('ru').includes(query)
        )),
        total: catalog.hardwareItems.filter((item) => item.sectionId === section.id).length,
      }))
      .filter((section) => section.total > 0 && (!query || section.items.length > 0))
  }, [catalog.hardwareItems, showerHardwareQuery])
  const showerHardwareMatchCount = showerPriceSections.reduce((sum, section) => sum + section.items.length, 0)
  const priceSearchEntries = useMemo(() => {
    const entries: PriceSearchEntry[] = []
    const add = (entry: PriceSearchEntry) => entries.push(entry)

    catalog.glass.forEach((item) => add({
      key: `shower-glass-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: '₽/м²',
      tab: 'shower',
      tabLabel: 'Душевые',
      section: 'glass',
      sectionLabel: 'Стекло',
      anchorId: 'price-glass',
    }))
    catalog.hardware.forEach((item) => add({
      key: `shower-color-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: '% к хрому',
      tab: 'shower',
      tabLabel: 'Душевые',
      section: 'hardware',
      sectionLabel: 'Цвет фурнитуры',
      anchorId: 'price-hardware',
    }))
    catalog.hardwareClass.forEach((item) => add({
      key: `shower-class-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: '% к стандарту',
      tab: 'shower',
      tabLabel: 'Душевые',
      section: 'hardwareClass',
      sectionLabel: 'Класс фурнитуры',
      anchorId: 'price-hardware-class',
    }))
    catalog.hardwareItems.forEach((item) => add({
      key: `shower-hardware-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: '₽/шт.',
      tab: 'shower',
      tabLabel: 'Душевые',
      section: 'hardwareItems',
      sectionLabel: showerHardwareSections.find((section) => section.id === item.sectionId)?.label ?? 'Фурнитура AV-24',
      anchorId: `price-shower-hardware-${item.id}`,
      sku: item.sku,
      sourceUrl: item.sourceUrl,
      showerHardwareSectionId: item.sectionId,
    }))
    catalog.constructions.forEach((item) => {
      add({
        key: `construction-base-${item.id}`,
        label: `${item.shortTitle} — база конструкции`,
        price: item.basePrice,
        suffix: '₽',
        tab: 'shower',
        tabLabel: 'Душевые',
        section: 'constructions',
        sectionLabel: 'Конструкции',
        anchorId: 'price-constructions',
      })
      add({
        key: `construction-installation-${item.id}`,
        label: `${item.shortTitle} — монтаж`,
        price: item.installationPrice,
        suffix: '₽',
        tab: 'shower',
        tabLabel: 'Душевые',
        section: 'constructions',
        sectionLabel: 'Конструкции',
        anchorId: 'price-constructions',
      })
    })

    ;([
      ['deliveryBase', 'Стандартная доставка по городу', '₽'],
      ['deliveryKmRate', 'Доплата за городом', '₽/км'],
      ['heightSurchargeAfter', 'Высота: порог надбавки', 'мм'],
      ['heightSurchargePercent', 'Надбавка за высоту', '%'],
    ] as const).forEach(([key, label, suffix]) => add({
      key: `delivery-${key}`,
      label,
      price: catalog.services[key],
      suffix,
      tab: 'delivery',
      tabLabel: 'Доставка',
      section: 'services',
      sectionLabel: 'Услуги',
      anchorId: 'price-services',
    }))
    ;([
      ['productMarkupPercent', 'Наценка на изделие', '%'],
      ['hardwareMarkupPercent', 'Наценка на фурнитуру', '%'],
      ['designerPercent', 'Дизайнер', '%'],
      ['discountPercent', 'Скидка по умолчанию', '%'],
    ] as const).forEach(([key, label, suffix]) => add({
      key: `shower-setting-${key}`,
      label,
      price: catalog.services[key],
      suffix,
      tab: 'shower',
      tabLabel: 'Душевые',
      section: 'showerSettings',
      sectionLabel: 'Настройки душевых',
      anchorId: 'price-shower-settings',
    }))

    mirrorCatalog.materials.forEach((item) => add({
      key: `mirror-material-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: '₽/м²',
      tab: 'mirror',
      tabLabel: 'Зеркала',
      section: 'mirrorMaterials',
      sectionLabel: 'Материалы зеркал',
      anchorId: 'price-mirror-materials',
    }))
    mirrorCatalog.services.forEach((item) => add({
      key: `mirror-service-${item.id}`,
      label: item.label,
      price: item.price,
      suffix: `₽/${mirrorUnitLabels[item.unit]}`,
      tab: 'works',
      tabLabel: 'Работы',
      section: 'mirrorServices',
      sectionLabel: mirrorServiceSections.find((section) => section.id === item.sectionId)?.label ?? 'Работы и комплектующие',
      anchorId: `price-mirror-service-${item.id}`,
      sku: item.sku,
      sourceUrl: item.sourceUrl,
    }))
    mirrorCatalog.groups.forEach((group) => add({
      key: `mirror-group-${group.id}`,
      label: group.label,
      price: group.items.reduce((total, groupItem) => {
        const service = mirrorCatalog.services.find((item) => item.id === groupItem.serviceId)
        return total + (service?.price ?? 0) * groupItem.quantity
      }, 0),
      suffix: '₽',
      tab: 'mirror',
      tabLabel: 'Зеркала',
      section: 'mirrorGroups',
      sectionLabel: 'Группы работ',
      anchorId: `price-mirror-group-${group.id}`,
    }))
    ;([
      ['materialMarkupPercent', 'Наценка на материал', '%'],
      ['serviceMarkupPercent', 'Наценка на работы', '%'],
      ['managerPercent', 'Менеджер', '%'],
      ['designerPercent', 'Дизайнер', '%'],
      ['discountPercent', 'Скидка по умолчанию', '%'],
    ] as const).forEach(([key, label, suffix]) => add({
      key: `mirror-setting-${key}`,
      label,
      price: mirrorCatalog.settings[key],
      suffix,
      tab: 'mirror',
      tabLabel: 'Зеркала',
      section: 'mirrorSettings',
      sectionLabel: 'Настройки зеркал',
      anchorId: 'price-mirror-settings',
    }))

    return entries
  }, [catalog, mirrorCatalog])
  const priceSearchMatches = useMemo(() => {
    const query = normalizePriceSearchText(priceSearchQuery)
    if (!query) return []
    const numericQuery = normalizePriceSearchNumber(query)
    const searchesPrice = /\d/.test(query) && numericQuery.length > 0

    return priceSearchEntries
      .map((entry) => {
        const label = normalizePriceSearchText(entry.label)
        const sku = normalizePriceSearchText(entry.sku ?? '')
        const context = normalizePriceSearchText(`${entry.tabLabel} ${entry.sectionLabel}`)
        const price = normalizePriceSearchNumber(String(entry.price))
        let score = Number.POSITIVE_INFINITY

        if (sku === query || (searchesPrice && price === numericQuery)) score = 0
        else if (label.startsWith(query) || sku.startsWith(query)) score = 1
        else if (label.includes(query) || sku.includes(query)) score = 2
        else if (context.includes(query)) score = 3
        else if (searchesPrice && price.includes(numericQuery)) score = 4

        return { entry, score }
      })
      .filter((match) => Number.isFinite(match.score))
      .sort((left, right) => left.score - right.score || left.entry.label.localeCompare(right.entry.label, 'ru'))
      .map((match) => match.entry)
  }, [priceSearchEntries, priceSearchQuery])
  const visiblePriceSearchMatches = priceSearchMatches.slice(0, 100)
  const isDirty = dirtyCount > 0

  useEffect(() => {
    if (!showerHardwareQuery.trim() || showerPriceSections.length === 0) return
    if (!showerPriceSections.some((section) => section.id === openShowerHardwareSection)) {
      setOpenShowerHardwareSection(showerPriceSections[0].id)
    }
  }, [openShowerHardwareSection, showerHardwareQuery, showerPriceSections])
  useEffect(() => onDirtyChange(isDirty), [isDirty, onDirtyChange])
  useEffect(() => {
    if (isDirty) return
    setDraftCatalog(structuredClone(savedCatalog))
    setDraftMirrorCatalog(structuredClone(savedMirrorCatalog))
  }, [isDirty, savedCatalog, savedMirrorCatalog])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [isDirty])

  const discardChanges = () => {
    setDraftCatalog(structuredClone(savedCatalog))
    setDraftMirrorCatalog(structuredClone(savedMirrorCatalog))
  }

  const saveChanges = () => {
    saveCatalogChanges(catalog)
    saveMirrorCatalogChanges(mirrorCatalog)
  }
  const toggleSection = (section: PriceSectionId) => {
    setOpenSection((current) => (current === section ? null : section))
  }
  const openPriceSearchEntry = (entry: PriceSearchEntry) => {
    setPriceTab(entry.tab)
    setOpenSection(entry.section)
    setPriceSearchQuery('')

    if (entry.showerHardwareSectionId) {
      setOpenShowerHardwareSection(entry.showerHardwareSectionId)
      setShowerHardwareQuery(entry.sku || entry.label)
    }

    const reveal = (attempt = 0) => {
      const target = document.getElementById(entry.anchorId)
      if (!target && attempt < 4) {
        window.setTimeout(() => reveal(attempt + 1), 80)
        return
      }
      if (!target) return
      const details = target.closest('details')
      if (details instanceof HTMLDetailsElement) details.open = true
      target.classList.add('price-search-target')
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
      window.setTimeout(() => target.classList.remove('price-search-target'), 1800)
    }
    window.setTimeout(reveal, 80)
  }

  const updateOption = (
    group: 'glass' | 'hardware' | 'hardwareClass',
    id: string,
    patch: Partial<Pick<PriceOption, 'label' | 'price' | 'thickness'>>,
  ) => {
    setDraftCatalog({
      ...catalog,
      [group]: catalog[group].map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addOption = (group: 'glass' | 'hardware' | 'hardwareClass') => {
    setDraftCatalog({
      ...catalog,
      [group]: [
        ...catalog[group],
        {
          id: `custom-${crypto.randomUUID()}`,
          label: 'Новая позиция',
          price: 0,
          ...(group === 'glass' ? { thickness: 8 as const } : {}),
        },
      ],
    })
  }

  const deleteOption = (group: 'glass' | 'hardware' | 'hardwareClass', id: string) => {
    if (catalog[group].length <= 1) return
    setDraftCatalog({ ...catalog, [group]: catalog[group].filter((item) => item.id !== id) })
  }

  const updateHardwareItem = (id: string, patch: Partial<ShowerHardwareItem>) => {
    setDraftCatalog({
      ...catalog,
      hardwareItems: catalog.hardwareItems.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  const addHardwareItem = () => {
    setDraftCatalog({
      ...catalog,
      hardwareItems: [
        ...catalog.hardwareItems,
        {
          id: `custom-${crypto.randomUUID()}`,
          label: 'Новая фурнитура',
          price: 0,
          sectionId: 'accessories',
        },
      ],
    })
    setOpenShowerHardwareSection('accessories')
  }

  const deleteHardwareItem = (id: string) => {
    if (catalog.hardwareItems.length <= 1) return
    setDraftCatalog({
      ...catalog,
      hardwareItems: catalog.hardwareItems.filter((item) => item.id !== id),
      constructions: catalog.constructions.map((construction) => ({
        ...construction,
        hardwareComponents: (construction.hardwareComponents ?? [])
          .filter((component) => component.hardwareItemId !== id),
      })),
    })
  }

  const updateConstruction = (
    id: string,
    patch: Partial<Pick<Construction, 'basePrice' | 'installationPrice' | 'shortTitle' | 'title'>>,
  ) => {
    setDraftCatalog({
      ...catalog,
      constructions: catalog.constructions.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    })
  }

  const addConstruction = () => {
    const template = catalog.constructions[0]
    const label = 'Новая конструкция'
    setDraftCatalog({
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
          hardwareComponents: [],
        },
      ],
    })
  }

  const deleteConstruction = (id: string) => {
    if (catalog.constructions.length <= 1) return
    setDraftCatalog({
      ...catalog,
      constructions: catalog.constructions.filter((item) => item.id !== id),
    })
  }

  const addConstructionHardware = (constructionId: string) => {
    const hardwareItem = catalog.hardwareItems[0]
    if (!hardwareItem) return
    setDraftCatalog({
      ...catalog,
      constructions: catalog.constructions.map((construction) => construction.id === constructionId
        ? {
            ...construction,
            hardwareComponents: [
              ...(construction.hardwareComponents ?? []),
              { id: crypto.randomUUID(), hardwareItemId: hardwareItem.id, quantity: 1 },
            ],
          }
        : construction),
    })
  }

  const updateConstructionHardware = (
    constructionId: string,
    componentId: string,
    patch: Partial<Pick<ConstructionHardwareComponent, 'hardwareItemId' | 'quantity' | 'glassThickness'>>,
  ) => {
    setDraftCatalog({
      ...catalog,
      constructions: catalog.constructions.map((construction) => construction.id === constructionId
        ? {
            ...construction,
            hardwareComponents: (construction.hardwareComponents ?? []).map((component) => (
              component.id === componentId ? { ...component, ...patch } : component
            )),
          }
        : construction),
    })
  }

  const deleteConstructionHardware = (constructionId: string, componentId: string) => {
    setDraftCatalog({
      ...catalog,
      constructions: catalog.constructions.map((construction) => construction.id === constructionId
        ? {
            ...construction,
            hardwareComponents: (construction.hardwareComponents ?? [])
              .filter((component) => component.id !== componentId),
          }
        : construction),
    })
  }

  const updateService = (key: keyof PricingCatalog['services'], value: number) => {
    setDraftCatalog({
      ...catalog,
      services: { ...catalog.services, [key]: value },
    })
  }

  const updateMirrorMaterial = (id: string, patch: Partial<Pick<MirrorMaterial, 'label' | 'price'>>) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      materials: mirrorCatalog.materials.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  const addMirrorMaterial = () => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      materials: [
        ...mirrorCatalog.materials,
        { id: `custom-${crypto.randomUUID()}`, label: 'Новый материал', price: 0 },
      ],
    })
  }

  const deleteMirrorMaterial = (id: string) => {
    if (mirrorCatalog.materials.length <= 1) return
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      materials: mirrorCatalog.materials.filter((item) => item.id !== id),
    })
  }

  const updateMirrorService = (id: string, patch: Partial<MirrorService>) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      services: mirrorCatalog.services.map((item) => item.id === id ? { ...item, ...patch } : item),
    })
  }

  const addMirrorService = () => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      services: [
        ...mirrorCatalog.services,
        {
          id: `custom-${crypto.randomUUID()}`,
          label: 'Новая работа',
          price: 0,
          unit: 'piece',
          category: 'work',
          sectionId: 'works',
          visibleInQuote: true,
        },
      ],
    })
  }

  const deleteMirrorService = (id: string) => {
    if (mirrorCatalog.services.length <= 1) return
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      services: mirrorCatalog.services.filter((item) => item.id !== id),
      groups: mirrorCatalog.groups.map((group) => ({
        ...group,
        items: group.items.filter((item) => item.serviceId !== id),
      })),
    })
  }

  const updateMirrorGroup = (id: string, patch: Partial<Pick<MirrorServiceGroup, 'label' | 'visibleInQuote'>>) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: mirrorCatalog.groups.map((group) => group.id === id ? { ...group, ...patch } : group),
    })
  }

  const addMirrorGroup = () => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: [
        ...mirrorCatalog.groups,
        {
          id: `custom-${crypto.randomUUID()}`,
          label: 'Новая группа работ',
          items: [],
          visibleInQuote: true,
        },
      ],
    })
  }

  const deleteMirrorGroup = (id: string) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: mirrorCatalog.groups.filter((group) => group.id !== id),
    })
  }

  const addMirrorGroupItem = (groupId: string) => {
    const service = mirrorCatalog.services[0]
    if (!service) return
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: mirrorCatalog.groups.map((group) => group.id === groupId
        ? {
            ...group,
            items: [...group.items, { id: crypto.randomUUID(), serviceId: service.id, quantity: 1 }],
          }
        : group),
    })
  }

  const updateMirrorGroupItem = (
    groupId: string,
    itemId: string,
    patch: Partial<MirrorServiceGroup['items'][number]>,
  ) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: mirrorCatalog.groups.map((group) => group.id === groupId
        ? {
            ...group,
            items: group.items.map((item) => item.id === itemId ? { ...item, ...patch } : item),
          }
        : group),
    })
  }

  const deleteMirrorGroupItem = (groupId: string, itemId: string) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      groups: mirrorCatalog.groups.map((group) => group.id === groupId
        ? { ...group, items: group.items.filter((item) => item.id !== itemId) }
        : group),
    })
  }

  const updateMirrorSetting = (key: keyof MirrorPricingCatalog['settings'], value: number) => {
    setDraftMirrorCatalog({
      ...mirrorCatalog,
      settings: { ...mirrorCatalog.settings, [key]: value },
    })
  }

  return (
    <div className={`screen-stack prices-screen show-${priceTab}`}>
      <PriceServerSyncPanel onLogin={onLogin} onLogout={onLogout} onRetry={onRetry} syncState={syncState} />
      {syncState.username && syncState.ready ? (
        <>
      <section className="section-block admin-head">
        <div>
          <h2>Цены</h2>
          <span>Изменения применяются только после сохранения</span>
        </div>
        <button type="button" onClick={onReset}>
          <RotateCcw size={16} />
          Сбросить
        </button>
      </section>

      <section className="section-block price-global-search">
        <label className="price-global-search-field">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Поиск по всем ценам</span>
          <input
            placeholder="Название, артикул или цена"
            type="search"
            value={priceSearchQuery}
            onChange={(event) => setPriceSearchQuery(event.target.value)}
          />
          {priceSearchQuery ? (
            <button aria-label="Очистить поиск" type="button" onClick={() => setPriceSearchQuery('')}>
              <X size={17} />
            </button>
          ) : null}
        </label>
        {priceSearchQuery.trim() ? (
          <div className="price-global-search-output" aria-live="polite">
            <header>
              <strong>{formatPositionCount(priceSearchMatches.length)}</strong>
              <span>по всем разделам цен</span>
            </header>
            {visiblePriceSearchMatches.length > 0 ? (
              <div className="price-global-search-results">
                {visiblePriceSearchMatches.map((entry) => (
                  <div className="price-global-search-result" key={entry.key}>
                    <button type="button" onClick={() => openPriceSearchEntry(entry)}>
                      <span>
                        <strong>{entry.label}</strong>
                        <small>
                          {entry.tabLabel} · {entry.sectionLabel}
                          {entry.sku ? ` · арт. ${entry.sku}` : ''}
                        </small>
                      </span>
                      <b>{formatPriceSearchValue(entry.price, entry.suffix)}</b>
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                    {entry.sourceUrl ? (
                      <a
                        aria-label={`Открыть ${entry.label} на сайте поставщика`}
                        href={entry.sourceUrl}
                        rel="noreferrer"
                        target="_blank"
                        title="Открыть карточку поставщика"
                      >
                        <ExternalLink size={16} />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : <p>Совпадений не найдено.</p>}
            {priceSearchMatches.length > visiblePriceSearchMatches.length ? (
              <small>Показаны первые {visiblePriceSearchMatches.length} результатов. Уточните запрос.</small>
            ) : null}
          </div>
        ) : null}
      </section>

      <nav className="price-category-tabs" aria-label="Разделы цен">
        {([
          ['shower', 'Душевые'],
          ['mirror', 'Зеркала'],
          ['works', 'Работы'],
          ['delivery', 'Доставка'],
        ] as const).map(([id, label]) => (
          <button className={priceTab === id ? 'is-active' : ''} key={id} type="button" onClick={() => { setPriceTab(id); setOpenSection(id === 'works' ? 'mirrorServices' : null) }}>
            {label}
          </button>
        ))}
      </nav>

      <PriceGroup
        category="shower"
        controlsId="price-glass"
        isOpen={openSection === 'glass'}
        items={catalog.glass}
        suffix="₽/м²"
        title="Стекло"
        onAdd={() => addOption('glass')}
        onChange={(id, value) => updateOption('glass', id, { price: value })}
        onDelete={(id) => deleteOption('glass', id)}
        onNameChange={(id, value) => updateOption('glass', id, { label: value })}
        onThicknessChange={(id, thickness) => updateOption('glass', id, { thickness })}
        onToggle={() => toggleSection('glass')}
      />
      <PriceGroup
        category="shower"
        controlsId="price-hardware"
        isOpen={openSection === 'hardware'}
        items={catalog.hardware}
        suffix="% к хрому"
        title="Цвет фурнитуры"
        onAdd={() => addOption('hardware')}
        onChange={(id, value) => updateOption('hardware', id, { price: value })}
        onDelete={(id) => deleteOption('hardware', id)}
        onNameChange={(id, value) => updateOption('hardware', id, { label: value })}
        onToggle={() => toggleSection('hardware')}
      />
      <PriceGroup
        category="shower"
        controlsId="price-hardware-class"
        isOpen={openSection === 'hardwareClass'}
        items={catalog.hardwareClass}
        suffix="% к стандарту"
        title="Класс фурнитуры"
        onAdd={() => addOption('hardwareClass')}
        onChange={(id, value) => updateOption('hardwareClass', id, { price: value })}
        onDelete={(id) => deleteOption('hardwareClass', id)}
        onNameChange={(id, value) => updateOption('hardwareClass', id, { label: value })}
        onToggle={() => toggleSection('hardwareClass')}
      />
      <section className={openSection === 'hardwareItems' ? 'section-block price-accordion price-category-shower is-open' : 'section-block price-accordion price-category-shower'}>
        <PriceAccordionHeader
          controlsId="price-hardware-items"
          isOpen={openSection === 'hardwareItems'}
          meta={`${formatPositionCount(catalog.hardwareItems.length)} · ${showerHardwareSections.length} разделов`}
          title="Фурнитура AV-24"
          onAdd={addHardwareItem}
          onToggle={() => toggleSection('hardwareItems')}
        />
        {openSection === 'hardwareItems' ? (
          <div className="price-accordion-body shower-price-catalog" id="price-hardware-items">
            <label className="shower-hardware-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Поиск фурнитуры AV-24</span>
              <input
                placeholder="Поиск по названию или артикулу"
                type="search"
                value={showerHardwareQuery}
                onChange={(event) => setShowerHardwareQuery(event.target.value)}
              />
              {showerHardwareQuery ? <small>{formatPositionCount(showerHardwareMatchCount)}</small> : null}
            </label>
            <div className="shower-price-section-list">
              {showerPriceSections.map((section) => {
                const isOpen = openShowerHardwareSection === section.id
                return (
                  <section className={isOpen ? 'shower-price-section is-open' : 'shower-price-section'} key={section.id}>
                    <button
                      aria-expanded={isOpen}
                      className="shower-price-section-toggle"
                      type="button"
                      onClick={() => setOpenShowerHardwareSection((current) => current === section.id ? null : section.id)}
                    >
                      <span>
                        <strong>{section.label}</strong>
                        <small>{showerHardwareQuery ? `${formatPositionCount(section.items.length)} из ${section.total}` : formatPositionCount(section.total)}</small>
                      </span>
                      <ChevronDown size={18} aria-hidden="true" />
                    </button>
                    {isOpen ? (
                      <div className="price-list shower-price-section-body">
                        {section.items.map((item) => (
                          <ShowerHardwarePriceRow
                            canDelete={catalog.hardwareItems.length > 1}
                            item={item}
                            key={item.id}
                            onChange={(patch) => updateHardwareItem(item.id, patch)}
                            onDelete={() => deleteHardwareItem(item.id)}
                          />
                        ))}
                        {section.items.length === 0 ? <p className="shower-hardware-empty">В этом разделе совпадений нет.</p> : null}
                      </div>
                    ) : null}
                  </section>
                )
              })}
              {showerPriceSections.length === 0 ? <p className="shower-hardware-empty">По вашему запросу ничего не найдено.</p> : null}
            </div>
          </div>
        ) : null}
      </section>

      <section className={openSection === 'constructions' ? 'section-block price-accordion price-category-shower is-open' : 'section-block price-accordion price-category-shower'}>
        <PriceAccordionHeader
          controlsId="price-constructions"
          isOpen={openSection === 'constructions'}
          meta="База, монтаж и состав"
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
                hardwareComponents={item.hardwareComponents ?? []}
                hardwareItems={catalog.hardwareItems}
                onAddHardware={() => addConstructionHardware(item.id)}
                onBasePriceChange={(value) => updateConstruction(item.id, { basePrice: value })}
                onDelete={() => deleteConstruction(item.id)}
                onHardwareChange={(componentId, patch) => updateConstructionHardware(item.id, componentId, patch)}
                onHardwareDelete={(componentId) => deleteConstructionHardware(item.id, componentId)}
                onInstallationPriceChange={(value) => updateConstruction(item.id, { installationPrice: value })}
                onLabelChange={(value) => updateConstruction(item.id, { shortTitle: value, title: value })}
              />
            ))}
          </div>
        ) : null}
      </section>

      <section className={openSection === 'services' ? 'section-block price-accordion price-category-delivery is-open' : 'section-block price-accordion price-category-delivery'}>
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

      <section className={openSection === 'showerSettings' ? 'section-block price-accordion price-category-shower is-open' : 'section-block price-accordion price-category-shower'}>
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
        category="mirror"
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

      <section className={openSection === 'mirrorGroups' ? 'section-block price-accordion price-category-mirror is-open' : 'section-block price-accordion price-category-mirror'}>
        <PriceAccordionHeader
          controlsId="price-mirror-groups"
          isOpen={openSection === 'mirrorGroups'}
          meta="Комплекты из справочника работ"
          title="Группы работ"
          onAdd={addMirrorGroup}
          onToggle={() => toggleSection('mirrorGroups')}
        />
        {openSection === 'mirrorGroups' ? (
          <div className="price-list price-accordion-body" id="price-mirror-groups">
            {mirrorCatalog.groups.map((group) => (
              <MirrorServiceGroupEditor
                group={group}
                key={group.id}
                services={mirrorCatalog.services}
                onAddItem={() => addMirrorGroupItem(group.id)}
                onChange={(patch) => updateMirrorGroup(group.id, patch)}
                onDelete={() => deleteMirrorGroup(group.id)}
                onDeleteItem={(itemId) => deleteMirrorGroupItem(group.id, itemId)}
                onItemChange={(itemId, patch) => updateMirrorGroupItem(group.id, itemId, patch)}
              />
            ))}
            {mirrorCatalog.groups.length === 0 ? (
              <div className="price-editor-empty">
                <strong>Групп пока нет</strong>
                <span>Создайте комплект и добавьте в него операции из раздела «Работы».</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={openSection === 'mirrorServices' ? 'section-block price-accordion price-category-works is-open' : 'section-block price-accordion price-category-works'}>
        <PriceAccordionHeader
          controlsId="price-mirror-services"
          isOpen={openSection === 'mirrorServices'}
          meta={`${formatPositionCount(mirrorCatalog.services.length)} · ${mirrorPriceSections.length} разделов`}
          title="Работы и комплектующие"
          onAdd={addMirrorService}
          onToggle={() => toggleSection('mirrorServices')}
        />
        {openSection === 'mirrorServices' ? (
          <div className="price-accordion-body mirror-price-section-list" id="price-mirror-services">
            <label className="shower-hardware-search">
              <Search size={17} aria-hidden="true" />
              <span className="sr-only">Поиск по работам и комплектующим зеркал</span>
              <input
                aria-label="Поиск по работам и комплектующим зеркал"
                placeholder="Название, артикул или цена"
                type="search"
                value={mirrorServiceQuery}
                onChange={(event) => setMirrorServiceQuery(event.target.value)}
              />
              {mirrorServiceQuery ? <small>{formatPositionCount(mirrorServiceMatchCount)}</small> : null}
            </label>
            {mirrorPriceSections.map((section) => (
              <details className="mirror-price-section" key={`${section.id}-${normalizedMirrorServiceQuery ? 'search' : 'browse'}`} open={normalizedMirrorServiceQuery ? true : undefined}>
                <summary>
                  <span>
                    <strong>{section.label}</strong>
                    <small>{formatPositionCount(section.items.length)}</small>
                  </span>
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <div className="price-list mirror-price-section-body">
                  {section.items.map((item) => (
                    <MirrorServicePriceRow
                      canDelete={mirrorCatalog.services.length > 1}
                      item={item}
                      key={item.id}
                      onChange={(patch) => updateMirrorService(item.id, patch)}
                      onDelete={() => deleteMirrorService(item.id)}
                    />
                  ))}
                </div>
              </details>
            ))}
            {normalizedMirrorServiceQuery && mirrorPriceSections.length === 0 ? (
              <div className="price-editor-empty">
                <strong>Ничего не найдено</strong>
                <span>Попробуйте изменить название, артикул или цену.</span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className={openSection === 'mirrorSettings' ? 'section-block price-accordion price-category-mirror is-open' : 'section-block price-accordion price-category-mirror'}>
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
      {isDirty ? (
        <div className="price-save-bar" role="status">
          <span>Изменения: {dirtyCount}</span>
          <button type="button" onClick={discardChanges}>Отменить</button>
          <button className="is-primary" type="button" onClick={saveChanges}><Save size={17} /> Сохранить цены</button>
        </div>
      ) : null}
        </>
      ) : null}
    </div>
  )
}

type PriceGroupProps = {
  category: 'shower' | 'mirror'
  controlsId: string
  isOpen: boolean
  title: string
  suffix: string
  items: PriceOption[]
  onChange: (id: string, value: number) => void
  onNameChange: (id: string, value: string) => void
  onThicknessChange?: (id: string, thickness: 6 | 8) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onToggle: () => void
}

function PriceGroup({
  category,
  controlsId,
  isOpen,
  title,
  suffix,
  items,
  onChange,
  onNameChange,
  onThicknessChange,
  onAdd,
  onDelete,
  onToggle,
}: PriceGroupProps) {
  return (
    <section className={isOpen ? `section-block price-accordion price-category-${category} is-open` : `section-block price-accordion price-category-${category}`}>
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
              thickness={item.thickness}
              onDelete={() => onDelete(item.id)}
              onLabelChange={(value) => onNameChange(item.id, value)}
              onPriceChange={(value) => onChange(item.id, value)}
              onThicknessChange={onThicknessChange
                ? (thickness) => onThicknessChange(item.id, thickness)
                : undefined}
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
  thickness?: 6 | 8
  canDelete: boolean
  onLabelChange: (value: string) => void
  onPriceChange: (value: number) => void
  onThicknessChange?: (thickness: 6 | 8) => void
  onDelete: () => void
}

function EditablePriceRow({
  label,
  price,
  suffix,
  thickness,
  canDelete,
  onLabelChange,
  onPriceChange,
  onThicknessChange,
  onDelete,
}: EditablePriceRowProps) {
  return (
    <div className={onThicknessChange ? 'price-edit-row has-thickness' : 'price-edit-row'}>
      <label className="price-name-field">
        <span className="sr-only">Название позиции</span>
        <input
          aria-label={`Название: ${label || 'позиция'}`}
          value={label}
          onChange={(event) => onLabelChange(event.target.value)}
        />
      </label>
      {onThicknessChange ? (
        <label className="price-thickness-field">
          <span className="sr-only">Толщина стекла {label}</span>
          <select
            aria-label={`Толщина: ${label || 'позиция'}`}
            value={thickness ?? 8}
            onChange={(event) => onThicknessChange(Number(event.target.value) as 6 | 8)}
          >
            <option value="6">6 мм</option>
            <option value="8">8 мм</option>
          </select>
        </label>
      ) : null}
      <label className="price-value-field">
        <span className="sr-only">Цена позиции {label}</span>
        <input
          aria-label={`Цена: ${label || 'позиция'}`}
          inputMode="numeric"
          min={0}
          type="number"
          value={price}
          onChange={(event) => onPriceChange(Math.max(0, Number(event.target.value) || 0))}
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

type ShowerHardwarePriceRowProps = {
  item: ShowerHardwareItem
  canDelete: boolean
  onChange: (patch: Partial<ShowerHardwareItem>) => void
  onDelete: () => void
}

function ShowerHardwarePriceRow({ item, canDelete, onChange, onDelete }: ShowerHardwarePriceRowProps) {
  return (
    <div className="shower-hardware-price-row" id={`price-shower-hardware-${item.id}`}>
      <div className="mirror-service-name">
        <label className="price-name-field">
          <span className="sr-only">Название фурнитуры</span>
          <input value={item.label} onChange={(event) => onChange({ label: event.target.value })} />
        </label>
        {item.sourceUrl ? (
          <a href={item.sourceUrl} rel="noreferrer" target="_blank">
            {item.sku ? `AV-24 · арт. ${item.sku}` : 'AV-24 · карточка товара'}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <label className="price-value-field">
        <span className="sr-only">Цена фурнитуры</span>
        <input
          inputMode="decimal"
          min={0}
          step="0.01"
          type="number"
          value={item.price}
          onChange={(event) => {
            const price = Math.max(0, Number(event.target.value) || 0)
            onChange({ price, ...(price > 0 ? { priceOnRequest: false } : {}) })
          }}
        />
        <small>₽/шт.</small>
      </label>
      <label className="shower-hardware-category">
        <span>Группа</span>
        <select
          value={item.sectionId}
          onChange={(event) => onChange({ sectionId: event.target.value as ShowerHardwareSectionId })}
        >
          {showerHardwareSections.map((section) => (
            <option key={section.id} value={section.id}>{section.label}</option>
          ))}
        </select>
      </label>
      <label className="shower-hardware-on-request">
        <input
          checked={Boolean(item.priceOnRequest)}
          type="checkbox"
          onChange={(event) => onChange({ priceOnRequest: event.target.checked })}
        />
        <span>Цена по запросу</span>
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

type ShowerHardwarePickerProps = {
  items: ShowerHardwareItem[]
  value: string
  onChange: (id: string) => void
}

function ShowerHardwarePicker({ items, value, onChange }: ShowerHardwarePickerProps) {
  const selected = items.find((item) => item.id === value) ?? items[0]
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [sectionId, setSectionId] = useState<ShowerHardwareSectionId>(selected?.sectionId ?? 'accessories')
  const filteredItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('ru').replaceAll('ё', 'е')
    const numericQuery = normalizedQuery.replace(/[^\d,.-]/g, '').replace(',', '.')

    return items.filter((item) => {
      if (!normalizedQuery) return item.sectionId === sectionId

      const sectionLabel = showerHardwareSections.find((section) => section.id === item.sectionId)?.label ?? ''
      const searchableText = `${item.label} ${item.sku ?? ''} ${sectionLabel}`
        .toLocaleLowerCase('ru')
        .replaceAll('ё', 'е')
      const matchesPrice = numericQuery.length > 0 && String(item.price).includes(numericQuery)

      return searchableText.includes(normalizedQuery) || matchesPrice
    })
  }, [items, query, sectionId])

  useEffect(() => {
    if (selected?.sectionId) setSectionId(selected.sectionId)
  }, [selected?.sectionId])

  if (!selected) return null

  return (
    <div className="composition-hardware-picker">
      <button
        aria-expanded={isOpen}
        className="composition-hardware-picker-toggle"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>
          <strong>{selected.label}</strong>
          <small>{selected.sku ? `AV-24 · ${selected.sku}` : 'Своя позиция'}</small>
        </span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {selected.sourceUrl ? (
        <a className="composition-hardware-source" href={selected.sourceUrl} rel="noreferrer" target="_blank">
          Открыть на AV-24
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      ) : null}
      {isOpen ? (
        <div className="composition-hardware-picker-panel">
          <div className="composition-hardware-picker-tools">
            <select
              aria-label="Группа фурнитуры"
              value={sectionId}
              onChange={(event) => setSectionId(event.target.value as ShowerHardwareSectionId)}
            >
              {showerHardwareSections.map((section) => (
                <option key={section.id} value={section.id}>{section.label}</option>
              ))}
            </select>
            <label>
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">Поиск фурнитуры</span>
              <input
                autoFocus
                placeholder="Поиск везде: название, артикул, цена"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <button aria-label="Закрыть выбор фурнитуры" type="button" onClick={() => setIsOpen(false)}>
              <X size={16} />
            </button>
          </div>
          <div className="composition-hardware-picker-list">
            {filteredItems.map((item) => {
              const sectionLabel = showerHardwareSections.find((section) => section.id === item.sectionId)?.label

              return (
              <button
                className={item.id === value ? 'is-selected' : ''}
                key={item.id}
                type="button"
                onClick={() => {
                  onChange(item.id)
                  setIsOpen(false)
                  setQuery('')
                }}
              >
                <span>
                  <strong>{item.label}</strong>
                  <small>{[sectionLabel, item.sku ? `арт. ${item.sku}` : 'Своя позиция'].filter(Boolean).join(' · ')}</small>
                </span>
                <b>{item.priceOnRequest ? 'По запросу' : money(item.price)}</b>
              </button>
              )
            })}
            {filteredItems.length === 0 ? <p>Совпадений нет</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}

type ConstructionPriceRowProps = {
  label: string
  basePrice: number
  installationPrice: number
  hardwareComponents: ConstructionHardwareComponent[]
  hardwareItems: ShowerHardwareItem[]
  canDelete: boolean
  onAddHardware: () => void
  onLabelChange: (value: string) => void
  onBasePriceChange: (value: number) => void
  onHardwareChange: (
    componentId: string,
    patch: Partial<Pick<ConstructionHardwareComponent, 'hardwareItemId' | 'quantity' | 'glassThickness'>>,
  ) => void
  onHardwareDelete: (componentId: string) => void
  onInstallationPriceChange: (value: number) => void
  onDelete: () => void
}

function ConstructionPriceRow({
  label,
  basePrice,
  installationPrice,
  hardwareComponents,
  hardwareItems,
  canDelete,
  onAddHardware,
  onLabelChange,
  onBasePriceChange,
  onHardwareChange,
  onHardwareDelete,
  onInstallationPriceChange,
  onDelete,
}: ConstructionPriceRowProps) {
  const componentBaseFor = (thickness: 6 | 8) => hardwareComponents.reduce((sum, component) => {
    if (component.glassThickness && component.glassThickness !== thickness) return sum
    const item = hardwareItems.find((entry) => entry.id === component.hardwareItemId)
    return sum + (item?.price ?? 0) * component.quantity
  }, 0)
  const hasHardwareComposition = hardwareComponents.length > 0
  const componentBase6 = componentBaseFor(6)
  const componentBase8 = componentBaseFor(8)

  return (
    <div className="construction-price-editor">
      <div className="construction-price-row">
        <label className="price-name-field">
          <span className="sr-only">Название конструкции</span>
          <input
            aria-label={`Название конструкции: ${label || 'без названия'}`}
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
          />
        </label>
        {hasHardwareComposition ? (
          <div className="construction-base-summary">
            <span>База по составу</span>
            <strong>6 мм: {money(componentBase6)}</strong>
            <small>8 мм: {money(componentBase8)}</small>
          </div>
        ) : (
          <label className="construction-price-field construction-base-price-field">
            <span>Резервная база</span>
            <div className="price-value-field">
              <input
                aria-label={`Базовая цена: ${label || 'конструкция'}`}
                inputMode="numeric"
                min={0}
                type="number"
                value={basePrice}
                onChange={(event) => onBasePriceChange(Math.max(0, Number(event.target.value) || 0))}
              />
              <small>₽</small>
            </div>
          </label>
        )}
        <label className="construction-price-field construction-installation-field">
          <span>Монтаж</span>
          <div className="price-value-field">
            <input
              aria-label={`Стоимость монтажа: ${label || 'конструкция'}`}
              inputMode="numeric"
              min={0}
              type="number"
              value={installationPrice}
              onChange={(event) => onInstallationPriceChange(Math.max(0, Number(event.target.value) || 0))}
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

      <div className="composition-editor">
        <div className="composition-editor-head">
          <div>
            <strong>Состав фурнитуры</strong>
            <span>Цена конструкции собирается из этих позиций</span>
          </div>
          <button type="button" onClick={onAddHardware}>
            <Plus size={15} />
            Добавить фурнитуру
          </button>
        </div>
        {hardwareComponents.length > 0 ? (
          <div className="composition-item-list">
            {hardwareComponents.map((component) => {
              const item = hardwareItems.find((entry) => entry.id === component.hardwareItemId) ?? hardwareItems[0]
              return (
                <div className="composition-item-row" key={component.id}>
                  <div className="composition-hardware-field">
                    <span>Фурнитура</span>
                    <ShowerHardwarePicker
                      items={hardwareItems}
                      value={component.hardwareItemId}
                      onChange={(hardwareItemId) => onHardwareChange(component.id, { hardwareItemId })}
                    />
                  </div>
                  <label>
                    <span>Количество</span>
                    <input
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      type="number"
                      value={component.quantity}
                      onChange={(event) => onHardwareChange(component.id, {
                        quantity: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                  <label>
                    <span>Толщина</span>
                    <select
                      value={component.glassThickness ?? ''}
                      onChange={(event) => onHardwareChange(component.id, {
                        glassThickness: event.target.value
                          ? Number(event.target.value) as 6 | 8
                          : undefined,
                      })}
                    >
                      <option value="">6 и 8 мм</option>
                      <option value="6">6 мм</option>
                      <option value="8">8 мм</option>
                    </select>
                  </label>
                  <strong>{money((item?.price ?? 0) * component.quantity)}</strong>
                  <button
                    aria-label={`Удалить ${item?.label ?? 'фурнитуру'} из конструкции`}
                    className="price-delete"
                    type="button"
                    onClick={() => onHardwareDelete(component.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="composition-editor-note">
            Состав не заполнен. Пока используется цена из раздела «Резервный класс фурнитуры».
          </p>
        )}
      </div>
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
    <div className="mirror-service-price-row" id={`price-mirror-service-${item.id}`}>
      <div className="mirror-service-name">
        <label className="price-name-field">
          <span className="sr-only">Название работы или комплектующей</span>
          <input value={item.label} onChange={(event) => onChange({ label: event.target.value })} />
        </label>
        {item.sku && item.sourceUrl ? (
          <a href={item.sourceUrl} rel="noreferrer" target="_blank">
            VDSF · арт. {item.sku}
            <ExternalLink size={12} aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <label className="price-value-field">
        <span className="sr-only">Цена работы или комплектующей</span>
        <input
          inputMode="decimal"
          min={0}
          step="0.01"
          type="number"
          value={item.price}
          onChange={(event) => onChange({ price: Math.max(0, Number(event.target.value) || 0) })}
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
        <span>Группа</span>
        <select
          value={item.sectionId}
          onChange={(event) => onChange({ sectionId: event.target.value as MirrorService['sectionId'] })}
        >
          {mirrorServiceSections.map((section) => (
            <option key={section.id} value={section.id}>{section.label}</option>
          ))}
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

type MirrorServiceGroupEditorProps = {
  group: MirrorServiceGroup
  services: MirrorService[]
  onAddItem: () => void
  onChange: (patch: Partial<Pick<MirrorServiceGroup, 'label' | 'visibleInQuote'>>) => void
  onDelete: () => void
  onDeleteItem: (itemId: string) => void
  onItemChange: (itemId: string, patch: Partial<MirrorServiceGroup['items'][number]>) => void
}

function MirrorServiceGroupEditor({
  group,
  services,
  onAddItem,
  onChange,
  onDelete,
  onDeleteItem,
  onItemChange,
}: MirrorServiceGroupEditorProps) {
  return (
    <div className="mirror-group-editor" id={`price-mirror-group-${group.id}`}>
      <div className="mirror-group-editor-head">
        <label className="price-name-field">
          <span>Название группы</span>
          <input value={group.label} onChange={(event) => onChange({ label: event.target.value })} />
        </label>
        <label className="mirror-service-visible">
          <input
            checked={group.visibleInQuote}
            type="checkbox"
            onChange={(event) => onChange({ visibleInQuote: event.target.checked })}
          />
          <span>Показывать группу в КП</span>
        </label>
        <button aria-label={`Удалить группу ${group.label}`} className="price-delete" type="button" onClick={onDelete}>
          <Trash2 size={17} />
        </button>
      </div>

      <div className="composition-editor">
        <div className="composition-editor-head">
          <div>
            <strong>Что входит в группу</strong>
            <span>Цена каждой операции редактируется в разделе «Работы»</span>
          </div>
          <button type="button" onClick={onAddItem}>
            <Plus size={15} />
            Добавить работу
          </button>
        </div>
        {group.items.length > 0 ? (
          <div className="composition-item-list">
            {group.items.map((groupItem) => {
              const service = services.find((entry) => entry.id === groupItem.serviceId) ?? services[0]
              const quantityLabel = service?.unit === 'piece' ? 'Количество' : 'Коэффициент'
              const formulaLabel = service?.unit === 'area'
                ? `площадь × ${groupItem.quantity}`
                : service?.unit === 'perimeter'
                  ? `периметр × ${groupItem.quantity}`
                  : `${groupItem.quantity} шт.`
              return (
                <div className="composition-item-row mirror-group-item-row" key={groupItem.id}>
                  <label>
                    <span>Работа</span>
                    <select
                      value={groupItem.serviceId}
                      onChange={(event) => onItemChange(groupItem.id, { serviceId: event.target.value })}
                    >
                      {services.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>{quantityLabel}</span>
                    <input
                      inputMode="decimal"
                      min={0}
                      step="0.1"
                      type="number"
                      value={groupItem.quantity}
                      onChange={(event) => onItemChange(groupItem.id, {
                        quantity: Math.max(0, Number(event.target.value) || 0),
                      })}
                    />
                  </label>
                  <span className="composition-formula">
                    <strong>{formulaLabel}</strong>
                    <small>{money(service?.price ?? 0)}/{service ? mirrorUnitLabels[service.unit] : 'ед.'}</small>
                  </span>
                  <button
                    aria-label={`Удалить ${service?.label ?? 'работу'} из группы`}
                    className="price-delete"
                    type="button"
                    onClick={() => onDeleteItem(groupItem.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="composition-editor-note">В группу пока ничего не входит.</p>
        )}
      </div>
    </div>
  )
}

function ServiceRow({ label, value, onChange }: ServiceRowProps) {
  return (
    <label className="price-row">
      <span>{label}</span>
      <input inputMode="numeric" min={0} type="number" value={value} onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))} />
      <small> </small>
    </label>
  )
}

type ShowerSketchProps = {
  sketch: Construction['sketch']
}

function ConstructionPreview({ construction }: { construction: Construction }) {
  const thumbnailStyle = getConstructionThumbnailStyle(construction.id)

  return (
    <span className="construction-preview">
      {thumbnailStyle ? (
        <span
          className="reference-shower-thumbnail"
          style={thumbnailStyle}
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
