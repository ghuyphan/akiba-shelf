import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../../styles/catalog/catalog.css";
import { createPortal, flushSync } from "react-dom";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  GripVertical,
  Languages,
  LayoutTemplate,
  Link2,
  Maximize2,
  MessageSquareText,
  Minus,
  Monitor,
  Palette,
  Plus,
  QrCode,
  Redo2,
  RotateCcw,
  Save,
  Smartphone,
  Store,
  Type,
  Undo2,
} from "lucide-react";
import type {
  BoothSettings,
  PaymentSettings,
  Product,
  StorefrontSection,
} from "../../../types/catalog";
import {
  getStorefrontSectionStyleClass,
  getThemeStyle,
} from "../../../utils/theme";
import { CatalogLocaleProvider } from "../../../lib/i18n/catalogLocale";
import type { PublicProductSort } from "../../../lib/catalogQueries";
import { useAsyncAction } from "../../../hooks/shared/useAsyncAction";
import { useToast } from "../../ui/ToastProvider";
import { Button } from "../../ui/Button";
import { Field, TextArea, TextInput } from "../../ui/Field";
import { SelectMenu } from "../../ui/SelectMenu";
import { StorefrontThemeColorPicker } from "../shared/StorefrontThemeColorPicker";
import { RangeInput } from "../../ui/RangeInput";
import { CatalogHeader } from "../../catalog/shell/CatalogHeader";
import { CategoryFilters } from "../../catalog/browsing/CategoryFilters";
import { CatalogToolbar } from "../../catalog/browsing/CatalogToolbar";
import { ProductGrid } from "../../catalog/browsing/ProductGrid";
import { StackedFeatured } from "../../catalog/browsing/StackedFeatured";
import { BoothInfoPanel } from "../../catalog/shell/BoothInfoPanel";
import { SelectedItemPanel } from "../../catalog/cart/SelectedItemPanel";
import { ImageUpload } from "../shared/ImageUpload";
import {
  getBankLogoUrl,
  getPaymentBank,
  getVietQrBanks,
} from "../../../utils/banks";
import {
  DEFAULT_STOREFRONT_PALETTE,
  STOREFRONT_PALETTES,
} from "../../../lib/constants";
import { usePlatformI18n } from "../../../lib/i18n/platformI18n";
import { getUserFacingErrorMessage } from "../../../lib/errors";
import { SocialLinkFields } from "../settings/SocialLinkFields";
import { Alert } from "../../ui/Alert";
import { useAdminUnsavedChanges } from "../shell/AdminUnsavedChanges";
import { useTabIndicator } from "../../../hooks/shared/useTabIndicator";
import { DesignerStyleOptions } from "./DesignerStyleOptions";
import { useStorefrontDesignerDraft } from "../../../hooks/admin/useStorefrontDesignerDraft";

type StorefrontDesignerProps = {
  shopId: string;
  settings: BoothSettings;
  products: Product[];
  payment: PaymentSettings;
  onSave: (settings: BoothSettings) => Promise<void>;
  onSavePayment: (settings: PaymentSettings) => Promise<void>;
};

type InspectorTab = "layout" | "content" | "style";
type PreviewDevice = "desktop" | "phone";
type PreviewZoom = "fit" | number;
type DropEdge = "before" | "after";
type DropTarget = { section: StorefrontSection; edge: DropEdge };
type SelectedSection = StorefrontSection;
type CanvasPan = {
  pointerId: number;
  x: number;
  y: number;
  scrollLeft: number;
  scrollTop: number;
  source: "stage" | "preview";
};

const allowedSections: StorefrontSection[] = [
  "featured",
  "booth",
  "controls",
  "products",
  "cart",
];
const sectionMeta: Record<
  StorefrontSection,
  { title: string; description: string; size: string }
> = {
  featured: {
    title: "Featured spotlight",
    description: "Promoted products and swipe deck",
    size: "Wide",
  },
  booth: {
    title: "Booth information",
    description: "Location, hours, and social QR codes",
    size: "Side",
  },
  controls: {
    title: "Browse controls",
    description: "Categories, search, sort, and view mode",
    size: "Wide",
  },
  cart: {
    title: "Shopping cart",
    description: "Cart, bank details, transfer note, and QR",
    size: "Side",
  },
  products: {
    title: "Product collection",
    description: "The complete item grid or list",
    size: "Wide",
  },
};

const featuredStyleOptions = [
  ["deck", "Swipe deck", "Layered cards and soft orbit"],
  ["editorial", "Editorial", "Clean magazine layout"],
  ["minimal", "Minimal", "Quiet and product-first"],
  ["poster", "Pop poster", "Bold color and energy"],
] as const;
const controlsStyleOptions = [
  ["panel", "Panel", "Everything in one surface"],
  ["floating", "Floating", "Light and open"],
  ["compact", "Compact", "More catalog, less chrome"],
  ["playful", "Playful", "Tinted with an offset shadow"],
] as const;
const productStyleOptions = [
  ["classic", "Classic", "Balanced shop cards"],
  ["minimal", "Minimal", "Flat and spacious"],
  ["framed", "Framed", "Inset product photography"],
  ["playful", "Playful", "Colorful collectible cards"],
] as const;
const inspectorTabs = [
  ["layout", LayoutTemplate, "Layout"],
  ["content", Type, "Content"],
  ["style", Palette, "Style"],
] as const;

function normalizedOrder(order?: StorefrontSection[]) {
  return order?.length === allowedSections.length &&
    allowedSections.every((item) => order.includes(item))
    ? order
    : allowedSections;
}

export function StorefrontDesigner({
  shopId,
  settings,
  products,
  payment,
  onSave,
  onSavePayment,
}: StorefrontDesignerProps) {
  const [dragged, setDragged] = useState<StorefrontSection | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [selected, setSelected] = useState<SelectedSection>("featured");
  const [tab, setTab] = useState<InspectorTab>("layout");
  const { containerRef: inspectorTabsRef, registerItem: registerInspectorTab } =
    useTabIndicator<InspectorTab, HTMLDivElement>(tab);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [device, setDevice] = useState<PreviewDevice>("desktop");
  const [fitScale, setFitScale] = useState(0.5);
  const [previewZoom, setPreviewZoom] = useState<PreviewZoom>("fit");
  const previewStageRef = useRef<HTMLDivElement>(null);
  const previewIframeRef = useRef<HTMLIFrameElement>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const draggedRef = useRef<StorefrontSection | null>(null);
  const zoomRef = useRef(50);
  const pinchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; zoom: number } | null>(null);
  const canvasPanRef = useRef<CanvasPan | null>(null);
  const spacePressedRef = useRef(false);
  const canvasHoverRef = useRef(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [canvasPanning, setCanvasPanning] = useState(false);
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewSort, setPreviewSort] =
    useState<PublicProductSort>("recommended");
  const [previewView, setPreviewView] = useState<"grid" | "list">("grid");
  const [publishNotice, setPublishNotice] = useState("");
  const { busy, error, run, setError } = useAsyncAction();
  const toast = useToast();
  const { t } = usePlatformI18n();
  const clearDesignerError = useCallback(() => setError(""), [setError]);
  const {
    draft,
    paymentDraft,
    draftRef,
    paymentDraftRef,
    history,
    future,
    syncNotice,
    setSyncNotice,
    hasChanges,
    commitSnapshot,
    undo,
    redo,
    discardChanges,
    clearHistory,
  } = useStorefrontDesignerDraft({
    shopId,
    settings,
    payment,
    clearError: clearDesignerError,
  });
  useEffect(() => {
    if (error) {
      toast.error(
        t(getUserFacingErrorMessage(error, "Could not publish")),
        t("Could not publish"),
      );
      setError("");
    }
  }, [error, setError, t, toast]);
  const order = normalizedOrder(draft.layout_order);

  function handleInspectorTabKeyDown(
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: InspectorTab,
  ) {
    const currentIndex = inspectorTabs.findIndex(
      ([value]) => value === currentTab,
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight")
      nextIndex = (currentIndex + 1) % inspectorTabs.length;
    else if (event.key === "ArrowLeft")
      nextIndex =
        (currentIndex - 1 + inspectorTabs.length) % inspectorTabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = inspectorTabs.length - 1;
    else return;
    event.preventDefault();
    setTab(inspectorTabs[nextIndex][0]);
    const buttons =
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        '[role="tab"]',
      );
    buttons?.[nextIndex]?.focus();
  }

  useEffect(() => {
    const stage = previewStageRef.current;
    if (!stage) return undefined;
    const previewWidth = device === "phone" ? 390 : 1380;
    const updateScale = () => {
      const availableWidth = Math.max(0, stage.clientWidth - 56);
      const availableHeight = Math.max(0, stage.clientHeight - 56);
      const previewHeight = device === "phone" ? 844 : 1120;
      setFitScale(
        Math.min(
          1,
          availableWidth / previewWidth,
          availableHeight / previewHeight,
        ),
      );
    };
    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [device, sidebarOpen]);

  useEffect(() => {
    if (!previewDocument) return undefined;
    previewDocument.body.className = `designer-preview-document device-${device}`;
    previewDocument.body.classList.toggle(
      "is-canvas-pan-ready",
      spacePressedRef.current,
    );
    previewDocument.body.style.setProperty(
      "--preview-width",
      `${device === "phone" ? 390 : 1380}px`,
    );

    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const iframe = previewIframeRef.current;
      const stage = previewStageRef.current;
      if (!iframe || !stage) return;
      const iframeRect = iframe.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      adjustZoom(event.deltaY > 0 ? -5 : 5, {
        x: iframeRect.left - stageRect.left + event.clientX * previewScale,
        y: iframeRect.top - stageRect.top + event.clientY * previewScale,
      });
    };
    const pointerDown = (event: PointerEvent) => {
      if (
        event.pointerType !== "touch" &&
        event.button !== 1 &&
        !spacePressedRef.current
      )
        return;
      if (event.pointerType !== "touch") {
        event.preventDefault();
        event.stopPropagation();
      }
      (
        event.target as {
          setPointerCapture?: (pointerId: number) => void;
        } | null
      )?.setPointerCapture?.(event.pointerId);
      pinchPointsRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      if (pinchPointsRef.current.size === 1) {
        const stage = previewStageRef.current;
        canvasPanRef.current = {
          pointerId: event.pointerId,
          x: event.clientX,
          y: event.clientY,
          scrollLeft: stage?.scrollLeft ?? 0,
          scrollTop: stage?.scrollTop ?? 0,
          source: "preview",
        };
        setCanvasPanning(true);
        previewDocument.body.classList.add("is-canvas-panning");
      } else {
        updatePinchCoordinates(event);
      }
    };
    const pointerMove = (event: PointerEvent) =>
      event.pointerType === "touch"
        ? updatePinchCoordinates(event)
        : moveCanvasPan(
            event.pointerId,
            event.clientX,
            event.clientY,
            "preview",
          );
    const pointerEnd = (event: PointerEvent) => endPinchCoordinates(event);
    previewDocument.addEventListener("wheel", wheel, { passive: false });
    previewDocument.addEventListener("pointerdown", pointerDown, true);
    previewDocument.addEventListener("pointermove", pointerMove);
    previewDocument.addEventListener("pointerup", pointerEnd);
    previewDocument.addEventListener("pointercancel", pointerEnd);
    return () => {
      previewDocument.removeEventListener("wheel", wheel);
      previewDocument.removeEventListener("pointerdown", pointerDown, true);
      previewDocument.removeEventListener("pointermove", pointerMove);
      previewDocument.removeEventListener("pointerup", pointerEnd);
      previewDocument.removeEventListener("pointercancel", pointerEnd);
    };
    // Gesture helpers intentionally read current refs; rebinding on every render would interrupt an active pinch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewDocument, device]);

  useEffect(() => {
    const isEditableTarget = (target: EventTarget | null) =>
      Boolean(
        (
          target as { closest?: (selector: string) => Element | null } | null
        )?.closest?.("input, textarea, select, [contenteditable='true']"),
      );
    const updateSpace = (pressed: boolean) => {
      spacePressedRef.current = pressed;
      setSpacePressed(pressed);
      previewDocument?.body.classList.toggle("is-canvas-pan-ready", pressed);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        (isEditableTarget(event.target) &&
          !canvasHoverRef.current &&
          event.currentTarget !== previewDocument)
      )
        return;
      if (canvasHoverRef.current || event.currentTarget === previewDocument)
        event.preventDefault();
      updateSpace(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") updateSpace(false);
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("keyup", onKeyUp);
    previewDocument?.addEventListener("keydown", onKeyDown);
    previewDocument?.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("keyup", onKeyUp);
      previewDocument?.removeEventListener("keydown", onKeyDown);
      previewDocument?.removeEventListener("keyup", onKeyUp);
    };
  }, [previewDocument]);

  useEffect(() => {
    if (previewZoom !== "fit") return;
    const frame = window.requestAnimationFrame(() => centerPreview());
    return () => window.cancelAnimationFrame(frame);
    // centerPreview reads the current canvas dimensions after fitScale settles.
  }, [device, fitScale, previewZoom, sidebarOpen]);

  const previewScale = previewZoom === "fit" ? fitScale : previewZoom / 100;
  const displayedZoom = Math.round(previewScale * 100);
  zoomRef.current = displayedZoom;

  const previewProducts = useMemo(() => {
    const active = products.filter((product) => product.active).slice(0, 6);
    if (active.some((product) => product.featured) || active.length === 0)
      return active;
    return active.map((product, index) =>
      index === 0 ? { ...product, featured: true } : product,
    );
  }, [products]);
  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(previewProducts.map((product) => product.category)),
      ).filter(Boolean),
    ],
    [previewProducts],
  );
  const previewCartProduct = previewProducts.find(
    (product) => product.quantity_available > 0,
  );
  const banks = getVietQrBanks();
  const selectedBank = getPaymentBank(
    paymentDraft.bank_code,
    paymentDraft.bank_acq_id,
  );
  const paymentAccountReady = Boolean(
    selectedBank &&
      paymentDraft.bank_account_no?.trim() &&
      paymentDraft.bank_account_name?.trim(),
  );
  useAdminUnsavedChanges(`designer:${shopId}`, hasChanges, discardChanges);

  function update<K extends keyof BoothSettings>(
    key: K,
    value: BoothSettings[K],
  ) {
    commitSnapshot({
      booth: { ...draftRef.current, [key]: value },
      payment: paymentDraftRef.current,
    });
  }

  function updateLogo(url: string, path?: string) {
    commitSnapshot({
      booth: {
        ...draftRef.current,
        logo_url: url,
        logo_path: path,
      },
      payment: paymentDraftRef.current,
    });
  }

  function updatePayment<K extends keyof PaymentSettings>(
    key: K,
    value: PaymentSettings[K],
  ) {
    commitSnapshot({
      booth: draftRef.current,
      payment: { ...paymentDraftRef.current, [key]: value },
    });
  }

  function applyPalette(palette: (typeof STOREFRONT_PALETTES)[number]) {
    commitSnapshot({
      booth: {
        ...draftRef.current,
        theme_primary: palette.primary,
        theme_secondary: palette.secondary,
        theme_accent: palette.accent,
        theme_background: palette.background,
      },
      payment: paymentDraftRef.current,
    });
  }

  function resetDraft() {
    if (!hasChanges) return;
    discardChanges();
    setPublishNotice("");
  }

  function move(
    section: StorefrontSection,
    target: StorefrontSection,
    edge?: DropEdge,
  ) {
    if (section === target) return;
    const sourceIndex = order.indexOf(section);
    const targetIndex = order.indexOf(target);
    const next = order.filter((item) => item !== section);
    const insertionIndex =
      next.indexOf(target) +
      (edge ? Number(edge === "after") : Number(sourceIndex < targetIndex));
    next.splice(insertionIndex, 0, section);
    const applyMove = () => update("layout_order", next);
    const transitionDocument = document as Document & {
      startViewTransition?: (callback: () => void) => void;
    };
    if (transitionDocument.startViewTransition) {
      transitionDocument.startViewTransition(() => flushSync(applyMove));
    } else {
      applyMove();
    }
  }

  function nudge(section: StorefrontSection, direction: -1 | 1) {
    const index = order.indexOf(section);
    const target = index + direction;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    update("layout_order", next);
  }

  function beginDrag(event: React.DragEvent, section: StorefrontSection) {
    draggedRef.current = section;
    setDragged(section);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", section);
    const ownerDocument = event.currentTarget.ownerDocument;
    const ghost = ownerDocument.createElement("div");
    ghost.className = "designer-drag-ghost";
    ghost.textContent = sectionMeta[section].title;
    ownerDocument.body.appendChild(ghost);
    event.dataTransfer.setDragImage(ghost, 18, 18);
    window.requestAnimationFrame(() => ghost.remove());
    ownerDocument.body.classList.add("is-designer-dragging");
    document.body.classList.add("is-designer-dragging");
  }

  function endDrag() {
    draggedRef.current = null;
    setDragged(null);
    setDropTarget(null);
    document.body.classList.remove("is-designer-dragging");
    previewDocument?.body.classList.remove("is-designer-dragging");
  }

  function dropOn(event: React.DragEvent, target: StorefrontSection) {
    event.preventDefault();
    const source =
      draggedRef.current ??
      (event.dataTransfer.getData("text/plain") as StorefrontSection);
    let edge = dropTarget?.section === target ? dropTarget.edge : "before";
    const sourceIndex = order.indexOf(source);
    const targetIndex = order.indexOf(target);
    if (sourceIndex === targetIndex + 1 && edge === "after") edge = "before";
    if (sourceIndex === targetIndex - 1 && edge === "before") edge = "after";
    if (source && allowedSections.includes(source)) move(source, target, edge);
    setSelected(target);
    endDrag();
  }

  function markDropTarget(
    event: React.DragEvent,
    section: StorefrontSection,
    orientation: "horizontal" | "vertical",
  ) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (draggedRef.current === section) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const edge =
      orientation === "horizontal"
        ? event.clientX < rect.left + rect.width / 2
          ? "before"
          : "after"
        : event.clientY < rect.top + rect.height / 2
          ? "before"
          : "after";
    setDropTarget((current) =>
      current?.section === section && current.edge === edge
        ? current
        : { section, edge },
    );
  }

  function applyZoom(nextZoom: number, focus?: { x: number; y: number }) {
    const clamped = Math.max(20, Math.min(150, nextZoom));
    const stage = previewStageRef.current;
    const oldScale = Math.max(0.2, zoomRef.current / 100);
    const focusX = focus?.x ?? (stage?.clientWidth ?? 0) / 2;
    const focusY = focus?.y ?? (stage?.clientHeight ?? 0) / 2;
    const anchorX = stage ? stage.scrollLeft + focusX : focusX;
    const anchorY = stage ? stage.scrollTop + focusY : focusY;
    zoomRef.current = clamped;
    setPreviewZoom(clamped);
    window.requestAnimationFrame(() => {
      if (!stage) return;
      const nextScale = clamped / 100;
      stage.scrollLeft = Math.max(0, (anchorX * nextScale) / oldScale - focusX);
      stage.scrollTop = Math.max(0, (anchorY * nextScale) / oldScale - focusY);
    });
  }

  function adjustZoom(delta: number, focus?: { x: number; y: number }) {
    applyZoom(Math.round(zoomRef.current / 5) * 5 + delta, focus);
  }

  function fitPreview() {
    setPreviewZoom("fit");
    window.requestAnimationFrame(() => centerPreview("smooth"));
  }

  function changeDevice(nextDevice: PreviewDevice) {
    setDevice(nextDevice);
    setPreviewZoom("fit");
    window.requestAnimationFrame(() => centerPreview("smooth"));
  }

  function centerPreview(behavior: ScrollBehavior = "auto") {
    const stage = previewStageRef.current;
    if (!stage) return;
    const left = Math.max(0, (stage.scrollWidth - stage.clientWidth) / 2);
    const top = Math.max(0, (stage.scrollHeight - stage.clientHeight) / 2);
    if (typeof stage.scrollTo === "function")
      stage.scrollTo({ left, top, behavior });
    else {
      stage.scrollLeft = left;
      stage.scrollTop = top;
    }
  }

  function beginCanvasPan(
    pointerId: number,
    x: number,
    y: number,
    source: CanvasPan["source"],
  ) {
    const stage = previewStageRef.current;
    canvasPanRef.current = {
      pointerId,
      x,
      y,
      scrollLeft: stage?.scrollLeft ?? 0,
      scrollTop: stage?.scrollTop ?? 0,
      source,
    };
    setCanvasPanning(true);
    previewDocument?.body.classList.add("is-canvas-panning");
  }

  function moveCanvasPan(
    pointerId: number,
    x: number,
    y: number,
    source: CanvasPan["source"],
  ) {
    const pan = canvasPanRef.current;
    const stage = previewStageRef.current;
    if (!pan || pan.pointerId !== pointerId || pan.source !== source || !stage)
      return;
    stage.scrollLeft = pan.scrollLeft - (x - pan.x);
    stage.scrollTop = pan.scrollTop - (y - pan.y);
  }

  function endCanvasPan(pointerId: number) {
    if (canvasPanRef.current?.pointerId !== pointerId) return;
    canvasPanRef.current = null;
    setCanvasPanning(false);
    previewDocument?.body.classList.remove("is-canvas-panning");
  }

  function handleStagePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const isCanvasSurface = event.target === event.currentTarget;
    if (
      event.pointerType !== "touch" &&
      event.button !== 1 &&
      !(spacePressedRef.current || isCanvasSurface)
    )
      return;
    event.preventDefault();
    beginCanvasPan(event.pointerId, event.clientX, event.clientY, "stage");
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleStagePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    moveCanvasPan(event.pointerId, event.clientX, event.clientY, "stage");
  }

  function handleStagePointerEnd(event: React.PointerEvent<HTMLDivElement>) {
    endCanvasPan(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function handleStageWheel(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    adjustZoom(event.deltaY > 0 ? -5 : 5, {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  }

  function updatePinchCoordinates(
    event: Pick<
      PointerEvent,
      "pointerType" | "pointerId" | "clientX" | "clientY"
    >,
  ) {
    if (event.pointerType !== "touch") return;
    pinchPointsRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (
      pinchPointsRef.current.size === 1 &&
      canvasPanRef.current?.pointerId === event.pointerId
    ) {
      const stage = previewStageRef.current;
      if (stage) {
        stage.scrollLeft =
          canvasPanRef.current.scrollLeft -
          (event.clientX - canvasPanRef.current.x);
        stage.scrollTop =
          canvasPanRef.current.scrollTop -
          (event.clientY - canvasPanRef.current.y);
      }
      return;
    }
    if (pinchPointsRef.current.size !== 2) return;
    canvasPanRef.current = null;
    setCanvasPanning(false);
    const [first, second] = [...pinchPointsRef.current.values()];
    const distance = Math.hypot(second.x - first.x, second.y - first.y);
    if (!pinchStartRef.current) {
      pinchStartRef.current = { distance, zoom: zoomRef.current };
      return;
    }
    const nextZoom =
      (pinchStartRef.current.zoom * distance) /
      Math.max(1, pinchStartRef.current.distance);
    const iframe = previewIframeRef.current;
    const stage = previewStageRef.current;
    const point =
      iframe && stage
        ? {
            x:
              iframe.getBoundingClientRect().left -
              stage.getBoundingClientRect().left +
              ((first.x + second.x) / 2) * previewScale,
            y:
              iframe.getBoundingClientRect().top -
              stage.getBoundingClientRect().top +
              ((first.y + second.y) / 2) * previewScale,
          }
        : undefined;
    applyZoom(Math.round(nextZoom), point);
  }

  function endPinchCoordinates(event: Pick<PointerEvent, "pointerId">) {
    pinchPointsRef.current.delete(event.pointerId);
    if (pinchPointsRef.current.size < 2) pinchStartRef.current = null;
    endCanvasPan(event.pointerId);
  }

  function selectModule(section: StorefrontSection) {
    setSelected(section);
    setSidebarOpen(true);
    setTab("content");
  }

  async function save() {
    setPublishNotice("");
    await run(async () => {
      const boothChanged = JSON.stringify(draft) !== JSON.stringify(settings);
      const paymentChanged =
        JSON.stringify(paymentDraft) !== JSON.stringify(payment);
      const [boothResult, paymentResult] = await Promise.all([
        boothChanged
          ? onSave({ ...draft, layout_order: order }).then(
              () => ({ status: "fulfilled" as const }),
              (reason) => ({ status: "rejected" as const, reason }),
            )
          : Promise.resolve({ status: "skipped" as const }),
        paymentChanged
          ? onSavePayment(paymentDraft).then(
              () => ({ status: "fulfilled" as const }),
              (reason) => ({ status: "rejected" as const, reason }),
            )
          : Promise.resolve({ status: "skipped" as const }),
      ]);

      const boothFailed = boothResult.status === "rejected";
      const paymentFailed = paymentResult.status === "rejected";
      if (boothFailed || paymentFailed) {
        setPublishNotice(
          boothFailed && paymentFailed
            ? t(
                "Storefront and payment settings were not published. Your edits are still here.",
              )
            : boothFailed
              ? t(
                  "Storefront settings were not published. Payment changes were saved, and your storefront edits are still here.",
                )
              : t(
                  "Payment settings were not published. Storefront changes were saved, and your payment edits are still here.",
                ),
        );
        const failure =
          boothResult.status === "rejected"
            ? boothResult.reason
            : paymentResult.status === "rejected"
              ? paymentResult.reason
              : new Error("Could not publish all changes");
        throw failure;
      }
      clearHistory();
    }).catch(() => undefined);
  }

  const previewBlocks: Record<StorefrontSection, React.ReactNode> = {
    featured: (
      <StackedFeatured
        products={previewProducts}
        onSelect={() => undefined}
        autoRotate={draft.featured_autoplay ?? true}
      />
    ),
    controls: (
      <div className="catalog-controls">
        <CategoryFilters
          categories={categories}
          activeCategory="All"
          onChange={() => undefined}
        />
        <CatalogToolbar
          searchQuery={previewSearch}
          onSearchChange={setPreviewSearch}
          sort={previewSort}
          viewMode={previewView}
          onSortChange={setPreviewSort}
          onViewModeChange={setPreviewView}
        />
      </div>
    ),
    products: (
      <ProductGrid
        products={previewProducts}
        totalProducts={previewProducts.length}
        activeCategory="All"
        viewMode={previewView}
        onSelect={() => undefined}
        onViewDetails={() => undefined}
        onResetFilters={() => undefined}
      />
    ),
    booth: <BoothInfoPanel booth={draft} />,
    cart: (
      <SelectedItemPanel
        cart={
          previewCartProduct
            ? [{ product: previewCartProduct, quantity: 1 }]
            : []
        }
        onQuantityChange={() => undefined}
        onRemove={() => undefined}
        onOpenPayment={() => undefined}
        onClearCart={() => undefined}
      />
    ),
  };
  const heroPreviewSections = order.filter(
    (section) => section === "featured" || section === "booth",
  );
  const mainPreviewSections = order.filter(
    (section) => section === "controls" || section === "products",
  );
  const sidePreviewSections = order.filter((section) => section === "cart");

  function renderModule(section: StorefrontSection) {
    return (
      <div
        key={section}
        className={`storefront-module storefront-module-${section} ${getStorefrontSectionStyleClass(section, draft)} designer-live-module ${section === "featured" || section === "booth" ? "drop-axis-horizontal" : "drop-axis-vertical"} ${selected === section ? "is-selected" : ""} ${dragged === section ? "is-dragging" : ""} ${dropTarget?.section === section && dragged !== section ? `is-drag-over drop-${dropTarget.edge}` : ""}`}
        style={
          { viewTransitionName: `designer-${section}` } as React.CSSProperties
        }
        onDragOver={(event) =>
          markDropTarget(
            event,
            section,
            section === "featured" || section === "booth"
              ? "horizontal"
              : "vertical",
          )
        }
        onDrop={(event) => dropOn(event, section)}
      >
        <button
          type="button"
          className="designer-module-handle"
          draggable
          onClick={(event) => {
            event.stopPropagation();
            selectModule(section);
          }}
          onDragStart={(event) => beginDrag(event, section)}
          onDragEnd={endDrag}
          aria-label={t("Edit {{section}}", {
            section: t(sectionMeta[section].title),
          })}
        >
          <GripVertical size={15} />
          <i>{order.indexOf(section) + 1}</i>
          <span>{t(sectionMeta[section].title)}</span>
          {section === "cart" && (
            <em>
              <CreditCard size={11} /> {t("Payment settings")}
            </em>
          )}
        </button>
        {previewBlocks[section]}
      </div>
    );
  }

  const contentPreviewColumns = [
    {
      position:
        mainPreviewSections.reduce(
          (sum, section) => sum + order.indexOf(section),
          0,
        ) / mainPreviewSections.length,
      node: (
        <section key="main" className="storefront-content-main">
          {mainPreviewSections.map(renderModule)}
        </section>
      ),
    },
    {
      position: order.indexOf("cart") - 0.01,
      node: (
        <section key="side" className="storefront-content-side">
          {sidePreviewSections.map(renderModule)}
        </section>
      ),
    },
  ].sort((first, second) => first.position - second.position);

  function loadPreviewFrame(event: React.SyntheticEvent<HTMLIFrameElement>) {
    const frameDocument = event.currentTarget.contentDocument;
    if (!frameDocument) return;
    frameDocument.head
      .querySelectorAll("[data-designer-style]")
      .forEach((node) => node.remove());
    document
      .querySelectorAll('style, link[rel="stylesheet"]')
      .forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        clone.dataset.designerStyle = "true";
        frameDocument.head.appendChild(clone);
      });
    const baseStyle = frameDocument.createElement("style");
    baseStyle.dataset.designerStyle = "true";
    baseStyle.textContent =
      "html,body,#designer-preview-root{margin:0;min-height:100%;}body{overflow:auto;}";
    frameDocument.head.appendChild(baseStyle);
    setPreviewDocument(frameDocument);
  }

  return (
    <section
      className={`storefront-builder admin-surface ${sidebarOpen ? "sidebar-open" : "sidebar-closed"}`}
    >
      <aside className="builder-sidebar admin-surface">
        <div className="builder-sidebar-head">
          <span className="builder-logo">
            <LayoutTemplate size={18} />
          </span>
          {sidebarOpen && (
            <div>
              <strong>{t("Storefront builder")}</strong>
              <small>
                {t("Use a section handle in the preview to edit it.")}
              </small>
            </div>
          )}
          <button
            type="button"
            className="builder-collapse"
            onClick={() => setSidebarOpen((open) => !open)}
            aria-label={t(
              sidebarOpen
                ? "Collapse builder sidebar"
                : "Expand builder sidebar",
            )}
          >
            {sidebarOpen ? (
              <ChevronLeft size={17} />
            ) : (
              <ChevronRight size={17} />
            )}
          </button>
        </div>

        {sidebarOpen && (
          <>
            <div
              className="builder-tabs admin-segmented-control admin-segmented-tabs"
              ref={inspectorTabsRef}
              role="tablist"
              aria-label={t("Builder tools")}
            >
              {inspectorTabs.map(([value, Icon, label]) => (
                <button
                  key={value}
                  id={`builder-tab-${value}`}
                  type="button"
                  role="tab"
                  ref={registerInspectorTab(value)}
                  className={tab === value ? "active" : ""}
                  aria-selected={tab === value}
                  aria-controls={`builder-panel-${value}`}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                  onKeyDown={(event) => handleInspectorTabKeyDown(event, value)}
                >
                  <Icon size={15} />
                  {t(label)}
                </button>
              ))}
            </div>

            <div
              className="builder-inspector"
              id={`builder-panel-${tab}`}
              role="tabpanel"
              aria-labelledby={`builder-tab-${tab}`}
            >
              {tab === "layout" && (
                <>
                  <div className="builder-section-heading">
                    <div>
                      <strong>{t("Page sections")}</strong>
                      <small>{t("Drag to reorder the public page.")}</small>
                    </div>
                  </div>
                  <div className="designer-block-list">
                    {order.map((section, index) => (
                      <article
                        key={section}
                        data-designer-section={section}
                        style={
                          {
                            viewTransitionName: `designer-list-${section}`,
                          } as React.CSSProperties
                        }
                        onDragOver={(event) =>
                          markDropTarget(event, section, "vertical")
                        }
                        onDrop={(event) => dropOn(event, section)}
                        className={`${dragged === section ? "dragging" : ""} ${dropTarget?.section === section && dragged !== section ? `drag-over drop-${dropTarget.edge}` : ""} ${selected === section ? "selected" : ""}`}
                      >
                        <button
                          type="button"
                          className="designer-list-grip"
                          draggable
                          onDragStart={(event) => beginDrag(event, section)}
                          onDragEnd={endDrag}
                          aria-label={t("Drag {{section}}", {
                            section: t(sectionMeta[section].title),
                          })}
                        >
                          <GripVertical size={17} />
                        </button>
                        <button
                          type="button"
                          className="designer-list-select"
                          onClick={() => selectModule(section)}
                          aria-label={t("Edit {{section}}", {
                            section: t(sectionMeta[section].title),
                          })}
                        >
                          <span>
                            <strong>
                              {index + 1}. {t(sectionMeta[section].title)}
                            </strong>
                            <small>{t(sectionMeta[section].description)}</small>
                          </span>
                        </button>
                        <em>{t(sectionMeta[section].size)}</em>
                        <div>
                          <button
                            type="button"
                            disabled={index === 0}
                            onClick={() => nudge(section, -1)}
                            aria-label={t("Move {{section}} up", {
                              section: t(sectionMeta[section].title),
                            })}
                          >
                            <ArrowUp size={14} />
                          </button>
                          <button
                            type="button"
                            disabled={index === order.length - 1}
                            onClick={() => nudge(section, 1)}
                            aria-label={t("Move {{section}} down", {
                              section: t(sectionMeta[section].title),
                            })}
                          >
                            <ArrowDown size={14} />
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                  <p className="builder-help">
                    {t(
                      "Wide and side modules keep safe column widths. Dragging changes their order within those responsive lanes.",
                    )}
                  </p>
                </>
              )}

              {tab === "content" && (
                <div className="builder-fields">
                  <div className="builder-section-heading">
                    <div>
                      <strong>{t(sectionMeta[selected].title)}</strong>
                      <small>
                        {t("Only settings for the selected section are shown.")}
                      </small>
                    </div>
                  </div>
                  {selected === "featured" && (
                    <div className="builder-fields">
                      <p className="builder-empty-inspector">
                        {t(
                          "The Featured banner displays details directly from active featured products. Mark products as Featured in the Products workspace.",
                        )}
                      </p>
                      <div className="builder-field-group">
                        <h3>
                          <Palette size={15} /> {t("Banner style")}
                        </h3>
                        <DesignerStyleOptions
                          options={featuredStyleOptions}
                          value={draft.featured_style ?? "deck"}
                          sampleClassName={(value) =>
                            `section-style-sample sample-featured-${value}`
                          }
                          translate={t}
                          onChange={(value) => update("featured_style", value)}
                        />
                      </div>
                      <label
                        className="builder-toggle"
                        htmlFor="designer-featured-autoplay"
                      >
                        <span>
                          <strong>{t("Auto-rotate products")}</strong>
                          <small>
                            {t(
                              "Rotate featured items every 4.5 seconds after the customer first interacts. Pauses while they browse and respects reduced motion.",
                            )}
                          </small>
                        </span>
                        <input
                          id="designer-featured-autoplay"
                          type="checkbox"
                          aria-label={t("Auto-rotate products")}
                          checked={draft.featured_autoplay ?? true}
                          onChange={(event) =>
                            update("featured_autoplay", event.target.checked)
                          }
                        />
                      </label>
                    </div>
                  )}
                  {selected === "booth" && (
                    <>
                      <div className="builder-field-group">
                        <h3>
                          <Store size={15} /> {t("Booth identity")}
                        </h3>
                        <div className="designer-identity-card">
                          <div className="designer-identity-preview">
                            <span className="designer-identity-logo">
                              {draft.logo_url ? (
                                <img src={draft.logo_url} alt="" />
                              ) : (
                                <Store size={20} />
                              )}
                            </span>
                            <span className="designer-identity-copy">
                              <strong>
                                {draft.booth_name || t("Booth name")}
                              </strong>
                              <small>
                                {draft.subtitle ||
                                  t("Customer-facing booth subtitle")}
                              </small>
                            </span>
                            <em>{t("Public")}</em>
                          </div>
                          <div className="designer-card-fields">
                            <Field label={t("Booth name")}>
                              <TextInput
                                value={draft.booth_name}
                                onChange={(event) =>
                                  update("booth_name", event.target.value)
                                }
                              />
                            </Field>
                            <Field label={t("Header subtitle")}>
                              <TextInput
                                value={draft.subtitle}
                                onChange={(event) =>
                                  update("subtitle", event.target.value)
                                }
                              />
                            </Field>
                            <div className="builder-field-row">
                              <Field label={t("Booth code")}>
                                <TextInput
                                  value={draft.booth_code}
                                  onChange={(event) =>
                                    update("booth_code", event.target.value)
                                  }
                                />
                              </Field>
                              <Field label={t("Open hours")}>
                                <TextInput
                                  value={draft.open_hours}
                                  onChange={(event) =>
                                    update("open_hours", event.target.value)
                                  }
                                />
                              </Field>
                            </div>
                            <Field label={t("Location")}>
                              <TextInput
                                value={draft.location}
                                onChange={(event) =>
                                  update("location", event.target.value)
                                }
                              />
                            </Field>
                            <div className="designer-asset-field">
                              <Field label={t("Logo URL")}>
                                <TextInput
                                  value={draft.logo_url ?? ""}
                                  placeholder="https://…"
                                  onChange={(event) =>
                                    updateLogo(event.target.value)
                                  }
                                />
                              </Field>
                              <ImageUpload
                                shopId={shopId}
                                bucket="payment-qr"
                                label={t("Upload booth logo")}
                                onUploaded={updateLogo}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="builder-field-group">
                        <h3>
                          <Link2 size={15} /> {t("Social links")}
                        </h3>
                        <SocialLinkFields
                          settings={draft}
                          onChange={(settings) =>
                            commitSnapshot({
                              booth: settings,
                              payment: paymentDraftRef.current,
                            })
                          }
                        />
                        <Field label={t("Social QR center logo")}>
                          <TextInput
                            value={draft.social_qr_logo_url ?? ""}
                            onChange={(event) =>
                              update("social_qr_logo_url", event.target.value)
                            }
                          />
                        </Field>
                      </div>
                    </>
                  )}
                  {selected === "cart" && (
                    <div className="builder-fields builder-payment-fields">
                      <div className="builder-field-group">
                        <h3>
                          <Building2 size={15} /> {t("Payment account")}
                        </h3>
                        <div
                          className={`designer-payment-card ${paymentAccountReady ? "is-ready" : "needs-setup"}`}
                        >
                          <div className="designer-payment-preview">
                            <img
                              src={getBankLogoUrl(selectedBank)}
                              alt={selectedBank?.name ?? ""}
                              onError={(event) => {
                                event.currentTarget.src = getBankLogoUrl();
                              }}
                            />
                            <span>
                              <strong>
                                {selectedBank?.name ?? t("Choose a bank")}
                              </strong>
                              <small>
                                {paymentDraft.bank_account_name ||
                                  t("Account holder not set")}
                              </small>
                              <code>
                                {paymentDraft.bank_account_no ||
                                  t("No account configured")}
                              </code>
                            </span>
                            <em>
                              {t(
                                paymentAccountReady
                                  ? "Payment ready"
                                  : "Needs setup",
                              )}
                            </em>
                          </div>
                          <div className="designer-card-fields">
                            <Field label={t("Payment display name")}>
                              <TextInput
                                value={paymentDraft.bank_label}
                                onChange={(event) =>
                                  updatePayment(
                                    "bank_label",
                                    event.target.value,
                                  )
                                }
                              />
                            </Field>
                            <Field label={t("Bank")}>
                              <SelectMenu
                                label={t("Bank")}
                                value={selectedBank?.code ?? ""}
                                options={[
                                  { value: "", label: t("Select bank") },
                                  ...banks.map((bank) => ({
                                    value: bank.code,
                                    label: bank.name,
                                    description: bank.full_name,
                                  })),
                                ]}
                                onChange={(value) => {
                                  const bank = banks.find(
                                    (item) => item.code === value,
                                  );
                                  commitSnapshot({
                                    booth: draftRef.current,
                                    payment: {
                                      ...paymentDraftRef.current,
                                      bank_code: bank?.code ?? "",
                                      bank_acq_id: bank?.bin ?? "",
                                    },
                                  });
                                }}
                              />
                            </Field>
                            <div className="builder-field-row">
                              <Field label={t("Account number")}>
                                <TextInput
                                  value={paymentDraft.bank_account_no ?? ""}
                                  onChange={(event) =>
                                    updatePayment(
                                      "bank_account_no",
                                      event.target.value,
                                    )
                                  }
                                />
                              </Field>
                              <Field label={t("Account name")}>
                                <TextInput
                                  value={paymentDraft.bank_account_name ?? ""}
                                  onChange={(event) =>
                                    updatePayment(
                                      "bank_account_name",
                                      event.target.value,
                                    )
                                  }
                                />
                              </Field>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="builder-field-group">
                        <h3>
                          <MessageSquareText size={15} />{" "}
                          {t("Transfer message")}
                        </h3>
                        <Field
                          label={t("Transfer message template")}
                          hint={t("Available tokens: {code}, {item}, {amount}")}
                        >
                          <TextInput
                            value={paymentDraft.bank_add_info_template ?? ""}
                            onChange={(event) =>
                              updatePayment(
                                "bank_add_info_template",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                        <Field label={t("Customer payment instructions")}>
                          <TextArea
                            value={paymentDraft.payment_instructions}
                            onChange={(event) =>
                              updatePayment(
                                "payment_instructions",
                                event.target.value,
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="builder-field-group">
                        <h3>
                          <QrCode size={15} /> {t("Backup QR")}
                        </h3>
                        <div className="builder-backup-qr">
                          {paymentDraft.bank_qr_url ? (
                            <img
                              src={paymentDraft.bank_qr_url}
                              alt={t("Backup payment QR")}
                            />
                          ) : (
                            <span>
                              <QrCode size={28} />
                            </span>
                          )}
                          <Field label={t("Fallback QR URL")}>
                            <TextInput
                              value={paymentDraft.bank_qr_url}
                              onChange={(event) =>
                                updatePayment("bank_qr_url", event.target.value)
                              }
                            />
                          </Field>
                        </div>
                        <ImageUpload
                          shopId={shopId}
                          bucket="payment-qr"
                          label={t("Upload backup QR")}
                          onUploaded={(url) =>
                            updatePayment("bank_qr_url", url)
                          }
                        />
                      </div>
                    </div>
                  )}
                  {selected === "controls" && (
                    <div className="builder-fields">
                      <p className="builder-empty-inspector">
                        {t(
                          "Browse controls use the categories and product data from your catalog. Language is available under Style.",
                        )}
                      </p>
                      <div className="builder-field-group">
                        <h3>
                          <Palette size={15} /> {t("Control style")}
                        </h3>
                        <DesignerStyleOptions
                          options={controlsStyleOptions}
                          value={draft.controls_style ?? "panel"}
                          sampleClassName={(value) =>
                            `section-style-sample sample-controls-${value}`
                          }
                          translate={t}
                          onChange={(value) => update("controls_style", value)}
                        />
                      </div>
                    </div>
                  )}
                  {selected === "products" && (
                    <div className="builder-fields">
                      <p className="builder-empty-inspector">
                        {t(
                          "Product content is managed from the Products workspace. This section follows the customer’s grid or list choice.",
                        )}
                      </p>
                      <div className="builder-field-group">
                        <h3>
                          <Palette size={15} /> {t("Product card style")}
                        </h3>
                        <DesignerStyleOptions
                          options={productStyleOptions}
                          value={draft.product_style ?? "classic"}
                          sampleClassName={(value) =>
                            `section-style-sample sample-product-${value}`
                          }
                          translate={t}
                          onChange={(value) => update("product_style", value)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {tab === "style" && (
                <>
                  <div className="builder-section-heading">
                    <div>
                      <strong>{t("Look & feel")}</strong>
                      <small>{t("Changes update the canvas instantly.")}</small>
                    </div>
                  </div>
                  <div className="designer-style-section">
                    <div className="designer-style-section-heading">
                      <strong>{t("Palette presets")}</strong>
                      <small>
                        {t(
                          "Start with a mood, then fine-tune any color below.",
                        )}
                      </small>
                    </div>
                    <div className="designer-palette-grid">
                      {STOREFRONT_PALETTES.map((palette) => {
                        const active =
                          draft.theme_primary === palette.primary &&
                          draft.theme_secondary === palette.secondary &&
                          draft.theme_accent === palette.accent &&
                          draft.theme_background === palette.background;
                        return (
                          <button
                            key={palette.id}
                            type="button"
                            className={active ? "active" : ""}
                            onClick={() => applyPalette(palette)}
                            aria-pressed={active}
                          >
                            <span className="designer-palette-swatches">
                              {[
                                palette.primary,
                                palette.secondary,
                                palette.accent,
                                palette.background,
                              ].map((colorValue) => (
                                <i
                                  key={colorValue}
                                  style={{ background: colorValue }}
                                />
                              ))}
                            </span>
                            <span>
                              <strong>{t(palette.name)}</strong>
                              <small>{t(palette.mood)}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="designer-style-section">
                    <div className="designer-style-section-heading">
                      <strong>{t("Card personality")}</strong>
                      <small>
                        {t(
                          "Choose how product, booth, cart, and control cards feel.",
                        )}
                      </small>
                    </div>
                    <DesignerStyleOptions
                      options={
                        [
                          ["soft", "Soft", "Gentle surfaces"],
                          ["outlined", "Outlined", "Clean and crisp"],
                          ["elevated", "Elevated", "Polished depth"],
                          ["playful", "Playful", "Colorful offset shadow"],
                        ] as const
                      }
                      value={draft.card_style ?? "soft"}
                      className="designer-card-style-grid"
                      sampleClassName={(value) =>
                        `card-style-sample card-style-${value}`
                      }
                      translate={t}
                      onChange={(value) => update("card_style", value)}
                    />
                  </div>
                  <div className="designer-style-section-heading designer-custom-colors-heading">
                    <strong>{t("Custom colors")}</strong>
                    <small>{t("Make this palette completely yours.")}</small>
                  </div>
                  <div className="designer-color-grid">
                    {(
                      [
                        [
                          "theme_primary",
                          "primary",
                          "Primary",
                          DEFAULT_STOREFRONT_PALETTE.primary,
                        ],
                        [
                          "theme_secondary",
                          "secondary",
                          "Dark",
                          DEFAULT_STOREFRONT_PALETTE.secondary,
                        ],
                        [
                          "theme_accent",
                          "accent",
                          "Accent",
                          DEFAULT_STOREFRONT_PALETTE.accent,
                        ],
                        [
                          "theme_background",
                          "background",
                          "Page",
                          DEFAULT_STOREFRONT_PALETTE.background,
                        ],
                      ] as const
                    ).map(([key, role, label, fallback]) => (
                      <div className="designer-color-field" key={key}>
                        <span>{t(label)}</span>
                        <StorefrontThemeColorPicker
                          role={role}
                          label={t(label)}
                          value={draft[key] ?? fallback}
                          settings={draft}
                          onChange={(value) => update(key, value)}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="designer-setting-group">
                    <div>
                      <Palette size={16} />
                      <span>
                        <strong>{t("Corner radius")}</strong>
                        <small>
                          {t("{{radius}}px across storefront cards", {
                            radius: draft.corner_radius ?? 16,
                          })}
                        </small>
                      </span>
                    </div>
                    <RangeInput
                      aria-label={t("Corner radius")}
                      min={0}
                      max={32}
                      step={1}
                      value={draft.corner_radius ?? 16}
                      onChange={(event) =>
                        update("corner_radius", Number(event.target.value))
                      }
                    />
                  </div>
                  <div className="designer-locale">
                    <Languages size={17} />
                    <span>
                      <strong>{t("Storefront language")}</strong>
                      <small>{t("Customer-facing interface copy.")}</small>
                    </span>
                    <div>
                      <button
                        type="button"
                        className={
                          (draft.catalog_locale ?? "en") === "en"
                            ? "active"
                            : ""
                        }
                        aria-pressed={(draft.catalog_locale ?? "en") === "en"}
                        onClick={() => update("catalog_locale", "en")}
                      >
                        EN
                      </button>
                      <button
                        type="button"
                        className={
                          draft.catalog_locale === "vi" ? "active" : ""
                        }
                        aria-pressed={draft.catalog_locale === "vi"}
                        onClick={() => update("catalog_locale", "vi")}
                      >
                        VI
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </aside>

      <div className="builder-canvas admin-surface">
        {publishNotice && (
          <Alert
            variant="error"
            title={t("Could not publish all changes")}
            className="builder-publish-alert"
            onClose={() => setPublishNotice("")}
          >
            {publishNotice}
          </Alert>
        )}
        {syncNotice && (
          <Alert
            variant="info"
            title={t("Newer storefront changes detected")}
            className="builder-publish-alert"
            onClose={() => setSyncNotice("")}
          >
            {t(syncNotice)}
          </Alert>
        )}
        <div className="builder-toolbar">
          <div>
            <strong>{t(sectionMeta[selected].title)}</strong>
            <small>
              {t(hasChanges ? "Unpublished changes" : "Published storefront")}
            </small>
          </div>
          <div className="builder-toolbar-controls">
            <div
              className="builder-device-switcher admin-segmented-control admin-segmented-view"
              aria-label={t("Preview size")}
            >
              <button
                type="button"
                className={device === "desktop" ? "active" : ""}
                aria-pressed={device === "desktop"}
                onClick={() => changeDevice("desktop")}
              >
                <Monitor size={16} />
                {t("Desktop")}
              </button>
              <button
                type="button"
                className={device === "phone" ? "active" : ""}
                aria-pressed={device === "phone"}
                onClick={() => changeDevice("phone")}
              >
                <Smartphone size={16} />
                {t("Phone")}
              </button>
            </div>
            <div
              className="builder-zoom-controls"
              aria-label={t("Preview zoom")}
            >
              <button
                type="button"
                onClick={() => adjustZoom(-10)}
                disabled={displayedZoom <= 20}
                aria-label={t("Zoom out")}
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                className={previewZoom === "fit" ? "active" : ""}
                onClick={fitPreview}
                aria-label={t("Fit preview")}
              >
                <Maximize2 size={13} />
                <span>{displayedZoom}%</span>
              </button>
              <button
                type="button"
                onClick={() => adjustZoom(10)}
                disabled={displayedZoom >= 150}
                aria-label={t("Zoom in")}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="builder-history-actions">
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              aria-label={t("Undo")}
            >
              <Undo2 size={15} />
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={future.length === 0}
              aria-label={t("Redo")}
            >
              <Redo2 size={15} />
            </button>
            <button
              type="button"
              onClick={resetDraft}
              disabled={!hasChanges}
              aria-label={t("Reset unpublished changes")}
            >
              <RotateCcw size={15} />
              <span>{t("Reset")}</span>
            </button>
            <Button
              icon={<Save size={15} />}
              loading={busy}
              loadingText={t("Publishing…")}
              disabled={!hasChanges || busy}
              onClick={() => void save()}
            >
              {t("Publish")}
            </Button>
          </div>
        </div>
        <div
          ref={previewStageRef}
          className={`designer-preview-stage device-${device} ${spacePressed ? "is-pan-ready" : ""} ${canvasPanning ? "is-panning" : ""}`}
          onPointerDown={handleStagePointerDown}
          onPointerMove={handleStagePointerMove}
          onPointerUp={handleStagePointerEnd}
          onPointerCancel={handleStagePointerEnd}
          onWheel={handleStageWheel}
          onPointerEnter={() => {
            canvasHoverRef.current = true;
          }}
          onPointerLeave={() => {
            canvasHoverRef.current = false;
          }}
          aria-label={t("Storefront preview canvas")}
        >
          <div
            className="designer-preview-frame"
            style={{
              width: `${(device === "phone" ? 390 : 1380) * previewScale}px`,
              minHeight: `${(device === "phone" ? 844 : 1120) * previewScale}px`,
            }}
          >
            <iframe
              ref={previewIframeRef}
              className="designer-preview-iframe"
              title={t("{{device}} storefront preview", { device: t(device) })}
              srcDoc={`<!doctype html><html lang="${draft.catalog_locale ?? "en"}"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="designer-preview-root"></div></body></html>`}
              onLoad={loadPreviewFrame}
              style={{
                width: device === "phone" ? 390 : 1380,
                height: device === "phone" ? 844 : 1120,
                transform: `scale(${previewScale})`,
              }}
            />
            {previewDocument &&
              createPortal(
                <CatalogLocaleProvider
                  locale={draft.catalog_locale ?? "en"}
                  targetDocument={previewDocument}
                >
                  <div
                    className="designer-live-storefront app-shell"
                    style={{ ...getThemeStyle(draft), transform: "none" }}
                  >
                    <CatalogHeader
                      booth={draft}
                      onOpenInfo={() => {
                        setSelected("booth");
                        setTab("content");
                      }}
                      isDesigner={true}
                      isSelected={device === "phone" && selected === "booth"}
                    />
                    <div className="catalog-layout storefront-layout-grid">
                      <div className="storefront-hero-grid">
                        {heroPreviewSections.map(renderModule)}
                      </div>
                      <div className="storefront-content-grid">
                        {contentPreviewColumns.map((column) => column.node)}
                      </div>
                    </div>
                  </div>
                </CatalogLocaleProvider>,
                previewDocument.getElementById("designer-preview-root") ??
                  previewDocument.body,
              )}
          </div>
        </div>
      </div>
    </section>
  );
}
