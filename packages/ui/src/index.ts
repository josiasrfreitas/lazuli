/**
 * Shared UI components. Portuguese-BR labels live near the UI (§2.1).
 * Baseline library ships when GRE-57 (P00) closes — not in backend issues (D-0036).
 */

export const UI_PACKAGE = "@lazuli/ui" as const;

export { Avatar, avatarVariants } from "./components/avatar";
export type { AvatarProps, AvatarSize } from "./components/avatar";
export { Badge, badgeVariants } from "./components/badge";
export type { BadgeProps, BadgeVariant } from "./components/badge";
export {
  Alert,
  AlertAction,
  AlertContent,
  AlertDescription,
  AlertIcon,
  AlertTitle,
  alertVariants,
} from "./components/alert";
export type {
  AlertActionProps,
  AlertContentProps,
  AlertDescriptionProps,
  AlertIconProps,
  AlertProps,
  AlertTitleProps,
  AlertVariant,
} from "./components/alert";
export { Button, buttonVariants } from "./components/button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/button";
export { DataTablePage } from "./components/data-table-page";
export { DataTable } from "./components/data-table";
export type { DataTableColumn, DataTableProps, DataTableState } from "./components/data-table";
export type { TablePaginationConfig } from "./components/table-pagination";
export { TableFilters, TableFilterChips } from "./components/table-filters";
export type {
  RemoteOptionsResult,
  TableFilterField,
  TableFilterOption,
} from "./components/table-filters";
export type { DataTablePageProps } from "./components/data-table-page";
export { EmptyState } from "./components/empty-state";
export type { EmptyStateProps } from "./components/empty-state";
export { HelloWorld } from "./components/hello-world";
export type { HelloWorldProps } from "./components/hello-world";
export { Input } from "./components/input";
export type { InputProps, InputSize } from "./components/input";
export { CurrencyInput } from "./components/currency-input";
export type { CurrencyInputProps } from "./components/currency-input";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export type {
  SelectContentProps,
  SelectGroupProps,
  SelectItemProps,
  SelectLabelProps,
  SelectProps,
  SelectScrollDownButtonProps,
  SelectScrollUpButtonProps,
  SelectSeparatorProps,
  SelectSize,
  SelectTriggerProps,
  SelectValueProps,
} from "./components/select";
export { cn } from "./lib/utils";
export { Checkbox, checkboxVariants } from "./components/checkbox";
export type { CheckboxProps, CheckboxSize } from "./components/checkbox";
export { Switch } from "./components/switch";
export type { SwitchProps } from "./components/switch";
export { Textarea } from "./components/textarea";
export type { TextareaProps } from "./components/textarea";
export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./components/tooltip";
export type { TooltipContentProps, TooltipProps, TooltipTriggerProps } from "./components/tooltip";
export {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  dialogContentVariants,
} from "./components/dialog";
export type {
  DialogBackdropProps,
  DialogBodyProps,
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogPortalProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "./components/dialog";
export { Pagination } from "./components/pagination";
export type { PaginationProps } from "./components/pagination";
export { Stepper } from "./components/stepper";
export type { StepperItem, StepperProps, StepperStepState } from "./components/stepper";
export {
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  sheetContentVariants,
} from "./components/sheet";
export type {
  SheetBackdropProps,
  SheetBodyProps,
  SheetCloseProps,
  SheetContentProps,
  SheetDescriptionProps,
  SheetFooterProps,
  SheetHeaderProps,
  SheetPortalProps,
  SheetProps,
  SheetSize,
  SheetTitleProps,
  SheetTriggerProps,
} from "./components/sheet";
export {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
  popoverContentVariants,
} from "./components/popover";
export type {
  PopoverCloseProps,
  PopoverContentProps,
  PopoverDescriptionProps,
  PopoverProps,
  PopoverSize,
  PopoverTitleProps,
  PopoverTriggerProps,
} from "./components/popover";
export {
  Tabs,
  TabsList,
  TabsPanel,
  TabsTab,
  tabsListVariants,
  tabsTabVariants,
} from "./components/tabs";
export type {
  TabsListProps,
  TabsPanelProps,
  TabsProps,
  TabsSize,
  TabsTabProps,
  TabsVariant,
} from "./components/tabs";
export {
  Table,
  TableBody,
  TableCaption,
  TableContainer,
  TableFooter,
  TableHeader,
  TableRow,
  tableCellSpacing,
  useTableDensity,
} from "./components/table";
export type {
  TableBodyProps,
  TableCaptionProps,
  TableContainerProps,
  TableDensity,
  TableFooterProps,
  TableHeaderProps,
  TableProps,
  TableRowProps,
} from "./components/table";
export { TableCell, TableEmpty, TableHead } from "./components/table-cells";
export { TablePagination } from "./components/table-pagination";
export { TableSkeleton } from "./components/table-skeleton";
export type { TableSkeletonProps } from "./components/table-skeleton";
export { InlineSkeleton } from "./components/inline-skeleton";
export type { InlineSkeletonProps } from "./components/inline-skeleton";
export type {
  TableCellProps,
  TableEmptyProps,
  TableHeadProps,
  TableSortDirection,
} from "./components/table-cells";
export type { TablePaginationProps } from "./components/table-pagination";
export { Label } from "./components/label";
export type { LabelProps } from "./components/label";
export { Field, FieldDescription, FieldError } from "./components/field";
export type { FieldDescriptionProps, FieldErrorProps, FieldProps } from "./components/field";

export { SegmentedControl, SegmentedControlItem } from "./components/segmented-control";
export type {
  SegmentedControlItemProps,
  SegmentedControlProps,
} from "./components/segmented-control";
export { FormRow, FormSection } from "./components/form-layout";
export type { FormRowColumns, FormRowProps, FormSectionProps } from "./components/form-layout";
